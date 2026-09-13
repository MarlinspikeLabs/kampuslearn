#!/usr/bin/env node

require('dotenv').config({
  path:'/var/www/kampuslearn/backend/.env'
});

const crypto=require('crypto');
const {
  pool
}=require('/var/www/kampuslearn/backend/src/config/database');

const APPLY=process.argv.includes('--apply');

const STARTERS=[
  ['Computer Science','ND'],
  ['Accountancy','ND'],
  ['Business Administration & Management','ND'],
  ['Electrical/Electronic Engineering','ND'],
  ['Civil Engineering','ND'],
  ['Public Administration','ND'],

  ['Computer Science','HND'],
  ['Accountancy','HND'],
  ['Business Administration & Management','HND']
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
      WHERE i.type='polytechnic'
        AND i.is_active=TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM academic_programmes ap
          WHERE ap.institution_id=i.id
            AND ap.is_active=TRUE
            AND ap.award_type IN ('ND','HND')
        )
      ORDER BY i.name
    `);

    let inserted=0;
    let conflicts=0;
    const conflictRows=[];

    for(const i of institutions.rows){

      for(const [name,award] of STARTERS){

        const existing=await client.query(`
          SELECT
            id,
            is_active,
            programme_source,
            accreditation_status
          FROM academic_programmes
          WHERE institution_id=$1
            AND name=$2
            AND award_type=$3
            AND programme_source='generic_seed'
          LIMIT 1
        `,[i.id,name,award]);

        if(existing.rowCount){
          conflicts++;

          conflictRows.push({
            institution:i.name,
            programme:name,
            award,
            existing_active:existing.rows[0].is_active,
            source:existing.rows[0].programme_source,
            status:existing.rows[0].accreditation_status
          });

          continue;
        }

        const id=uuidFrom(
          `kampuslearn:generic-programme:${i.id}:${award}:${name}`
        );

        await client.query(`
          INSERT INTO academic_programmes
          (
            id,
            institution_id,
            department_id,
            name,
            award_type,
            regulator,
            accreditation_status,
            is_active,
            programme_source,
            is_verified,
            checked_at
          )
          VALUES
          (
            $1,
            $2,
            NULL,
            $3,
            $4,
            'KampusLearn',
            'starter',
            TRUE,
            'generic_seed',
            FALSE,
            CURRENT_DATE
          )
        `,[id,i.id,name,award]);

        inserted++;
      }
    }

    console.log('\n=== GENERIC POLYTECHNIC PROGRAMMES ===');
    console.log('Institutions without active programmes:',institutions.rowCount);
    console.log('Starter programmes per institution:',STARTERS.length);
    console.log('Inserted:',inserted);
    console.log('Existing conflicts held:',conflicts);

    if(conflictRows.length){
      console.log('\n=== HELD CONFLICTS ===');
      console.table(conflictRows);
    }

    const summary=await client.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE programme_source='generic_seed'
        )::int AS generic_programmes,

        COUNT(DISTINCT institution_id) FILTER (
          WHERE programme_source='generic_seed'
        )::int AS institutions_with_generic_programmes

      FROM academic_programmes
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
