'use strict';

const data = require('../data/academic-reference/institutions.json');

const norm = s => String(s || '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]/g, '');

const rows = data.institutions || [];

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./,'').toLowerCase();
  } catch {
    return '';
  }
}

const nbte = rows.filter(x => String(x.source_key || '').startsWith('nbte:'));
const nuc  = rows.filter(x => String(x.source_key || '').startsWith('nuc:'));

console.log('\n=== SOURCE COUNTS ===');
console.table([
  { source: 'NUC', count: nuc.length },
  { source: 'NBTE', count: nbte.length }
]);

console.log('\n=== NBTE OWNERSHIP ===');
const owners = {};
for (const x of nbte) {
  const key = x.ownership || '(missing)';
  owners[key] = (owners[key] || 0) + 1;
}
console.table(
  Object.entries(owners).map(([ownership,count]) => ({ownership,count}))
);

console.log('\n=== NORMALIZED NAME DUPLICATES ===');
const names = new Map();

for (const x of rows) {
  const key = `${x.type}:${norm(x.name)}`;
  if (!names.has(key)) names.set(key, []);
  names.get(key).push(x);
}

const nameDupes = [...names.values()].filter(x => x.length > 1);

for (const group of nameDupes) {
  console.log('\n---');
  console.table(group.map(x => ({
    source_key: x.source_key,
    name: x.name,
    type: x.type,
    state: x.state,
    ownership: x.ownership
  })));
}

console.log('\nNormalized duplicate groups:', nameDupes.length);

console.log('\n=== WEBSITE COLLISIONS ===');
const websites = new Map();

for (const x of rows) {
  const h = host(x.website_url);
  if (!h) continue;

  if (!websites.has(h)) websites.set(h, []);
  websites.get(h).push(x);
}

const websiteDupes = [...websites.entries()]
  .filter(([,group]) => group.length > 1);

for (const [h, group] of websiteDupes) {
  console.log('\nWebsite:', h);
  console.table(group.map(x => ({
    source_key: x.source_key,
    name: x.name,
    type: x.type,
    state: x.state
  })));
}

console.log('\nWebsite collision groups:', websiteDupes.length);

console.log('\n=== MISSING STATE ===');
const missingState = rows.filter(x => !x.state);

console.log('Missing state:', missingState.length);

console.table(
  missingState.slice(0, 100).map(x => ({
    source_key: x.source_key,
    name: x.name,
    type: x.type,
    ownership: x.ownership
  }))
);
