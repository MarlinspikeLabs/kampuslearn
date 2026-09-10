'use strict';
const assert=require('node:assert/strict');
const {plan}=require('../src/services/academicTemplates');
const templates=require('../data/shared-academics/templates.json');
const snapshot=require('../data/shared-academics/snapshot.json');
for(const [type,t] of Object.entries(templates.templates)){
 const codes=new Set();
 for(const u of t.units){
  assert.ok(u.name&&u.code);assert.ok(!codes.has(u.code));codes.add(u.code);
  for(const d of u.departments){
   assert.ok(d.name&&d.code);assert.ok(!/^test\b/i.test(d.name));
   for(const c of d.courses){assert.ok(c.title&&c.code);assert.equal(c.level_type,type);assert.ok(!/^test\b/i.test(c.title));assert.ok(['first','second'].includes(c.semester));}
  }
 }
}
const current={...snapshot,assignments:[]},p=plan(current);
assert.equal(p.assignments.length,117);assert.equal(p.conflicts.length,0);
const after={...current};for(const t of ['faculties','schools','departments','courses','assignments'])after[t]=[...current[t],...p[t]];
// Admin changes are retained once an institution has received its defaults.
after.courses=after.courses.filter(x=>x.id!==p.courses[0].id);
const repeat=plan(after);
for(const t of ['faculties','schools','departments','courses','assignments'])assert.equal(repeat[t].length,0);
console.log('Shared academic checks passed. No database connection or writes.');
console.log(`Snapshot preview: ${p.assignments.length} institutions; ${p.faculties.length} faculties, ${p.schools.length} schools, ${p.departments.length} departments, ${p.courses.length} courses added.`);
console.log('Repeat seeding preserves subsequent admin edits and deletions.');
