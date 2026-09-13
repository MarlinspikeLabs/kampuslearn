#!/usr/bin/env node

require('dotenv').config({
  path:'/var/www/kampuslearn/backend/.env'
});

const crypto=require('crypto');

const {
  pool
}=require('/var/www/kampuslearn/backend/src/config/database');

const APPLY=process.argv.includes('--apply');

const STRUCTURE=[
  {
    name:'Faculty of Science',
    code:'SCI',
    departments:[
      ['Computer Science','CSC'],
      ['Mathematics','MTH'],
      ['Statistics','STA']
    ]
  },
  {
    name:'Faculty of Engineering',
    code:'ENG',
    departments:[
      ['Civil Engineering','CVE'],
      ['Electrical Engineering','EEE'],
      ['Mechanical Engineering','MEE']
    ]
  },
  {
    name:'Faculty of Social Sciences',
    code:'SOC',
    departments:[
      ['Economics','ECO'],
      ['Political Science','POL'],
      ['Sociology','SOC']
    ]
  },
  {
    name:'Faculty of Management Sciences',
    code:'MGT',
    departments:[
      ['Accounting','ACC'],
      ['Business Administration','BUS']
    ]
  },
  {
    name:'Faculty of Arts',
    code:'ART',
    departments:[
      ['English','ENG'],
      ['History','HIS']
    ]
  },
  {
    name:'Faculty of Education',
    code:'EDU',
    departments:[
      ['Education','EDU']
    ]
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

(async()=>{

  const client=await pool.connect();

  try{
    await client.query('BEGIN');

    const institutions=await client.query(`
      SELECT
        i.id,
        i.name
      FROM institutions i
      WHERE i.type='university'
        AND i.is_active=TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM faculties f
          WHERE f.institution_id=i.id
        )
      ORDER BY i.name
    `);

    let facultiesInserted=0;
    let departmentsInserted=0;
    let held=0;

    const holds=[];

    for(const institution of institutions.rows){

      for(const template of STRUCTURE){

        const facultyId=uuidFrom(
          `kampuslearn:generic-faculty:${institution.id}:${template.name}`
        );

        const existingFaculty=await client.query(`
          SELECT id
          FROM faculties
          WHERE institution_id=$1
            AND LOWER(name)=LOWER($2)
          LIMIT 1
        `,[institution.id,template.name]);

        let actualFacultyId;

        if(existingFaculty.rowCount){
          actualFacultyId=existingFaculty.rows[0].id;
        }else{

          await client.query(`
            INSERT INTO faculties
            (
              id,
              institution_id,
              name,
              code,
              structure_source,
              is_verified
            )
            VALUES
            ($1,$2,$3,$4,'generic_seed',FALSE)
          `,[
            facultyId,
            institution.id,
            template.name,
            template.code
          ]);

          actualFacultyId=facultyId;
          facultiesInserted++;
        }

        for(const [departmentName,departmentCode] of template.departments){

          const existingDepartment=await client.query(`
            SELECT id
            FROM departments
            WHERE faculty_id=$1
              AND LOWER(name)=LOWER($2)
            LIMIT 1
          `,[actualFacultyId,departmentName]);

          if(existingDepartment.rowCount){
            held++;

            holds.push({
              institution:institution.name,
              faculty:template.name,
              department:departmentName,
              reason:'already exists'
            });

            continue;
          }

          const departmentId=uuidFrom(
            `kampuslearn:generic-department:${actualFacultyId}:${departmentName}`
          );

          await client.query(`
            INSERT INTO departments
            (
              id,
              faculty_id,
              school_id,
              name,
              code,
              structure_source,
              is_verified
            )
            VALUES
            (
              $1,
              $2,
              NULL,
              $3,
              $4,
              'generic_seed',
              FALSE
            )
          `,[
            departmentId,
            actualFacultyId,
            departmentName,
            departmentCode
          ]);

          departmentsInserted++;
        }
      }
    }

    console.log('\n=== GENERIC UNIVERSITY STRUCTURE ===');
    console.log('Universities without faculties:',institutions.rowCount);
    console.log('Faculties per university:',STRUCTURE.length);
    console.log(
      'Departments per university:',
      STRUCTURE.reduce((n,f)=>n+f.departments.length,0)
    );
    console.log('Faculties inserted:',facultiesInserted);
    console.log('Departments inserted:',departmentsInserted);
    console.log('Existing departments held:',held);

    if(holds.length){
      console.log('\n=== HOLDS ===');
      console.table(holds.slice(0,100));
    }

    const summary=await client.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE structure_source='generic_seed'
        )::int AS generic_faculties,

        COUNT(DISTINCT institution_id) FILTER (
          WHERE structure_source='generic_seed'
        )::int AS universities_with_generic_faculties

      FROM faculties
    `);

    const depSummary=await client.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE structure_source='generic_seed'
        )::int AS generic_departments
      FROM departments
    `);

    console.log('\n=== RESULT ===');
    console.table(summary.rows);
    console.table(depSummary.rows);

    if(APPLY){
      await client.query('COMMIT');
      console.log('\nCOMMITTED');
    }else{
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
