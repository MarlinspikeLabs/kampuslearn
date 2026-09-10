'use strict';
const crypto=require('node:crypto');
const catalogue=require('../../data/course-defaults/catalogue.json');
const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const makeId=s=>{const h=crypto.createHash('sha256').update('kl-course-default:'+s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};

function plan(current){
 const result={courses:[],assignments:[],skipped:[],review:[]};
 const institutions=new Map(current.institutions.map(x=>[x.id,x]));
 const units=new Map([...current.faculties,...current.schools].map(x=>[x.id,x.institution_id]));
 const assigned=new Set((current.course_assignments||[]).map(x=>x.department_id));
 const byDepartment=new Map();
 for(const c of current.courses){if(!byDepartment.has(c.department_id))byDepartment.set(c.department_id,[]);byDepartment.get(c.department_id).push(c);}
 for(const d of current.departments){
  if(assigned.has(d.id)){result.skipped.push({department_id:d.id,reason:'Already seeded; local edits retained'});continue;}
  if(/^test\b/i.test(d.name)){result.skipped.push({department_id:d.id,reason:'Test department excluded'});continue;}
  const i=institutions.get(units.get(d.faculty_id||d.school_id));
  if(!i||!catalogue.common[i.type]){result.review.push({department_id:d.id,name:d.name,reason:'Missing institution or unsupported institution type'});continue;}
  const matches=catalogue.profiles.filter(p=>p.type===i.type&&(p.aliases.some(n=>norm(n)===norm(d.name))||norm(p.source_code)===norm(d.code)));
  const profile=matches.length===1?matches[0]:null;
  if(!profile)result.review.push({department_id:d.id,name:d.name,institution:i.name,reason:matches.length?'Ambiguous subject profile; common courses only':'No subject profile; common courses only'});
  const existing=byDepartment.get(d.id)||[];
  const codes=new Set(existing.map(x=>norm(x.code))),titles=new Set(existing.map(x=>norm(x.title)));
  let added=0,retained=0;
  for(const source of [...catalogue.common[i.type],...(profile?.courses||[])]){
   if(codes.has(norm(source.code))||titles.has(norm(source.title))){retained++;continue;}
   const {key,...record}=source;
   result.courses.push({id:makeId(d.id+':'+source.code),department_id:d.id,...record});
   codes.add(norm(source.code));titles.add(norm(source.title));added++;
  }
  result.assignments.push({department_id:d.id,profile_key:profile?.key||i.type+':common',template_version:catalogue.version,summary:{added,retained}});
 }
 return result;
}

async function readCurrent(client,institutionId){
 const data={},p=institutionId?[institutionId]:[];
 data.institutions=(await client.query('SELECT id,name,type FROM institutions'+(institutionId?' WHERE id=$1':'')+' ORDER BY id',p)).rows;
 for(const t of ['faculties','schools'])data[t]=(await client.query(`SELECT id,institution_id FROM ${t}`+(institutionId?' WHERE institution_id=$1':''),p)).rows;
 const joins=' FROM departments d LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id';
 const where=institutionId?' WHERE COALESCE(f.institution_id,s.institution_id)=$1':'';
 data.departments=(await client.query('SELECT d.id,d.name,d.code,d.faculty_id,d.school_id'+joins+where,p)).rows;
 data.courses=(await client.query('SELECT c.id,c.department_id,c.title,c.code,c.level,c.level_type,c.semester,c.credit_units,c.is_active FROM courses c JOIN departments d ON d.id=c.department_id LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id'+where,p)).rows;
 data.course_assignments=(await client.query('SELECT a.department_id,a.profile_key,a.template_version,a.summary FROM course_default_assignments a JOIN departments d ON d.id=a.department_id LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id'+where,p)).rows;
 return data;
}

async function writePlan(client,result){
 for(const [key,table,keys] of [
  ['courses','courses',['id','department_id','title','code','level','level_type','semester','credit_units','is_active']],
  ['assignments','course_default_assignments',['department_id','profile_key','template_version','summary']]
 ])for(let offset=0;offset<result[key].length;offset+=200){
  const values=[];const rows=result[key].slice(offset,offset+200).map(r=>'('+keys.map(k=>{values.push(k==='summary'?JSON.stringify(r[k]):r[k]);return '$'+values.length;}).join(',')+')');
  await client.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES ${rows.join(',')}`,values);
 }
}

async function seedInstitutionCourses(client,institutionId,departmentId){
 // The caller owns a transaction. Serialise seeding within an institution.
 await client.query('SELECT id FROM institutions WHERE id=$1 FOR UPDATE',[institutionId]);
 const current=await readCurrent(client,institutionId);
 if(departmentId)current.departments=current.departments.filter(d=>d.id===departmentId);
 const result=plan(current);await writePlan(client,result);return result;
}
module.exports={plan,readCurrent,writePlan,seedInstitutionCourses};
