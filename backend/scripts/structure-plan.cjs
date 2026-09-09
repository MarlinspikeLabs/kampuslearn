'use strict';
const {norm,stableId}=require('./academic-plan.cjs');
function planStructures(current,dataset){
 const result={parents:[],departments:[],held:[],unchanged:[]};
 const faculties=current.faculties.map(x=>({...x})),schools=current.schools.map(x=>({...x}));
 const departments=current.departments.map(x=>({...x}));
 const owner=d=>faculties.find(f=>f.id===d.faculty_id)?.institution_id||schools.find(s=>s.id===d.school_id)?.institution_id;
 const matches=(name,aliases,row)=>[name,...(aliases||[])].map(norm).includes(norm(row.name));
 for(const group of dataset.structures){
  if(!['faculties','schools'].includes(group.table)||!group.name||!/^https:\/\//.test(group.source_url))throw new Error('Invalid structure reference');
  const inst=current.institutions.filter(i=>matches(group.institution_name,group.institution_aliases,i));
  const entry={name:group.name,institution:group.institution_name,source_url:group.source_url};
  if(inst.length!==1){result.held.push({...entry,reason:'Institution is missing or ambiguous'});continue;}
  const i=inst[0];if(i.type!==(group.table==='faculties'?'university':'polytechnic')){result.held.push({...entry,reason:'Institution type conflict'});continue;}
  const parents=group.table==='faculties'?faculties:schools;const key=group.table==='faculties'?'faculty_id':'school_id';
  const found=parents.filter(p=>p.institution_id===i.id&&matches(group.name,group.aliases,p));
  if(found.length>1){result.held.push({...entry,reason:'Multiple existing parent records'});continue;}
  let parent=found[0];
  if(!parent){
   const overlaps=departments.filter(d=>owner(d)===i.id&&group.departments.some(n=>matches(n.name,n.aliases,d)));
   if(overlaps.length){result.held.push({...entry,reason:'Possible faculty/school reorganisation; matching departments already belong elsewhere',department_ids:overlaps.map(d=>d.id)});continue;}
   const id=stableId(i.id+':'+group.table+':'+norm(group.name));
   parent={id,institution_id:i.id,name:group.name,code:'R'+id.replaceAll('-','').slice(0,9)};
   if(parents.some(p=>p.institution_id===i.id&&p.code===parent.code)){result.held.push({...entry,reason:'Generated internal code collision'});continue;}
   parents.push(parent);result.parents.push({...entry,table:group.table,record:parent});
  }
  for(const name of group.departments){
   const item={name:name.name,institution:i.name,parent:parent.name,source_url:group.source_url};
   const found=departments.filter(d=>owner(d)===i.id&&matches(name.name,name.aliases,d));
   if(found.length){
    if(found.length===1&&found[0][key]===parent.id)result.unchanged.push({...item,id:found[0].id});
    else result.held.push({...item,reason:'Existing department belongs elsewhere or has duplicates',ids:found.map(d=>d.id)});
    continue;
   }
   const id=stableId(parent.id+':department:'+norm(name.name));const record={id,[key]:parent.id,name:name.name,code:'R'+id.replaceAll('-','').slice(0,9)};
   if(departments.some(d=>d[key]===parent.id&&d.code===record.code)){result.held.push({...item,reason:'Generated internal code collision'});continue;}
   departments.push(record);result.departments.push({...item,record});
  }
 }
 return result;
}
module.exports={planStructures};
