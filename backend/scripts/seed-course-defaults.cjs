'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const {getClient,pool}=require('../src/config/database');
const {plan,readCurrent,writePlan}=require('../src/services/courseDefaults');
const args=process.argv.slice(2);
if(args.length>1||args.some(x=>!['--apply','--dry-run'].includes(x)))throw Error('Use --dry-run or --apply');
const apply=args.includes('--apply');
(async()=>{const c=await getClient();try{
 await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");
 await c.query('LOCK TABLE institutions,faculties,schools,departments,courses,course_default_assignments IN SHARE ROW EXCLUSIVE MODE');
 const before=await readCurrent(c),result=plan(before);
 const dir=path.join(os.homedir(),'kampuslearn-import-reports');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const stamp=Date.now(),report=path.join(dir,`course-defaults-${stamp}-${apply?'apply':'dry-run'}.json`),backup=path.join(dir,`course-defaults-before-${stamp}.json`);
 if(apply){fs.writeFileSync(backup,JSON.stringify(before,null,2),{flag:'wx',mode:0o600});await writePlan(c,result);}
 fs.writeFileSync(report,JSON.stringify({mode:apply?'apply':'dry-run',transaction_status:'prepared',...result},null,2),{flag:'wx',mode:0o600});
 await c.query(apply?'COMMIT':'ROLLBACK');
 try {fs.writeFileSync(report,JSON.stringify({mode:apply?'apply':'dry-run',transaction_status:apply?'committed':'preview',...result},null,2),{mode:0o600});}
 catch(e){console.warn('Database operation completed, but report status could not be updated:',e.message);}
 console.log(`${apply?'Committed':'Preview only'}: ${result.assignments.length} departments processed; ${result.courses.length} starter courses added.`);
 console.log(`${result.skipped.length} departments skipped; ${result.review.length} department profiles need frontend review (common courses supplied where possible).`);
 console.log('Report:',report);if(apply)console.log('Backup:',backup);
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
