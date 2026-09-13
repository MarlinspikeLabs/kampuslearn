#!/usr/bin/env node

require('dotenv').config({
  path:'/var/www/kampuslearn/backend/.env'
});

const crypto=require('crypto');

const {
  pool
}=require('/var/www/kampuslearn/backend/src/config/database');

const APPLY=process.argv.includes('--apply');

function uuidFrom(seed){
  const hex=crypto
    .createHash('sha256')
    .update(seed)
    .digest('hex')
    .slice(0,32);

  return [
    hex.slice(0,8),
    hex.slice(8,12),
    '5'+hex.slice(13,16),
    'a'+hex.slice(17,20),
    hex.slice(20,32)
  ].join('-');
}

function cleanProgrammeName(name){
  return String(name)
    .replace(/\s+/g,' ')
    .trim();
}

function shortCode(name){
  const stop=new Set([
    'and','of','the','in','for','with',
    'technology','technologies',
    'management'
  ]);

  let letters=name
    .replace(/&/g,' and ')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .filter(x=>!stop.has(x.toLowerCase()))
    .map(x=>x[0].toUpperCase())
    .join('')
    .slice(0,4);

  if(letters.length<2){
    letters=name
      .replace(/[^A-Za-z]/g,'')
      .slice(0,3)
      .toUpperCase();
  }

  return letters || 'GEN';
}

function templates(award,name){

  if(award==='ND'){
    return [
      {
        level:'ND1',
        semester:'first',
        n:1,
        title:`Introduction to ${name}`
      },
      {
        level:'ND1',
        semester:'first',
        n:2,
        title:'Communication Skills and Study Methods'
      },
      {
        level:'ND1',
        semester:'second',
        n:3,
        title:`Principles of ${name}`
      },
      {
        level:'ND1',
        semester:'second',
        n:4,
        title:'Digital Literacy and Entrepreneurship'
      },

      {
        level:'ND2',
        semester:'first',
        n:1,
        title:`Intermediate ${name}`
      },
      {
        level:'ND2',
        semester:'first',
        n:2,
        title:'Research Methods and Professional Practice'
      },
      {
        level:'ND2',
        semester:'second',
        n:3,
        title:`Applied ${name}`
      },
      {
        level:'ND2',
        semester:'second',
        n:4,
        title:'Project and Industrial Practice'
      }
    ];
  }

  return [
    {
      level:'HND1',
      semester:'first',
      n:1,
      title:`Advanced Principles of ${name}`
    },
    {
      level:'HND1',
      semester:'first',
      n:2,
      title:'Research Methods and Professional Practice'
    },
    {
      level:'HND1',
      semester:'second',
      n:3,
      title:`Advanced Applications of ${name}`
    },
    {
      level:'HND1',
      semester:'second',
      n:4,
      title:'Entrepreneurship and Innovation'
    },

    {
      level:'HND2',
      semester:'first',
      n:1,
      title:`Contemporary Issues in ${name}`
    },
    {
      level:'HND2',
      semester:'first',
      n:2,
      title:'Project Planning and Professional Ethics'
    },
    {
      level:'HND2',
      semester:'second',
      n:3,
      title:`Special Topics in ${name}`
    },
    {
      level:'HND2',
      semester:'second',
      n:4,
      title:'Final Project'
    }
  ];
}

function courseCode(programme,level,n){

  const prefix=shortCode(programme);

  const levelCode={
    ND1:'1',
    ND2:'2',
    HND1:'3',
    HND2:'4'
  }[level];

  return `KL-${prefix}${levelCode}0${n}`;
}

(async()=>{

  const client=await pool.connect();

  try{

    await client.query('BEGIN');

    const programmes=await client.query(`
      SELECT
        ap.id,
        ap.name,
        ap.award_type,
        ap.institution_id,
        i.name AS institution_name
      FROM academic_programmes ap
      JOIN institutions i
        ON i.id=ap.institution_id
      WHERE i.type='polytechnic'
        AND ap.award_type IN ('ND','HND')
        AND ap.is_active=TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM programme_courses existing_pc
          WHERE existing_pc.programme_id = ap.id
        )
      ORDER BY i.name,ap.name,ap.award_type
    `);

    let insertedCourses=0;
    let insertedLinks=0;
    let skippedExisting=0;

    const institutionCounts=new Map();

    for(const p of programmes.rows){

      const programmeName=cleanProgrammeName(p.name);
      const list=templates(
        p.award_type,
        programmeName
      );

      for(const t of list){

        /*
         * If this programme already has a verified
         * or legacy course mapped for this exact level,
         * don't overwrite anything.
         *
         * Generic courses can coexist with existing
         * mappings, but we avoid duplicating a generic
         * seed on repeated runs.
         */

        const id=uuidFrom(
          `kampuslearn:generic-course:${p.id}:${t.level}:${t.n}`
        );

        const code=courseCode(
          programmeName,
          t.level,
          t.n
        );

        const exists=await client.query(`
          SELECT id
          FROM courses
          WHERE id=$1
        `,[id]);

        if(!exists.rowCount){

          await client.query(`
            INSERT INTO courses
            (
              id,
              department_id,
              title,
              code,
              credit_units,
              level,
              level_type,
              semester,
              description,
              is_active,
              curriculum_source,
              is_verified
            )
            VALUES
            (
              $1,
              NULL,
              $2,
              $3,
              2,
              $4,
              'polytechnic',
              $5,
              $6,
              TRUE,
              'generic_seed',
              FALSE
            )
          `,[
            id,
            t.title,
            code,
            t.level,
            t.semester,
            `General KampusLearn seed for ${programmeName}. Replace with verified curriculum when available.`
          ]);

          insertedCourses++;

        }else{
          skippedExisting++;
        }

        const link=await client.query(`
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
          (
            $1,$2,$3,$4,TRUE,
            'generic_seed',
            CURRENT_DATE
          )
          ON CONFLICT
            (programme_id,course_id,level)
          DO NOTHING
          RETURNING programme_id
        `,[
          p.id,
          id,
          t.level,
          t.semester
        ]);

        insertedLinks+=link.rowCount;
      }

      institutionCounts.set(
        p.institution_name,
        (institutionCounts.get(p.institution_name)||0)+1
      );
    }

    console.log('\n=== GENERIC POLYTECHNIC COURSE SEED ===');
    console.log('Active programmes:',programmes.rowCount);
    console.log('Courses inserted:',insertedCourses);
    console.log('Links inserted:',insertedLinks);
    console.log('Existing deterministic courses:',skippedExisting);
    console.log('Institutions:',institutionCounts.size);

    const totals=await client.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE curriculum_source='generic_seed'
        )::int AS generic_courses,

        COUNT(DISTINCT pc.programme_id) FILTER (
          WHERE pc.source_type='generic_seed'
        )::int AS programmes_with_generic_courses,

        COUNT(*) FILTER (
          WHERE pc.source_type='generic_seed'
        )::int AS generic_links

      FROM courses c
      LEFT JOIN programme_courses pc
        ON pc.course_id=c.id
    `);

    console.log('\n=== RESULT ===');
    console.table(totals.rows);

    if(APPLY){
      await client.query('COMMIT');
      console.log('\nCOMMITTED');
    }else{
      await client.query('ROLLBACK');
      console.log('\nDRY RUN — ROLLED BACK');
    }

  }catch(e){

    try{
      await client.query('ROLLBACK');
    }catch{}

    console.error(e);
    process.exitCode=1;

  }finally{

    client.release();
    await pool.end();

  }

})();
