'use strict';
const crypto=require('node:crypto');
const templates=require('../../data/shared-academics/templates.json');
const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const idFor=s=>{const h=crypto.createHash('sha256').update('kl-starter:'+s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const same=(a,b)=>norm(a.name)===norm(b.name)||norm(a.code)===norm(b.code);

function plan(current){
 const result={faculties:[],schools:[],departments:[],courses:[],assignments:[],skipped:[],conflicts:[]};
 for(const institution of current.institutions){
  if(current.assignments.some(x=>x.institution_id===institution.id)){result.skipped.push({id:institution.id,name:institution.name,reason:'Already seeded; local edits preserved'});continue;}
  const template=templates.templates[institution.type];
  if(!template){result.skipped.push({id:institution.id,name:institution.name,reason:'Unsupported institution type'});continue;}
  const units=current[template.table].filter(x=>x.institution_id===institution.id).map(x=>({...x}));
  const parentIds=new Set([...current.faculties,...current.schools].filter(x=>x.institution_id===institution.id).map(x=>x.id));
  const departments=current.departments.filter(x=>parentIds.has(x.faculty_id)||parentIds.has(x.school_id)).map(x=>({...x}));
  const courses=current.courses.filter(x=>departments.some(d=>d.id===x.department_id)).map(x=>({...x}));
  const summary={units:0,departments:0,courses:0,conflicts:0};
  const conflict=(name,reason)=>{summary.conflicts++;result.conflicts.push({institution_id:institution.id,institution:institution.name,name,reason});};
  const key=template.table==='faculties'?'faculty_id':'school_id';
  for(const source of template.units){
   let found=units.filter(x=>same(x,source));
   if(found.length>1){conflict(source.name,'Multiple matching academic units; left unchanged');continue;}
   let unit=found[0];
   if(!unit){unit={id:idFor(institution.id+':unit:'+norm(source.name)),institution_id:institution.id,name:source.name,code:source.code};units.push(unit);result[template.table].push(unit);summary.units++;}
   for(const sd of source.departments){
    // Reuse local departments even if an admin assigned a different faculty.
    found=departments.filter(x=>same(x,sd));
    if(found.length>1){conflict(sd.name,'Multiple matching departments; left unchanged');continue;}
    let department=found[0];
    if(!department){department={id:idFor(institution.id+':department:'+norm(sd.name)),faculty_id:null,school_id:null,[key]:unit.id,name:sd.name,code:sd.code};departments.push(department);result.departments.push(department);summary.departments++;}
    for(const sc of sd.courses){
     if(courses.some(x=>x.department_id===department.id&&norm(x.code)===norm(sc.code)))continue;
     const course={id:idFor(department.id+':course:'+norm(sc.code)),department_id:department.id,...sc};courses.push(course);result.courses.push(course);summary.courses++;
    }
   }
  }
  result.assignments.push({institution_id:institution.id,template_key:institution.type,template_version:templates.version,summary});
 }
 return result;
}

async function readCurrent(client,institutionId){
 const data={};const p=institutionId?[institutionId]:[];
 data.institutions=(await client.query('SELECT id,name,short_name,type FROM institutions'+(institutionId?' WHERE id=$1':'')+' ORDER BY id',p)).rows;
 for(const t of ['faculties','schools'])data[t]=(await client.query(`SELECT id,institution_id,name,code FROM ${t}`+(institutionId?' WHERE institution_id=$1':''),p)).rows;
 data.departments=(await client.query(`SELECT d.id,d.faculty_id,d.school_id,d.name,d.code FROM departments d`+(institutionId?' LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id WHERE COALESCE(f.institution_id,s.institution_id)=$1':''),p)).rows;
 data.courses=(await client.query(`SELECT c.id,c.department_id,c.title,c.code,c.level,c.level_type,c.semester,c.credit_units,c.is_active FROM courses c`+(institutionId?' JOIN departments d ON d.id=c.department_id LEFT JOIN faculties f ON f.id=d.faculty_id LEFT JOIN schools s ON s.id=d.school_id WHERE COALESCE(f.institution_id,s.institution_id)=$1':''),p)).rows;
 data.assignments=(await client.query('SELECT institution_id,template_key,template_version,summary FROM academic_template_assignments'+(institutionId?' WHERE institution_id=$1':''),p)).rows;
 return data;
}

async function writePlan(client,result){
 const columns={faculties:['id','institution_id','name','code'],schools:['id','institution_id','name','code'],departments:['id','faculty_id','school_id','name','code'],courses:['id','department_id','title','code','level','level_type','semester','credit_units','is_active'],assignments:['institution_id','template_key','template_version','summary']};
 for(const [key,keys] of Object.entries(columns)){
  const table=key==='assignments'?'academic_template_assignments':key;
  for(let offset=0;offset<result[key].length;offset+=200){
   const values=[];const rows=result[key].slice(offset,offset+200).map(r=>'('+keys.map(k=>{values.push(k==='summary'?JSON.stringify(r[k]):r[k]);return '$'+values.length;}).join(',')+')');
   await client.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES ${rows.join(',')}`,values);
  }
 }
}

async function seedInstitution(client,institutionId){
 // Caller owns the transaction; the marker commits together with all children.
 await client.query('SELECT id FROM institutions WHERE id=$1 FOR UPDATE',[institutionId]);
 const result=plan(await readCurrent(client,institutionId));
 await writePlan(client,result);
 await require('./courseDefaults').seedInstitutionCourses(client,institutionId);
 return result.assignments[0]?.summary||{already_seeded:true};
}
module.exports={plan,readCurrent,writePlan,seedInstitution};

