'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const {pool}=require('../src/config/database');const {plan}=require('./academic-plan.cjs');
const dataset=require('../data/academic-reference/institutions.json');
const {planStructures}=require('./structure-plan.cjs');
const structures=require('../data/academic-reference/structures.json');
const apply=process.argv.includes('--apply');
if((apply&&process.argv.includes('--dry-run'))||process.argv.slice(2).some(a=>!['--apply','--dry-run'].includes(a))){console.error('Use --dry-run (default) or --apply');process.exit(1);}
(async()=>{const c=await pool.connect();try{
 await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");
 // Blocks concurrent academic edits only during this short transaction.
 await c.query('LOCK TABLE institutions, faculties, schools, departments IN SHARE ROW EXCLUSIVE MODE');
 const rows=(await c.query('SELECT id,name,short_name,type,state,city,website_url FROM institutions ORDER BY id')).rows;
 const result=plan(rows,dataset);
 const academic={institutions:rows,faculties:(await c.query('SELECT id,institution_id,name,code FROM faculties')).rows,schools:(await c.query('SELECT id,institution_id,name,code FROM schools')).rows,departments:(await c.query('SELECT id,faculty_id,school_id,name,code FROM departments')).rows};
 result.structures=planStructures(academic,structures);
 const constraints=(await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='institutions' AND is_nullable='NO' AND column_name IN ('state','city','website_url')")).rows.map(x=>x.column_name);
 result.inserts=result.inserts.filter(x=>{const missing=constraints.filter(k=>x.record[k]==null);if(missing.length){result.held.push({source_key:x.source_key,name:x.name,reason:'Database requires unverified fields: '+missing.join(', ')});return false;}return true;});
 const reportDir=path.join(os.homedir(),'kampuslearn-import-reports');fs.mkdirSync(reportDir,{recursive:true,mode:0o700});
 const stamp=Date.now();const file=path.join(reportDir,`academic-${stamp}-${apply?'apply':'dry-run'}.json`);
 const backup=path.join(reportDir,`academic-before-${stamp}.json`);
 if(apply){
  fs.writeFileSync(backup,JSON.stringify(academic,null,2),{flag:'wx',mode:0o600});
  for(const x of result.inserts){const r=x.record;await c.query('INSERT INTO institutions(id,name,short_name,type,state,city,website_url,is_verified) VALUES($1,$2,$3,$4,$5,$6,$7,TRUE)',[r.id,r.name,r.short_name,r.type,r.state,r.city,r.website_url]);}
  for(const x of result.structures.parents){const r=x.record;await c.query(`INSERT INTO ${x.table}(id,institution_id,name,code) VALUES($1,$2,$3,$4)`,[r.id,r.institution_id,r.name,r.code]);}
  for(const x of result.structures.departments){const r=x.record;const key=r.faculty_id?'faculty_id':'school_id';await c.query(`INSERT INTO departments(id,${key},name,code) VALUES($1,$2,$3,$4)`,[r.id,r[key],r.name,r.code]);}
  for(const x of result.updates){const keys=Object.keys(x.values);await c.query(`UPDATE institutions SET ${keys.map((k,i)=>`${k}=$${i+2}`).join(',')} WHERE id=$1`,[x.id,...keys.map(k=>x.values[k])]);}
 }
 // Save the exact plan before commit; a write failure rolls the transaction back.
 fs.writeFileSync(file,JSON.stringify({mode:apply?'apply':'dry-run',transaction_status:'prepared',checked_at:dataset.checked_at,...result},null,2),{flag:'wx',mode:0o600});
 await c.query(apply?'COMMIT':'ROLLBACK');
 console.log(`${apply?'Committed':'Preview only'}: ${result.inserts.length} additions, ${result.updates.length} blank-field updates, ${result.held.length} held for review.`);
 console.log(`Structure additions: ${result.structures.parents.length} faculties/schools, ${result.structures.departments.length} departments; ${result.structures.held.length} structures held.`);
 console.log('Report:',file);if(apply)console.log('Previous academic records:',backup);
 console.log('No existing IDs, nonempty fields, faculties, schools, departments or courses were replaced.');
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}})().catch(e=>{console.error('Import failed:',e.message);process.exitCode=1;pool.end();});
