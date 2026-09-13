#!/usr/bin/env node

require('dotenv').config({
  path:'/var/www/kampuslearn/backend/.env'
});

const crypto=require('crypto');

const {
  pool
}=require('/var/www/kampuslearn/backend/src/config/database');

const APPLY=process.argv.includes('--apply');

const TEMPLATE=[
  {
    level:'100',
    semester:'first',
    suffix:'101',
    title:name=>`Introduction to ${name}`
  },
  {
    level:'100',
    semester:'second',
    suffix:'102',
    title:name=>`Foundations of ${name}`
  },
  {
    level:'200',
    semester:'first',
    suffix:'201',
    title:name=>`Intermediate ${name}`
  },
  {
    level:'200',
    semester:'second',
    suffix:'202',
    title:name=>`Methods and Tools in ${name}`
  },
  {
    level:'300',
    semester:'first',
    suffix:'301',
    title:name=>`Applied ${name}`
  },
  {
    level:'300',
    semester:'second',
    suffix:'302',
    title:name=>`Research Methods in ${name}`
  },
  {
    level:'400',
    semester:'first',
    suffix:'401',
    title:name=>`Contemporary Issues in ${name}`
  },
  {
    level:'400',
    semester:'second',
    suffix:'402',
    title:name=>`Project in ${name}`
  }
];

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

function cleanCode(code,name){
  let value=(code||'')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g,'');

  if(value.length>=2)
    return value.slice(0,4);

  value=(name||'DEP')
    .toUpperCase()
    .replace(/[^A-Z]/g,'')
    .slice(0,3);

  return value||'DEP';
}

(async()=>{

  const client=await pool.connect();

  try{

    await client.query('BEGIN');

    const departments=await client.query(`
      SELECT
        d.id,
        d.name,
        d.code,
        f.institution_id,
        i.name AS institution_name
      FROM departments d
      JOIN faculties f
        ON f.id=d.faculty_id
      JOIN institutions i
        ON i.id=f.institution_id
      WHERE i.type='university'
        AND i.is_active=TRUE
        AND d.structure_source='generic_seed'
      ORDER BY i.name,d.name
    `);

    let inserted=0;
    let existing=0;

    const collisions=[];

    for(const d of departments.rows){

      const prefix=cleanCode(d.code,d.name);

      for(const t of TEMPLATE){

        const code=`${prefix}${t.suffix}`;
        const title=t.title(d.name);

        const present=await client.query(`
          SELECT id,title,code
          FROM courses
          WHERE department_id=$1
            AND code=$2
          LIMIT 1
        `,[d.id,code]);

        if(present.rowCount){
          existing++;

          collisions.push({
            institution:d.institution_name,
            department:d.name,
            code,
            existing_title:present.rows[0].title
          });

          continue;
        }

        const id=uuidFrom(
          `kampuslearn:generic-university-course:${d.id}:${code}`
        );

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
            $2,
            $3,
            $4,
            3,
            $5,
            'university',
            $6,
            $7,
            TRUE,
            'generic_seed',
            FALSE
          )
        `,[
          id,
          d.id,
          title,
          code,
          t.level,
          t.semester,
          'KampusLearn starter course. Replace with the verified institutional curriculum when available.'
        ]);

        inserted++;
      }
    }

    console.log('\n=== GENERIC UNIVERSITY COURSES ===');
    console.log(
      'Generic departments:',
      departments.rowCount
    );
    console.log(
      'Courses per department:',
      TEMPLATE.length
    );
    console.log(
      'Maximum expected:',
      departments.rowCount*TEMPLATE.length
    );
    console.log(
      'Courses inserted:',
      inserted
    );
    console.log(
      'Existing codes held:',
      existing
    );

    if(collisions.length){
      console.log('\n=== HELD COLLISIONS ===');
      console.table(collisions.slice(0,100));
    }

    const summary=await client.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE curriculum_source='generic_seed'
            AND level_type='university'
        )::int AS generic_university_courses,

        COUNT(DISTINCT department_id) FILTER (
          WHERE curriculum_source='generic_seed'
            AND level_type='university'
        )::int AS departments_with_generic_courses
      FROM courses
    `);

    console.log('\n=== RESULT ===');
    console.table(summary.rows);

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
