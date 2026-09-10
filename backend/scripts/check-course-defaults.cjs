'use strict';
const assert=require('node:assert/strict');
const {plan}=require('../src/services/courseDefaults');
const catalogue=require('../data/course-defaults/catalogue.json');
const templates=require('../data/shared-academics/templates.json');
const snapshot=require('../data/shared-academics/snapshot.json');
const academic=require('../src/services/academicTemplates');
const norm=s=>s.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
const keys=new Set();
for(const p of catalogue.profiles){
 assert.ok(!keys.has(p.key));keys.add(p.key);assert.equal(p.courses.length,8);
 const codes=new Set();
 for(const c of p.courses){assert.ok(c.code.startsWith('KL-'));assert.ok(c.code.length<=20);assert.ok(!codes.has(c.code));codes.add(c.code);assert.equal(c.level_type,p.type);assert.ok(['first','second'].includes(c.semester));assert.ok(c.title.length<=180);assert.equal(c.credit_units,2);}
}
for(const [type,t] of Object.entries(templates.templates))for(const u of t.units)for(const d of u.departments)assert.equal(catalogue.profiles.filter(p=>p.type===type&&(norm(p.name)===norm(d.name)||p.source_code===d.code)).length,1);
const additions=academic.plan({...snapshot,assignments:[]});
const current={...snapshot,course_assignments:[]};for(const t of ['faculties','schools','departments','courses'])current[t]=[...snapshot[t],...additions[t]];
const result=plan(current);
assert.equal(result.review.length,0);assert.equal(result.assignments.length,current.departments.filter(d=>!/^test\b/i.test(d.name)).length);
const repeat=plan({...current,courses:[...current.courses,...result.courses.slice(1)],course_assignments:result.assignments});
assert.equal(repeat.courses.length,0);assert.equal(repeat.assignments.length,0);
console.log('Course default checks passed. No database connection or writes.');
console.log(`${catalogue.profiles.length} department profiles; 8 subject courses plus 4 common courses per recognised department, retaining existing matching titles/codes.`);
console.log(`Projected seeded-snapshot plan: ${result.assignments.length} departments, ${result.courses.length} course additions; ${result.review.length} profiles for review.`);
