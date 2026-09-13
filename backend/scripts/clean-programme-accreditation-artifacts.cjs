#!/usr/bin/env node

require('dotenv').config({
  path: '/var/www/kampuslearn/backend/.env'
});

const { pool } = require(
  '/var/www/kampuslearn/backend/src/config/database'
);

const APPLY = process.argv.includes('--apply');

function cleaned(name) {
  return name.replace(/\s+Accreditation\s*$/i, '').trim();
}

function suspicious(name) {
  return (
    /RELATED STUDIES/i.test(name) ||
    /cont[`'’]?d/i.test(name) ||
    /Converted to University/i.test(name) ||
    /\bPOLYTECHNIC\b/i.test(name)
  );
}

(async()=>{

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const candidates = await client.query(`
      SELECT
        ap.*,
        i.name AS institution_name
      FROM academic_programmes ap
      JOIN institutions i
        ON i.id = ap.institution_id
      WHERE ap.name ~* '\\s+Accreditation\\s*$'
      ORDER BY i.name, ap.name, ap.award_type
    `);

    let merged = 0;
    let renamed = 0;
    let held = 0;

    const mergeReport = [];
    const renameReport = [];
    const holdReport = [];

    for (const row of candidates.rows) {

      const targetName = cleaned(row.name);

      if (suspicious(targetName)) {
        held++;

        holdReport.push({
          institution: row.institution_name,
          award: row.award_type,
          current: row.name,
          proposed: targetName,
          reason: 'category/header contamination'
        });

        continue;
      }

      const canonical = await client.query(`
        SELECT *
        FROM academic_programmes
        WHERE institution_id = $1
          AND name = $2
          AND award_type = $3
          AND id <> $4
        LIMIT 1
      `, [
        row.institution_id,
        targetName,
        row.award_type,
        row.id
      ]);

      if (canonical.rowCount) {

        const keep = canonical.rows[0];

        await client.query(`
          INSERT INTO programme_courses
          (
            programme_id,
            course_id,
            level,
            semester,
            is_core,
            source_type,
            source_url,
            checked_at,
            created_at
          )
          SELECT
            $1,
            course_id,
            level,
            semester,
            is_core,
            source_type,
            source_url,
            checked_at,
            created_at
          FROM programme_courses
          WHERE programme_id = $2
          ON CONFLICT (programme_id, course_id, level)
          DO NOTHING
        `, [keep.id, row.id]);

        await client.query(`
          DELETE FROM programme_courses
          WHERE programme_id = $1
        `, [row.id]);

        await client.query(`
          UPDATE student_profiles
          SET programme_id = $1
          WHERE programme_id = $2
        `, [keep.id, row.id]);

        if (
          row.expiration_date &&
          (
            !keep.expiration_date ||
            new Date(row.expiration_date) >
              new Date(keep.expiration_date)
          )
        ) {
          await client.query(`
            UPDATE academic_programmes
            SET
              accreditation_status = $1,
              regulator = $2,
              source_url = $3,
              checked_at = $4,
              is_active = $5,
              category = $6,
              year_granted_text = $7,
              approved_stream = $8,
              expiration_date = $9
            WHERE id = $10
          `, [
            row.accreditation_status,
            row.regulator,
            row.source_url,
            row.checked_at,
            row.is_active,
            row.category,
            row.year_granted_text,
            row.approved_stream,
            row.expiration_date,
            keep.id
          ]);
        }

        await client.query(`
          DELETE FROM academic_programmes
          WHERE id = $1
        `, [row.id]);

        merged++;

        mergeReport.push({
          institution: row.institution_name,
          award: row.award_type,
          removed: row.name,
          canonical: targetName
        });

        continue;
      }

      await client.query(`
        UPDATE academic_programmes
        SET name = $1
        WHERE id = $2
      `, [targetName, row.id]);

      renamed++;

      renameReport.push({
        institution: row.institution_name,
        award: row.award_type,
        from: row.name,
        to: targetName
      });
    }

    console.log('\n=== PROGRAMME NAME CLEANUP ===');
    console.log('Candidates:', candidates.rowCount);
    console.log('Merged duplicates:', merged);
    console.log('Renamed:', renamed);
    console.log('Held:', held);

    console.log('\n=== MERGES ===');
    console.table(mergeReport);

    console.log('\n=== RENAMES ===');
    console.table(renameReport);

    console.log('\n=== HOLDS ===');
    console.table(holdReport);

    const remaining = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM academic_programmes
      WHERE name ~* '\\s+Accreditation\\s*$'
    `);

    console.log(
      '\nRemaining Accreditation suffixes:',
      remaining.rows[0].count
    );

    if (APPLY) {
      await client.query('COMMIT');
      console.log('\nCLEANUP COMMITTED');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDRY RUN — ROLLED BACK');
    }

  } catch (e) {

    try {
      await client.query('ROLLBACK');
    } catch {}

    console.error('\nCLEANUP FAILED:', e);
    process.exitCode = 1;

  } finally {

    client.release();
    await pool.end();

  }

})();
