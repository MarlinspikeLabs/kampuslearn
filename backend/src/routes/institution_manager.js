'use strict';
const router = require('express').Router();
const { query, getClient } = require('../config/database');
const { seedInstitution } = require('../services/academicTemplates');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error } = require('../utils/response');
router.use(authenticate, authorize('admin'));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('id', (req,res,next,id) => uuid.test(id) ? next() : error(res,'Invalid record ID',400));
const run = fn => async (req,res) => { try { await fn(req,res); } catch(e) {
  return error(res, e.code === '23505' ? 'That name or code already exists' : e.code === '23503' ? 'Related record is missing or still in use' : e.status ? e.message : 'Could not save changes. Please retry.', e.status || (['23505','23503'].includes(e.code) ? 409 : 500));
}};
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
const name = x => typeof x === 'string' && x.trim().length && x.trim().length <= 180 ? x.trim() : fail('Enter a name of 1–180 characters');
const code = x => name(x).toUpperCase();
router.get('/institutions',run(async(req,res)=>success(res,(await query(`SELECT i.*,
 (SELECT count(*) FROM faculties WHERE institution_id=i.id) faculty_count,
 (SELECT count(*) FROM schools WHERE institution_id=i.id) school_count,
 (SELECT count(*) FROM departments d LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id WHERE COALESCE(f.institution_id,s.institution_id)=i.id) dept_count,
 (SELECT count(*) FROM student_profiles WHERE institution_id=i.id) student_count
 FROM institutions i ORDER BY i.name`)).rows)));
function institution(body) {
 const type=body.type;
 if(!['university','polytechnic'].includes(type)) fail('Choose university or polytechnic');
 const website=String(body.website_url||'').trim();
 if(website && !/^https?:\/\/[^\s]+$/i.test(website)) fail('Website must begin with https:// or http://');
 return [name(body.name),code(body.short_name),type,String(body.state||'').trim()||null,String(body.city||'').trim()||null,website||null];
}
router.post('/institutions',run(async(req,res)=>{
 const values=institution(req.body),client=await getClient();
 try {
  await client.query('BEGIN');
  const created=(await client.query(`INSERT INTO institutions(name,short_name,type,state,city,website_url,is_verified) VALUES($1,$2,$3,$4,$5,$6,TRUE) RETURNING *`,values)).rows[0];
  await seedInstitution(client,created.id);
  await client.query('COMMIT');
  success(res,created,'Institution created with editable academic defaults',201);
 } catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
router.patch('/institutions/:id',run(async(req,res)=>{
 const values=institution(req.body);
 const result=await query(`UPDATE institutions SET name=$1,short_name=$2,state=$4,city=$5,website_url=$6 WHERE id=$7 AND type=$3 RETURNING *`,[...values,req.params.id]);
 if(!result.rows.length) fail('Institution missing. Its academic structure type cannot be changed here.',409);
 success(res,result.rows[0],'Institution updated');
}));
for(const unit of ['faculties','schools']) {
 const column=unit==='faculties'?'faculty_id':'school_id';
 router.get(`/institutions/:id/${unit}`,run(async(req,res)=>success(res,(await query(`SELECT p.*,(SELECT count(*) FROM departments WHERE ${column}=p.id) dept_count FROM ${unit} p WHERE institution_id=$1 ORDER BY name`,[req.params.id])).rows)));
 router.post(`/institutions/:id/${unit}`,run(async(req,res)=>{
  const type=unit==='faculties'?'university':'polytechnic';
  const r=await query(`INSERT INTO ${unit}(institution_id,name,code) SELECT id,$2,$3 FROM institutions WHERE id=$1 AND type=$4 RETURNING *`,[req.params.id,name(req.body.name),code(req.body.code),type]);
  if(!r.rows.length) fail(`Institution is missing or does not use ${unit}`,400);
  success(res,r.rows[0],'Academic unit created',201);
 }));
 router.get(`/${unit}/:id/departments`,run(async(req,res)=>success(res,(await query(`SELECT d.*,(SELECT count(*) FROM courses WHERE department_id=d.id) course_count FROM departments d WHERE ${column}=$1 ORDER BY name`,[req.params.id])).rows)));
 router.post(`/${unit}/:id/departments`,run(async(req,res)=>success(res,(await query(`INSERT INTO departments(${column},name,code) VALUES($1,$2,$3) RETURNING *`,[req.params.id,name(req.body.name),code(req.body.code)])).rows[0],'Department created',201)));
}
router.get('/departments/:id/courses',run(async(req,res)=>success(res,(await query('SELECT * FROM courses WHERE department_id=$1 ORDER BY level,semester,code',[req.params.id])).rows)));
async function courseValues(body,departmentId) {
 const parent=await query(`SELECT i.type FROM departments d LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id JOIN institutions i ON i.id=COALESCE(f.institution_id,s.institution_id) WHERE d.id=$1`,[departmentId]);
 if(!parent.rows.length) fail('Department not found',404);
 const type=parent.rows[0].type;
 const level=String(body.level||'');
 if(!(type==='polytechnic'?['ND1','ND2','HND1','HND2']:['100','200','300','400','500','600']).includes(level)) fail('Choose a valid level for this institution');
 if(!['first','second'].includes(body.semester)) fail('Choose first or second semester');
 const credits=Number(body.credit_units);
 if(!Number.isInteger(credits)||credits<1||credits>12) fail('Credit units must be 1–12');
 return [name(body.title),code(body.code),level,type,body.semester,credits];
}
router.post('/departments/:id/courses',run(async(req,res)=>success(res,(await query(`INSERT INTO courses(department_id,title,code,level,level_type,semester,credit_units,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING *`,[req.params.id,...await courseValues(req.body,req.params.id)])).rows[0],'Course created',201)));
router.patch('/courses/:id',run(async(req,res)=>{
 const existing=await query('SELECT department_id FROM courses WHERE id=$1',[req.params.id]);
 if(!existing.rows.length) fail('Course not found',404);
 const values=await courseValues(req.body,existing.rows[0].department_id);
 success(res,(await query('UPDATE courses SET title=$1,code=$2,level=$3,level_type=$4,semester=$5,credit_units=$6 WHERE id=$7 RETURNING *',[...values,req.params.id])).rows[0],'Course updated');
}));
for(const table of ['faculties','schools','departments']) router.patch(`/${table}/:id`,run(async(req,res)=>{
 const r=await query(`UPDATE ${table} SET name=$1,code=$2 WHERE id=$3 RETURNING *`,[name(req.body.name),code(req.body.code),req.params.id]);
 if(!r.rows.length) fail('Record not found',404);success(res,r.rows[0],'Updated');
}));
// Lock the parent, then inspect every declared FK, including cascading references.
// This prevents silent cascades and concurrent children being inserted during deletion.
const ident=s=>'"'+s.replace(/"/g,'""')+'"';
for(const table of ['institutions','faculties','schools','departments','courses']) router.delete(`/${table}/:id`,authorize('super_admin'),run(async(req,res)=>{
 const client=await getClient();
 try {
  await client.query('BEGIN');
  const row=await client.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`,[req.params.id]);
  if(!row.rows.length) fail('Record not found',404);
  const refs=await client.query(`SELECT n.nspname AS schema_name,t.relname AS table_name,a.attname AS column_name FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.contype='f' AND c.confrelid=$1::regclass`,[table]);
  for(const r of refs.rows) {
   // Seeding metadata may cascade; actual academic/user records still block deletion.
   if(table==='institutions' && r.schema_name==='public' && r.table_name==='academic_template_assignments') continue;
   const used=await client.query(`SELECT 1 FROM ${ident(r.schema_name)}.${ident(r.table_name)} WHERE ${ident(r.column_name)}::text=$1 LIMIT 1`,[req.params.id]);
   if(used.rows.length) fail('This record is in use. Move or remove its linked records first.',409);
  }
  await client.query(`DELETE FROM ${table} WHERE id=$1`,[req.params.id]);
  await client.query('COMMIT');success(res,{},'Empty record deleted');
 } catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
module.exports=router;
