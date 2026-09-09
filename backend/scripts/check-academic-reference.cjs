'use strict';
// Dependency-free offline checks. Does not connect to PostgreSQL or modify files.
const assert=require('node:assert/strict');
const {plan}=require('./academic-plan.cjs');
const {planStructures}=require('./structure-plan.cjs');
const snapshot=require('../data/academic-snapshots/2026-09-09.json');
const dataset=require('../data/academic-reference/institutions.json');
const structures=require('../data/academic-reference/structures.json');
const original=JSON.stringify(snapshot);
const first=plan(snapshot.institutions,dataset);
assert.equal(JSON.stringify(snapshot),original,'Planning must not mutate the snapshot');
const next=snapshot.institutions.map(x=>({...x,...first.updates.find(u=>u.id===x.id)?.values})).concat(first.inserts.map(x=>x.record));
const second=plan(next,dataset);
assert.equal(second.inserts.length,0,'Repeated planning must not add duplicates');
assert.equal(second.updates.length,0,'Repeated planning must not change populated fields');
const groups=planStructures(snapshot,structures);
const after={...snapshot,faculties:snapshot.faculties.concat(groups.parents.filter(x=>x.table==='faculties').map(x=>x.record)),schools:snapshot.schools.concat(groups.parents.filter(x=>x.table==='schools').map(x=>x.record)),departments:snapshot.departments.concat(groups.departments.map(x=>x.record))};
const again=planStructures(after,structures);assert.equal(again.parents.length,0);assert.equal(again.departments.length,0);
for(const update of first.updates){const old=snapshot.institutions.find(x=>x.id===update.id);assert.ok(old);for(const key of Object.keys(update.values))assert.ok(old[key]==null||String(old[key]).trim()==='','Only blank fields can be updated');}
console.log('Academic reference checks passed. No database connection or writes.');
console.log(`Snapshot plan: ${first.inserts.length} institution additions, ${first.updates.length} blank-field updates, ${first.held.length} held.`);
console.log(`Structure plan: ${groups.parents.length} faculties/schools and ${groups.departments.length} departments added; ${groups.held.length} held.`);
