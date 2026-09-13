#!/usr/bin/env node

require('dotenv').config({
  path: '/var/www/kampuslearn/backend/.env'
});

const {
  pool
} = require('/var/www/kampuslearn/backend/src/config/database');

const APPLY = process.argv.includes('--apply');

function norm(value='') {
  return value
    .toLowerCase()
    .replace(/&/g,'and')
    .replace(/\btechnology\b/g,'')
    .replace(/\btechnologies\b/g,'')
    .replace(/\bengineering\b/g,'engineering')
    .replace(/\bmanagement\b/g,'management')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function tokens(value='') {
  return new Set(
    norm(value)
      .split(' ')
      .filter(x => x.length > 2)
  );
}

function similarity(a,b) {
  const A=tokens(a);
  const B=tokens(b);

  if (!A.size || !B.size) return 0;

  const shared=[...A].filter(x=>B.has(x)).length;
  const union=new Set([...A,...B]).size;

  return shared/union;
}

(async()=>{

  const client=await pool.connect();

  try{
    await client.query('BEGIN');

    const programmes=await client.query(`
      SELECT
        ap.id,
        ap.institution_id,
        ap.name,
        ap.award_type,
        i.name AS institution_name
      FROM academic_programmes ap
      JOIN institutions i
        ON i.id=ap.institution_id
      WHERE i.type='polytechnic'
        AND ap.is_active=TRUE
        AND ap.award_type IN ('ND','HND')
        AND EXISTS (
          SELECT 1
          FROM schools s
          JOIN departments d
            ON d.school_id=s.id
          WHERE s.institution_id=ap.institution_id
        )
      ORDER BY i.name,ap.name,ap.award_type
    `);

    let mapped=0;
    let held=0;
    let links=0;

    const holds=[];

    for(const p of programmes.rows){

      const depts=await client.query(`
        SELECT
          d.id,
          d.name
        FROM departments d
        JOIN schools s ON s.id=d.school_id
        WHERE s.institution_id=$1
        ORDER BY d.name
      `,[p.institution_id]);

      const scored=depts.rows
        .map(d=>({
          ...d,
          score:similarity(p.name,d.name)
        }))
        .sort((a,b)=>b.score-a.score);

      const best=scored[0];
      const second=scored[1];

      const strong =
        best &&
        (
          norm(p.name) === norm(best.name) ||
          best.score >= 0.50
        );

      const ambiguous =
        second &&
        Math.abs(best.score-second.score) < 0.10;

      if (!strong || ambiguous) {
        held++;
        holds.push({
          institution:p.institution_name,
          programme:p.name,
          award:p.award_type,
          best:best?.name || null,
          score:best?.score || 0,
          second:second?.name || null,
          second_score:second?.score || 0
        });
        continue;
      }

      const levels =
        p.award_type === 'ND'
          ? ['ND1','ND2']
          : ['HND1','HND2'];

      const courses=await client.query(`
        SELECT
          id,
          level,
          semester
        FROM courses
        WHERE department_id=$1
          AND level = ANY($2::varchar[])
          AND is_active=TRUE
      `,[best.id,levels]);

      if (!courses.rowCount) {
        held++;
        holds.push({
          institution:p.institution_name,
          programme:p.name,
          award:p.award_type,
          best:best.name,
          score:best.score,
          reason:'matched department has no courses'
        });
        continue;
      }

      mapped++;

      for(const c of courses.rows){

        const r=await client.query(`
          INSERT INTO programme_courses
            (
              programme_id,
              course_id,
              level,
              semester,
              is_core,
              source_type,
              checked_at
            )
          VALUES
            ($1,$2,$3,$4,TRUE,'legacy_template',$5)
          ON CONFLICT
            (programme_id,course_id,level)
          DO NOTHING
          RETURNING programme_id
        `,[
          p.id,
          c.id,
          c.level,
          c.semester,
          '2026-09-12'
        ]);

        links += r.rowCount;
      }
    }

    console.log('\n=== LEGACY PROGRAMME MAPPER ===');
    console.log('Programmes considered:',programmes.rowCount);
    console.log('Mapped:',mapped);
    console.log('Held:',held);
    console.log('New links:',links);

    console.log('\n=== HOLDS ===');
    console.table(holds.slice(0,100));

    const summary=await client.query(`
      SELECT
        i.name AS institution,
        COUNT(DISTINCT pc.programme_id)::int AS programmes,
        COUNT(*)::int AS links
      FROM programme_courses pc
      JOIN academic_programmes ap
        ON ap.id=pc.programme_id
      JOIN institutions i
        ON i.id=ap.institution_id
      WHERE pc.source_type='legacy_template'
      GROUP BY i.id,i.name
      ORDER BY i.name
    `);

    console.log('\n=== RESULT ===');
    console.table(summary.rows);

    if (APPLY) {
      await client.query('COMMIT');
      console.log('\nCOMMITTED');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDRY RUN — ROLLED BACK');
    }

  }catch(e){
    try{await client.query('ROLLBACK');}catch{}
    console.error(e);
    process.exitCode=1;
  }finally{
    client.release();
    await pool.end();
  }
})();
