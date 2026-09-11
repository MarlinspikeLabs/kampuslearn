'use strict';
const router = require('express').Router();
const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { requireGemini, getConfig, aiError } = require('../services/ai/config');
const { prepare } = require('../services/ai/gemini');
const { getAIResponse } = require('../services/ai/aiService');
const budget = require('../services/ai/budget');
const { retrieve, publicSources } = require('../services/ai/materialContext');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value, name, required=false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || !UUID.test(value)) throw aiError(`Invalid ${name}`,400,'INVALID_INPUT');
  return value;
}
function respondError(res, err) {
  // Do not log upstream response bodies, API keys, prompts, or student data.
  console.error('AI request failed:', err.code || 'INTERNAL');
  if (err.status===429) res.set('Retry-After', ['DAILY_LIMIT','GLOBAL_DAILY_LIMIT'].includes(err.code) ? '3600' : '60');
  return error(res, err.publicMessage || 'The study service is temporarily unavailable. Please try again.',err.status || 503);
}
async function courseFor(user, id) {
  if (!id) return null;
  const r = await query(`SELECT c.id,c.code,c.title,c.level,c.level_type
    FROM courses c WHERE c.id=$1 AND c.is_active=TRUE AND
    ($3::boolean OR EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.user_id=$2 AND sp.department_id=c.department_id))`,
    [id,user.id,['admin','super_admin','lecturer'].includes(user.role)]);
  if (!r.rows.length) throw aiError('Course not found in your academic profile.',404,'COURSE_NOT_FOUND');
  return r.rows[0];
}
async function ownedConversation(userId,id) {
  const r = await query('SELECT * FROM ai_conversations WHERE id=$1 AND user_id=$2',[id,userId]);
  if (!r.rows.length) throw aiError('Conversation not found.',404,'CONVERSATION_NOT_FOUND');
  return r.rows[0];
}
router.use(authenticate);
router.get('/conversations', async (req,res) => {
  try {
    const r=await query(`SELECT ac.id,ac.title,ac.created_at,ac.updated_at,c.title AS course_title,c.code AS course_code,
      (SELECT COUNT(*) FROM ai_messages am WHERE am.conversation_id=ac.id) AS message_count
      FROM ai_conversations ac LEFT JOIN courses c ON c.id=ac.course_id WHERE ac.user_id=$1 ORDER BY ac.updated_at DESC LIMIT 30`,[req.user.id]);
    return success(res,r.rows);
  } catch(err) {return respondError(res,err);}
});
router.get('/conversations/:id',async(req,res)=>{
  try {
    const id=uuid(req.params.id,'conversation ID',true);
    const conversation=await ownedConversation(req.user.id,id);
    const r=await query("SELECT id,role,content,tokens_used,created_at,sources,COALESCE(grounding,CASE WHEN role='assistant' THEN 'legacy_demo' END) AS grounding FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at ASC,id ASC",[id]);
    return success(res,{conversation,messages:r.rows});
  }catch(err){return respondError(res,err);}
});
router.delete('/conversations/:id',async(req,res)=>{
  try{
    const id=uuid(req.params.id,'conversation ID',true);
    const r=await query('DELETE FROM ai_conversations WHERE id=$1 AND user_id=$2 RETURNING id',[id,req.user.id]);
    if(!r.rows.length)throw aiError('Conversation not found.',404,'CONVERSATION_NOT_FOUND');
    return success(res,{},'Conversation deleted');
  }catch(err){return respondError(res,err);}
});
router.get('/usage',async(req,res)=>{
  try{
    const config=getConfig();
    return success(res,{...await budget.dailyUsage(req.user.id,config),
      available:config.provider==='gemini'&&Boolean(config.apiKey)&&config.model==='gemini-3.5-flash-lite'&&config.billingTier==='free',
      provider:config.provider==='gemini'?'gemini':'disabled', material_support:'indexed_pdf_text'});
  }catch(err){return respondError(res,err);}
});

async function generate(req,res,isQuiz) {
  let reservation;
  try {
    const body=req.body || {};
    const courseId=uuid(body.course_id,'course ID',isQuiz);
    const conversationId=isQuiz?null:uuid(body.conversation_id,'conversation ID');
    if(!isQuiz && (typeof body.message!=='string' || !body.message.trim() || body.message.length>2000)) {
      throw aiError('Enter a question of 1–2000 characters.',400,'INVALID_INPUT');
    }
    if(isQuiz && (body.topic!=null && (typeof body.topic!=='string'||body.topic.length>200)))throw aiError('Topic must be text of at most 200 characters.',400,'INVALID_INPUT');
    const count=body.count??3;
    if(isQuiz && (!Number.isInteger(count)||count<1||count>5))throw aiError('Choose between 1 and 5 practice questions.',400,'INVALID_INPUT');
    const conversation=conversationId?await ownedConversation(req.user.id,conversationId):null;
    if(conversation && courseId && courseId!==conversation.course_id)throw aiError('Start a new chat to change course.',400,'COURSE_MISMATCH');
    const effectiveCourse=conversation?conversation.course_id:courseId;
    const course=await courseFor(req.user,effectiveCourse);
    const message=isQuiz?`Create ${count} exam-revision practice questions on ${body.topic?.trim()||'the core concepts'} for ${course.title}. Include answers and brief explanations. Label these as generated practice questions.`:body.message.trim();
    const config=requireGemini();
    // Fast local quota check before the tokenizer request; reserve() repeats it atomically.
    const daily=await budget.dailyUsage(req.user.id,config);
    if(!daily.remaining)throw aiError(`You have used your ${config.dailyLimit} study requests in the last 24 hours. Please return later.`,429,'DAILY_LIMIT');
    const history=conversationId?(await query("SELECT role,content FROM ai_messages WHERE conversation_id=$1 AND (role='user' OR grounding IS NOT NULL) ORDER BY created_at DESC,id DESC LIMIT 10",[conversationId])).rows.reverse():[];
    const weak=await query(`SELECT t.name FROM student_knowledge sk LEFT JOIN topics t ON t.id=sk.topic_id
      WHERE sk.user_id=$1 AND ($2::uuid IS NULL OR sk.course_id=$2) AND sk.strength='weak'
      ORDER BY sk.knowledge_level ASC LIMIT 5`,[req.user.id,effectiveCourse]);
    const userContext={
      firstName: req.user.full_name?.trim().split(/\s+/)[0] || '',
      weakTopics: weak.rows.map(r=>r.name).filter(Boolean)
    };
    const sources=await retrieve(effectiveCourse, isQuiz?(body.topic?.trim()||course.title):message);
    const sourceLinks=publicSources(sources);
    const grounding=sources.length?'course_excerpts':'general';
    const messages=[...history,{role:'user',content:message}];
    reservation=await budget.reserve(req.user.id,isQuiz?'quiz_gen':'chat',0,config);
    const prepared=await prepare(messages,course,userContext,sources,config);
    const result=await getAIResponse(messages,course,userContext,sources,prepared);
    const client=await getClient();
    let convoId=conversationId, saved;
    try {
      await client.query('BEGIN');
      if(!isQuiz){
        if(convoId){
          // Recheck and lock before persisting: the chat may have been deleted while Gemini ran.
          const locked=await client.query('SELECT id FROM ai_conversations WHERE id=$1 AND user_id=$2 FOR UPDATE',[convoId,req.user.id]);
          if(!locked.rows.length)throw aiError('This conversation was deleted. Please start a new chat.',409,'CONVERSATION_DELETED');
        }else{
          const r=await client.query('INSERT INTO ai_conversations(user_id,course_id,title) VALUES($1,$2,$3) RETURNING id',[req.user.id,effectiveCourse,message.slice(0,80)]);
          convoId=r.rows[0].id;
        }
        await client.query("INSERT INTO ai_messages(conversation_id,role,content,created_at) VALUES($1,'user',$2,clock_timestamp())",[convoId,message]);
        saved=(await client.query(`INSERT INTO ai_messages(conversation_id,role,content,tokens_used,sources,grounding,created_at)
          VALUES($1,'assistant',$2,$3,$4::jsonb,$5,clock_timestamp()) RETURNING id,created_at`,[convoId,result.content,result.tokens_used,JSON.stringify(sourceLinks),grounding])).rows[0];
        await client.query('UPDATE ai_conversations SET updated_at=NOW() WHERE id=$1',[convoId]);
      }
      await client.query('INSERT INTO ai_usage_logs(user_id,tokens_used,feature) VALUES($1,$2,$3)',[req.user.id,result.tokens_used,isQuiz?'quiz_gen':'chat']);
      await client.query("UPDATE ai_generation_requests SET status='completed',cost_micros=$2,tokens_used=$3,updated_at=NOW() WHERE id=$1",[reservation,result.actualMicros,result.tokens_used]);
      await client.query('COMMIT');
    }catch(err){await client.query('ROLLBACK');throw err;}
    finally{client.release();}
    reservation=null;
    const usage=await budget.dailyUsage(req.user.id,config);
    return success(res,{
      ...(isQuiz?{course,topic:body.topic||'General Revision',content:result.content}:{conversation_id:convoId,message_id:saved.id,reply:result.content,created_at:saved.created_at}),
      provider:result.provider, sources:sourceLinks, grounding, truncated:result.truncated, usage,
    });
  }catch(err){
    if(reservation)try{await budget.fail(reservation);}catch{console.error('AI reservation retained for reconciliation.');}
    return respondError(res,err);
  }
}
router.post('/chat',(req,res)=>generate(req,res,false));
router.post('/generate-quiz',(req,res)=>generate(req,res,true));
module.exports=router;
