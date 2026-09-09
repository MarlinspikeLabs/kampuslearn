'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const {getClient,pool}=require('../src/config/database');
(async()=>{
 const c=await getClient();
 try {
  await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const data={exported_at:new Date().toISOString()};
  const fields={institutions:'id,name,short_name,type,state,city,website_url',faculties:'id,institution_id,name,code',schools:'id,institution_id,name,code',departments:'id,faculty_id,school_id,name,code',courses:'id,department_id,title,code,level,level_type,semester,credit_units,is_active'};
  for(const [table,cols] of Object.entries(fields))data[table]=(await c.query(`SELECT ${cols} FROM ${table} ORDER BY id`)).rows;
  data.coverage=(await c.query(`SELECT i.id,i.name,i.short_name,i.type,
   (SELECT count(*)::int FROM faculties f WHERE f.institution_id=i.id) faculties,
   (SELECT count(*)::int FROM schools s WHERE s.institution_id=i.id) schools,
   (SELECT count(*)::int FROM departments d LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id WHERE COALESCE(f.institution_id,s.institution_id)=i.id) departments,
   (SELECT count(*)::int FROM courses c JOIN departments d ON d.id=c.department_id LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id WHERE COALESCE(f.institution_id,s.institution_id)=i.id) courses
   FROM institutions i ORDER BY i.name`)).rows;
  data.link_issues={
   departments:(await c.query(`SELECT d.id,d.name,d.faculty_id,d.school_id FROM departments d LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id WHERE (d.faculty_id IS NULL AND d.school_id IS NULL) OR (d.faculty_id IS NOT NULL AND d.school_id IS NOT NULL) OR (d.faculty_id IS NOT NULL AND f.id IS NULL) OR (d.school_id IS NOT NULL AND s.id IS NULL)`)).rows,
   courses:(await c.query('SELECT c.id,c.code,c.department_id FROM courses c LEFT JOIN departments d ON d.id=c.department_id WHERE d.id IS NULL')).rows,
   faculties:(await c.query("SELECT f.id,f.name,f.institution_id FROM faculties f LEFT JOIN institutions i ON i.id=f.institution_id WHERE i.id IS NULL OR i.type<>'university'")).rows,
   schools:(await c.query("SELECT s.id,s.name,s.institution_id FROM schools s LEFT JOIN institutions i ON i.id=s.institution_id WHERE i.id IS NULL OR i.type<>'polytechnic'")).rows
  };
  await c.query('COMMIT');
  const file=path.join(os.homedir(),`kampuslearn-academic-coverage-${Date.now()}.json`);
  fs.writeFileSync(file,JSON.stringify(data,null,2),{flag:'wx',mode:0o600});
  console.table({institutions:data.institutions.length,faculties:data.faculties.length,schools:data.schools.length,departments:data.departments.length,courses:data.courses.length,without_units:data.coverage.filter(x=>x.faculties+x.schools===0).length,without_departments:data.coverage.filter(x=>x.departments===0).length,without_courses:data.coverage.filter(x=>x.courses===0).length,link_issues:Object.values(data.link_issues).reduce((n,x)=>n+x.length,0)});
  console.log('Academic export:',file);
  console.log('Read-only database audit. No student accounts, credentials or content files exported.');
 } catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
