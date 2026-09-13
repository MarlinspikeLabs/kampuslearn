#!/usr/bin/env node

require('dotenv').config({
  path: '/var/www/kampuslearn/backend/.env'
});

const fs = require('fs');

const {
  pool
} = require(
  '/var/www/kampuslearn/backend/src/config/database'
);

const SOURCE =
  '/home/ubuntu/kampuslearn-redesign/backend/data/' +
  'academic-reference/nbte-programmes/' +
  'nbte-2025-polytechnic-programmes-current.json';

const APPLY = process.argv.includes('--apply');

const data = JSON.parse(
  fs.readFileSync(SOURCE,'utf8')
);

const rows = data.records || [];

(async()=>{
  const client = await pool.connect();

  try{
    await client.query('BEGIN');

    console.log(
      APPLY
        ? '\n=== NBTE PROGRAMME APPLY ==='
        : '\n=== NBTE PROGRAMME DRY RUN ==='
    );

    console.log(
      'Input records:',
      rows.length
    );

    const before = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM academic_programmes
    `);

    console.log(
      'Before:',
      before.rows[0].count
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const statuses = {};
    const awards = {};

    for(const r of rows){

      try{
        if(
          !r.institution_id ||
          !['ND','HND'].includes(
            r.award_type
          )
        ){
          skipped++;
          continue;
        }

        const institution =
          await client.query(`
            SELECT id,type
            FROM institutions
            WHERE id=$1
          `,[r.institution_id]);

        if(
          institution.rowCount !== 1 ||
          institution.rows[0].type
            !== 'polytechnic'
        ){
          skipped++;
          continue;
        }

        const existing =
          await client.query(`
            SELECT id
            FROM academic_programmes
            WHERE institution_id=$1
              AND name=$2
              AND award_type=$3
          `,[
            r.institution_id,
            r.programme_name,
            r.award_type
          ]);

        const isActive =
          r.is_active_as_of_2026_09_12
          === true;

        if(existing.rowCount){

          await client.query(`
            UPDATE academic_programmes
            SET
              regulator='NBTE',
              accreditation_status=$1,
              source_url=$2,
              checked_at=$3,
              is_active=$4,
              category=$5,
              year_granted_text=$6,
              approved_stream=$7,
              expiration_date=$8
            WHERE id=$9
          `,[
            r.accreditation_status,
            r.source_url,
            '2026-09-12',
            isActive,
            r.category || null,
            r.year_granted_text || null,
            r.approved_stream ?? null,
            r.expiration_date || null,
            existing.rows[0].id
          ]);

          updated++;

        }else{

          await client.query(`
            INSERT INTO academic_programmes (
              institution_id,
              department_id,
              name,
              award_type,
              regulator,
              accreditation_status,
              source_url,
              checked_at,
              is_active,
              category,
              year_granted_text,
              approved_stream,
              expiration_date
            )
            VALUES (
              $1,NULL,$2,$3,'NBTE',
              $4,$5,$6,$7,$8,$9,$10,$11
            )
          `,[
            r.institution_id,
            r.programme_name,
            r.award_type,
            r.accreditation_status,
            r.source_url,
            '2026-09-12',
            isActive,
            r.category || null,
            r.year_granted_text || null,
            r.approved_stream ?? null,
            r.expiration_date || null
          ]);

          inserted++;
        }

        statuses[
          r.accreditation_status
        ] = (
          statuses[
            r.accreditation_status
          ] || 0
        ) + 1;

        awards[
          r.award_type
        ] = (
          awards[
            r.award_type
          ] || 0
        ) + 1;

      }catch(err){
        errors++;

        console.error(
          'ERROR:',
          r.institution_name,
          '|',
          r.award_type,
          '|',
          r.programme_name,
          '|',
          err.message
        );
      }
    }

    const inside =
      await client.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE award_type='ND'
          )::int AS nd,
          COUNT(*) FILTER (
            WHERE award_type='HND'
          )::int AS hnd,
          COUNT(*) FILTER (
            WHERE is_active=true
          )::int AS active
        FROM academic_programmes
      `);

    console.log(
      '\nInserted:',inserted
    );

    console.log(
      'Updated:',updated
    );

    console.log(
      'Skipped:',skipped
    );

    console.log(
      'Errors:',errors
    );

    console.log(
      'Awards:',
      awards
    );

    console.log(
      'Statuses:',
      statuses
    );

    console.log(
      '\nINSIDE TRANSACTION'
    );

    console.table(
      inside.rows
    );

    if(errors){
      throw new Error(
        `${errors} programme import errors`
      );
    }

    if(APPLY){
      await client.query(
        'COMMIT'
      );

      console.log(
        '\nNBTE PROGRAMMES COMMITTED'
      );

    }else{
      await client.query(
        'ROLLBACK'
      );

      console.log(
        '\nDRY RUN SUCCESSFUL — ROLLED BACK'
      );
    }

  }catch(err){

    try{
      await client.query(
        'ROLLBACK'
      );
    }catch{}

    console.error(
      '\nIMPORT FAILED:',
      err.message
    );

    process.exitCode=1;

  }finally{
    client.release();
    await pool.end();
  }
})();
