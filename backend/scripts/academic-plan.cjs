'use strict';
const crypto=require('node:crypto');
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/&/g,'and').replace(/univeristy/g,'university').replace(/[^a-z0-9]/g,'');
const empty=v=>v==null||String(v).trim()==='';
const host=s=>{try{return new URL(s).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
const stableId=s=>{const b=crypto.createHash('sha256').update('kampuslearn-academic:'+s).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
function plan(current,dataset){
 const result={inserts:[],updates:[],held:[],unchanged:[],duplicates:[],coverage:[]};
 const rows=current.map(r=>({...r}));const groups=new Map();
 for(const r of current){const n=norm(r.name);groups.set(n,[...(groups.get(n)||[]),r.id]);}
 for(const [name,ids] of groups)if(ids.length>1)result.duplicates.push({name,ids});
 const keys=new Set();
 for(const item of dataset.institutions){
  if(!item.source_key||keys.has(item.source_key))throw new Error('Duplicate or missing source key');keys.add(item.source_key);
  if(!['university','polytechnic'].includes(item.type)||!item.name||!/^https?:\/\//.test(item.source_url))throw new Error('Invalid reference record');
  const names=[item.name,...(item.aliases||[])].map(norm);
  const id=stableId(item.type+':'+norm(item.name));
  const matches=rows.filter(r=>r.id===id||names.includes(norm(r.name)));
  const entry={source_key:item.source_key,name:item.name,source_url:item.source_url};
  result.coverage.push({...entry,missing_fields:item.missing_fields||[],academic_structure_status:item.academic_structure_status});
  if(item.hold_reason){result.held.push({...entry,reason:item.hold_reason});continue;}
  if(matches.length>1){result.held.push({...entry,reason:'Ambiguous identity; existing IDs preserved',ids:matches.map(x=>x.id)});continue;}
  if(matches.length===1){
   const r=matches[0];if(r.type!==item.type){result.held.push({...entry,reason:'Institution type conflict',id:r.id});continue;}
   const values={};for(const k of ['state','city','website_url'])if(empty(r[k])&&!empty(item[k]))values[k]=item[k];
   if(Object.keys(values).length){result.updates.push({...entry,id:r.id,values});Object.assign(r,values);}else result.unchanged.push({...entry,id:r.id});
  }else{
   const sameWebsite=rows.filter(r=>host(item.website_url)&&host(item.website_url)===host(r.website_url));
   if(sameWebsite.length){result.held.push({...entry,reason:'Shared website with differently named institution; verify identity',ids:sameWebsite.map(r=>r.id)});continue;}
   // A containing institution name is a review hint, never an automatic merge.
   const possible=rows.filter(r=>r.type===item.type&&names.some(n=>Math.min(n.length,norm(r.name).length)>15&&(n.includes(norm(r.name))||norm(r.name).includes(n))));
   if(possible.length){result.held.push({...entry,reason:'Possible alternate name; verify before adding',ids:possible.map(x=>x.id)});continue;}
   if(empty(item.state)){result.held.push({...entry,reason:'No verified state available'});continue;}
   if(rows.some(r=>norm(r.short_name)===norm(item.short_name))){result.held.push({...entry,reason:'Reference short name collision'});continue;}
   const record={id,name:item.name,short_name:item.short_name,type:item.type,state:item.state,city:item.city||null,website_url:item.website_url||null};
   result.inserts.push({...entry,record});rows.push(record);
  }
 }
 return result;
}
module.exports={plan,norm,stableId};
