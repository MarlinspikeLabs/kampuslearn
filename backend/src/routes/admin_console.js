'use strict';
const router=require('express').Router();
const {query}=require('../config/database');
const {authenticate,authorize}=require('../middleware/auth');
const {success,error}=require('../utils/response');
router.use(authenticate,authorize('admin'));
const run=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){return error(res,e.status?e.message:'Unable to complete this request. Please retry.',e.status||500);}};
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const pagination=req=>({page:Math.max(1,Math.min(100000,parseInt(req.query.page)||1)),limit:20});
router.param('id',(req,res,next,id)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?next():error(res,'Invalid record ID',400));
router.get('/overview',run(async(req,res)=>{
 const days=[7,30,90].includes(Number(req.query.days))?Number(req.query.days):30;
 const [trend,top,mix]=await Promise.all([
 query(`SELECT day::date::text AS day,(SELECT count(*) FROM course_materials WHERE created_at>=day AND created_at<day+interval '1 day') materials,(SELECT count(*) FROM users WHERE role='student' AND created_at>=day AND created_at<day+interval '1 day') registrations FROM generate_series(current_date-($1::int-1),current_date,interval '1 day') day ORDER BY day`,[days]),
 query(`SELECT i.id,i.name,i.short_name,count(sp.user_id) students FROM institutions i LEFT JOIN student_profiles sp ON sp.institution_id=i.id GROUP BY i.id ORDER BY students DESC,i.name LIMIT 5`),
 query('SELECT material_type label,count(*) value FROM course_materials GROUP BY material_type ORDER BY value DESC')]);
 success(res,{trend:trend.rows,institutions:top.rows,mix:mix.rows});
}));
router.get('/users',run(async(req,res)=>{
 const {page,limit}=pagination(req);const p=[];const cond=[];
 if(req.query.role==='team') cond.push("u.role IN ('admin','super_admin','lecturer','tutor')");else {p.push('student');cond.push('u.role=$1');}
 if(req.query.search){p.push('%'+String(req.query.search).slice(0,160)+'%');cond.push(`(u.full_name ILIKE $${p.length} OR u.email ILIKE $${p.length})`);}
 if(req.query.institution){p.push(req.query.institution);cond.push(`sp.institution_id::text=$${p.length}`);}
 if(req.query.status==='suspended')cond.push('u.is_suspended=TRUE');
 if(req.query.status==='active')cond.push('u.is_suspended=FALSE');
 if(req.query.status==='unverified')cond.push('u.is_verified=FALSE');
 const from=`FROM users u LEFT JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN institutions i ON i.id=sp.institution_id LEFT JOIN departments d ON d.id=sp.department_id WHERE ${cond.join(' AND ')}`;
 const total=Number((await query(`SELECT count(*) ${from}`,p)).rows[0].count);
 const r=await query(`SELECT u.id,u.full_name,u.email,u.phone,u.role,u.is_verified,u.is_suspended,u.created_at,u.last_login_at,sp.level,sp.matric_number,i.name institution_name,d.name department_name ${from} ORDER BY u.created_at DESC,u.id LIMIT $${p.length+1} OFFSET $${p.length+2}`,[...p,limit,(page-1)*limit]);
 success(res,{rows:r.rows,total,page,pages:Math.max(1,Math.ceil(total/limit))});
}));
router.get('/users/:id',run(async(req,res)=>{
 const r=await query(`SELECT u.id,u.full_name,u.email,u.phone,u.role,u.is_verified,u.is_suspended,u.created_at,u.last_login_at,sp.level,sp.matric_number,i.name institution_name,d.name department_name,
 (SELECT count(*) FROM exam_attempts WHERE student_id=u.id AND is_submitted=TRUE) completed_tests,
 (SELECT count(*) FROM ai_conversations WHERE user_id=u.id) ai_sessions
 FROM users u LEFT JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN institutions i ON i.id=sp.institution_id LEFT JOIN departments d ON d.id=sp.department_id WHERE u.id=$1`,[req.params.id]);
 if(!r.rows.length)fail('User not found',404);success(res,r.rows[0]);
}));
router.patch('/users/:id',run(async(req,res)=>{
 const full_name=String(req.body.full_name||'').trim();const phone=String(req.body.phone||'').trim();
 if(!full_name||full_name.length>180||phone.length>30)fail('Enter a valid name and phone number');
 // Admins may edit students; Super Admins may edit other non-protected accounts.
 const r=await query(`UPDATE users SET full_name=$1,phone=$2,updated_at=NOW() WHERE id=$3 AND (role='student' OR (role<>'super_admin' AND $4::boolean) OR id=$5) RETURNING id,full_name,phone`,[full_name,phone||null,req.params.id,req.user.role==='super_admin',req.user.id]);
 if(!r.rows.length)fail('Account missing or protected',403);success(res,r.rows[0],'Profile updated');
}));
router.patch('/users/:id/suspension',run(async(req,res)=>{
 if(typeof req.body.is_suspended!=='boolean')fail('A suspension state is required');
 if(req.params.id===req.user.id)fail('You cannot suspend yourself',403);
 const r=await query(`UPDATE users SET is_suspended=$1,updated_at=NOW() WHERE id=$2 AND (role='student' OR (role<>'super_admin' AND $3::boolean)) RETURNING id,is_suspended`,[req.body.is_suspended,req.params.id,req.user.role==='super_admin']);
 if(!r.rows.length)fail('Account missing or protected',403);success(res,r.rows[0],req.body.is_suspended?'Account suspended':'Account reactivated');
}));
const content=`SELECT cm.id,'material'::text kind,cm.title,cm.material_type::text category,cm.file_url,cm.is_approved,cm.created_at,cm.course_id,cm.uploaded_by,NULL::int AS year,NULL::text exam_type,cm.description,cm.content_scope,cm.generic_subject FROM course_materials cm UNION ALL SELECT pq.id,'past_question',COALESCE(c.code,pq.generic_subject)||' · '||pq.year::text||' past questions',pq.exam_type::text,pq.file_url,pq.is_approved,pq.created_at,pq.course_id,pq.uploaded_by,pq.year,pq.exam_type::text,NULL::text,pq.content_scope,pq.generic_subject FROM past_questions pq LEFT JOIN courses c ON c.id=pq.course_id`;
router.get('/content',run(async(req,res)=>{
 const {page,limit}=pagination(req);const p=[];const cond=['TRUE'];
 if(['material','past_question'].includes(req.query.kind)){p.push(req.query.kind);cond.push(`x.kind=$${p.length}`);}
 if(req.query.status==='published')cond.push('x.is_approved=TRUE');
 if(req.query.status==='unpublished')cond.push('x.is_approved=FALSE');
 if(req.query.search){p.push('%'+String(req.query.search).slice(0,160)+'%');cond.push(`(x.title ILIKE $${p.length} OR c.code ILIKE $${p.length} OR x.generic_subject ILIKE $${p.length})`);}
 if(req.query.institution){p.push(req.query.institution);cond.push(`(i.id::text=$${p.length} OR x.content_scope='generic')`);}
 if(['institution','generic'].includes(req.query.scope)){p.push(req.query.scope);cond.push(`x.content_scope=$${p.length}`);}
 const from=`FROM (${content}) x
 LEFT JOIN courses c ON c.id=x.course_id
 LEFT JOIN departments d ON d.id=c.department_id
 LEFT JOIN faculties f ON f.id=d.faculty_id
 LEFT JOIN schools s ON s.id=d.school_id
 LEFT JOIN LATERAL (
   SELECT ap.institution_id
   FROM programme_courses pc
   JOIN academic_programmes ap ON ap.id=pc.programme_id
   WHERE pc.course_id=c.id
   ORDER BY ap.is_active DESC,ap.id
   LIMIT 1
 ) pi ON TRUE
 LEFT JOIN institutions i
   ON i.id=COALESCE(f.institution_id,s.institution_id,pi.institution_id)
 LEFT JOIN users u ON u.id=x.uploaded_by
 WHERE ${cond.join(' AND ')}`;
 const total=Number((await query(`SELECT count(*) ${from}`,p)).rows[0].count);
 const r=await query(`SELECT x.*,COALESCE(c.code,'GENERIC') course_code,COALESCE(c.title,x.generic_subject) course_title,CASE WHEN x.content_scope='generic' THEN 'All institutions' ELSE i.name END institution_name,u.full_name uploader ${from} ORDER BY x.created_at DESC,x.id LIMIT $${p.length+1} OFFSET $${p.length+2}`,[...p,limit,(page-1)*limit]);
 success(res,{rows:r.rows,total,page,pages:Math.max(1,Math.ceil(total/limit))});
}));
router.patch('/content/:kind/:id',run(async(req,res)=>{
 const table={material:'course_materials',past_question:'past_questions'}[req.params.kind];
 if(!table)fail('Invalid content type');
 if(typeof req.body.is_approved==='boolean') {
  const r=await query(`UPDATE ${table} SET is_approved=$1 WHERE id=$2 RETURNING id,is_approved`,[req.body.is_approved,req.params.id]);
  if(!r.rows.length)fail('Content not found',404);return success(res,r.rows[0],req.body.is_approved?'Content published':'Content unpublished');
 }
 let r;
 if(req.params.kind==='material'){
  const title=String(req.body.title||'').trim();if(!title||title.length>250)fail('Enter a title of 1–250 characters');
  r=await query('UPDATE course_materials SET title=$1,description=$2 WHERE id=$3 RETURNING id,title,description',[title,String(req.body.description||'').slice(0,5000),req.params.id]);
 }else{
  const year=Number(req.body.year);if(!Number.isInteger(year)||year<1960||year>new Date().getFullYear()+1)fail('Enter a valid exam year');
  r=await query('UPDATE past_questions SET year=$1 WHERE id=$2 RETURNING id,year',[year,req.params.id]);
 }
 if(!r.rows.length)fail('Content not found',404);success(res,r.rows[0],'Content updated');
}));
router.delete('/content/:kind/:id',run(async(req,res)=>{
 const result=await require('../services/deleteContent')(req.params.kind,req.params.id);
 success(res,result,'Content deleted');
}));


// ============================================================
// QUESTION BANK ADMIN
// ============================================================

router.get('/question-banks',run(async(req,res)=>{
 const r=await query(`
   SELECT
     pcs.source_course_id AS id,
     source.code,
     source.title,
     source.level,
     source.semester,

     COUNT(DISTINCT pcs.course_id)::int AS mapped_courses,

     COUNT(DISTINCT q.id)::int AS total_questions,

     COUNT(DISTINCT q.id) FILTER (
       WHERE q.is_approved=TRUE
     )::int AS approved_questions,

     COUNT(DISTINCT q.id) FILTER (
       WHERE q.is_approved=FALSE
     )::int AS draft_questions,

     COUNT(DISTINCT q.topic_id)::int AS topics

   FROM practice_course_question_sources pcs

   JOIN courses source
     ON source.id=pcs.source_course_id

   LEFT JOIN questions q
     ON q.course_id=source.id

   GROUP BY
     pcs.source_course_id,
     source.code,
     source.title,
     source.level,
     source.semester

   ORDER BY
     source.level,
     source.code,
     source.title
 `);

 success(res,r.rows);
}));

router.get('/question-banks/:id/questions',run(async(req,res)=>{
 const {page,limit}=pagination(req);

 const bank=await query(`
   SELECT
     c.id,
     c.code,
     c.title,
     c.level,
     c.semester,
     COUNT(DISTINCT pcs.course_id)::int AS mapped_courses

   FROM courses c

   JOIN practice_course_question_sources pcs
     ON pcs.source_course_id=c.id

   WHERE c.id=$1

   GROUP BY
     c.id,
     c.code,
     c.title,
     c.level,
     c.semester
 `,[req.params.id]);

 if(!bank.rows.length)fail('Question bank not found',404);

 const p=[req.params.id];
 const cond=['q.course_id=$1'];

 if(req.query.status==='approved'){
   cond.push('q.is_approved=TRUE');
 }

 if(req.query.status==='draft'){
   cond.push('q.is_approved=FALSE');
 }

 if(['easy','medium','hard'].includes(req.query.difficulty)){
   p.push(req.query.difficulty);
   cond.push(`q.difficulty::text=$${p.length}`);
 }

 if(req.query.topic){
   p.push(req.query.topic);
   cond.push(`q.topic_id::text=$${p.length}`);
 }

 if(req.query.search){
   p.push('%'+String(req.query.search).slice(0,180)+'%');
   cond.push(`q.question_text ILIKE $${p.length}`);
 }

 const where='WHERE '+cond.join(' AND ');

 const total=Number((await query(`
   SELECT COUNT(*)
   FROM questions q
   ${where}
 `,p)).rows[0].count);

 const rows=await query(`
   SELECT
     q.id,
     q.question_text,
     q.question_type,
     q.options,
     q.correct_answer,
     q.explanation,
     q.difficulty,
     q.marks,
     q.year,
     q.is_approved,
     q.created_at,

     t.id AS topic_id,
     t.name AS topic_name,

     u.full_name AS created_by_name

   FROM questions q

   LEFT JOIN topics t
     ON t.id=q.topic_id

   JOIN users u
     ON u.id=q.created_by

   ${where}

   ORDER BY
     t.order_num NULLS LAST,
     t.name NULLS LAST,
     q.created_at,
     q.id

   LIMIT $${p.length+1}
   OFFSET $${p.length+2}
 `,[...p,limit,(page-1)*limit]);

 const topics=await query(`
   SELECT
     t.id,
     t.name,
     t.order_num,
     COUNT(q.id)::int AS questions

   FROM topics t

   LEFT JOIN questions q
     ON q.topic_id=t.id
    AND q.course_id=t.course_id

   WHERE t.course_id=$1

   GROUP BY
     t.id,
     t.name,
     t.order_num

   ORDER BY
     t.order_num,
     t.name
 `,[req.params.id]);

 success(res,{
   bank:bank.rows[0],
   topics:topics.rows,
   rows:rows.rows,
   total,
   page,
   pages:Math.max(1,Math.ceil(total/limit))
 });
}));

router.patch('/question-bank/questions/:id',run(async(req,res)=>{
 const existing=await query(`
   SELECT *
   FROM questions
   WHERE id=$1
 `,[req.params.id]);

 if(!existing.rows.length)fail('Question not found',404);

 const current=existing.rows[0];

 if(typeof req.body.is_approved==='boolean' &&
    Object.keys(req.body).length===1){

   const r=await query(`
     UPDATE questions
     SET is_approved=$1
     WHERE id=$2
     RETURNING id,is_approved
   `,[req.body.is_approved,req.params.id]);

   return success(
     res,
     r.rows[0],
     req.body.is_approved
       ? 'Question approved'
       : 'Question returned to draft'
   );
 }

 const question_text=String(
   req.body.question_text ?? current.question_text
 ).trim();

 const explanation=String(
   req.body.explanation ?? current.explanation ?? ''
 ).trim();

 const difficulty=String(
   req.body.difficulty ?? current.difficulty
 );

 const correct_answer=String(
   req.body.correct_answer ?? current.correct_answer
 ).trim();

 const question_type=String(
   req.body.question_type ?? current.question_type
 );

 const options=
   req.body.options!==undefined
     ? req.body.options
     : current.options;

 if(!question_text || question_text.length>5000)
   fail('Enter valid question text');

 if(!['easy','medium','hard'].includes(difficulty))
   fail('Invalid difficulty');

 if(!['mcq','true_false'].includes(question_type))
   fail('Invalid question type');

 if(!correct_answer)
   fail('Correct answer is required');

 if(question_type==='mcq'){
   if(!Array.isArray(options)||options.length<2)
     fail('MCQ questions require at least two options');

   const labels=options.map(x=>
     String(x?.label||'').trim().toUpperCase()
   );

   if(labels.some(x=>!x))
     fail('Every option requires a label');

   if(new Set(labels).size!==labels.length)
     fail('Option labels must be unique');

   if(options.some(x=>!String(x?.text||'').trim()))
     fail('Every option requires text');

   if(!labels.includes(correct_answer.toUpperCase()))
     fail('Correct answer must match an option label');
 }

 const r=await query(`
   UPDATE questions

   SET
     question_text=$1,
     question_type=$2,
     options=$3,
     correct_answer=$4,
     explanation=$5,
     difficulty=$6::difficulty_level

   WHERE id=$7

   RETURNING
     id,
     question_text,
     question_type,
     options,
     correct_answer,
     explanation,
     difficulty,
     is_approved
 `,[
   question_text,
   question_type,
   options ? JSON.stringify(options) : null,
   correct_answer,
   explanation || null,
   difficulty,
   req.params.id
 ]);

 success(res,r.rows[0],'Question updated');
}));


module.exports=router;
