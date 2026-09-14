require('dotenv').config({
  path: process.env.KAMPUSLEARN_ENV || '/var/www/kampuslearn/backend/.env'
});

const { pool } = require('../src/config/database');

const GSTS = [
  {
    code: 'KL-GST101',
    title: 'Use of English and Communication Skills',
    semester: 'first',
    description: 'Use of English, communication, comprehension, writing, grammar and academic language skills.'
  },
  {
    code: 'KL-GST102',
    title: 'Digital Literacy and Study Skills',
    semester: 'second',
    description: 'Digital literacy, study skills, productivity tools, communication technologies and responsible digital use.'
  },
  {
    code: 'KL-GST103',
    title: 'Computer Fundamentals and Information and Communication Technology',
    semester: 'first',
    description: 'Computer fundamentals, information technology, communication technologies, computer applications and responsible digital use.'
  },
  {
    code: 'KL-GST104',
    title: 'Use of Library and Study Skills',
    semester: 'second',
    description: 'Library use, information resources, information retrieval, study techniques, referencing and academic integrity.'
  },
  {
    code: 'KL-GST105',
    title: 'History and Philosophy of Science',
    semester: 'first',
    description: 'History and development of scientific thought, methods, scientific revolutions, philosophy of science, science and society, and ethical responsibility.'
  }
];

async function ensureCourseRows(client, gst) {
  const r = await client.query(`
    INSERT INTO courses (
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
      is_verified,
      source_url
    )
    SELECT
      base.department_id,
      $1::varchar,
      $2::varchar,
      2,
      '100',
      'university',
      $3::semester_type,
      $4::text,
      TRUE,
      'generic_seed',
      FALSE,
      NULL
    FROM courses base
    WHERE base.code='KL-GST101'
      AND base.level='100'
      AND base.level_type='university'
      AND base.is_active=TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM courses existing
        WHERE existing.department_id=base.department_id
          AND existing.code=$2::varchar
          AND existing.level='100'
          AND existing.level_type='university'
      )
    RETURNING id
  `, [gst.title, gst.code, gst.semester, gst.description]);

  return r.rowCount;
}

async function resolveSource(client, gst) {
  const r = await client.query(`
    SELECT
      c.id,
      c.code,
      c.title,
      d.name AS department,
      f.name AS faculty,
      i.name AS institution
    FROM courses c
    JOIN departments d ON d.id=c.department_id
    JOIN faculties f ON f.id=d.faculty_id
    JOIN institutions i ON i.id=f.institution_id
    WHERE c.code=$1::varchar
      AND c.level='100'
      AND c.level_type='university'
      AND c.is_active=TRUE
    ORDER BY
      CASE
        WHEN i.name='University of Maiduguri' THEN 0
        ELSE 1
      END,
      i.name,
      d.name,
      c.id
    LIMIT 1
  `, [gst.code]);

  if (!r.rows.length) {
    throw new Error(`No canonical source found for ${gst.code}`);
  }

  return r.rows[0];
}

async function ensureMappings(client, gst, sourceId) {
  const r = await client.query(`
    INSERT INTO practice_course_question_sources (
      course_id,
      source_course_id
    )
    SELECT
      c.id,
      $1::uuid
    FROM courses c
    WHERE c.code=$2::varchar
      AND c.level='100'
      AND c.level_type='university'
      AND c.is_active=TRUE
    ON CONFLICT (course_id)
    DO UPDATE SET
      source_course_id=EXCLUDED.source_course_id
    RETURNING course_id
  `, [sourceId, gst.code]);

  return r.rowCount;
}

async function verify(client, gst) {
  const r = await client.query(`
    SELECT
      COUNT(DISTINCT c.id)::int AS course_rows,
      COUNT(DISTINCT c.department_id)::int AS departments,
      COUNT(DISTINCT pcs.source_course_id)::int AS source_banks
    FROM courses c
    LEFT JOIN practice_course_question_sources pcs
      ON pcs.course_id=c.id
    WHERE c.code=$1::varchar
      AND c.level='100'
      AND c.level_type='university'
      AND c.is_active=TRUE
  `, [gst.code]);

  return r.rows[0];
}

(async()=>{
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('\n=== GST SHARED BANK SEED ===\n');

    for (const gst of GSTS) {
      const created = await ensureCourseRows(client, gst);
      const source = await resolveSource(client, gst);
      const mapped = await ensureMappings(client, gst, source.id);
      const check = await verify(client, gst);

      console.log(`${gst.code} — ${gst.title}`);
      console.log(`  created rows : ${created}`);
      console.log(`  mapped rows  : ${mapped}`);
      console.log(`  source bank  : ${source.id}`);
      console.log(`  institution  : ${source.institution}`);
      console.log(`  course rows  : ${check.course_rows}`);
      console.log(`  departments  : ${check.departments}`);
      console.log(`  source banks : ${check.source_banks}`);
      console.log('');
    }

    await client.query('COMMIT');
    console.log('✅ GST shared-bank seed completed successfully');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exitCode = 1;

  } finally {
    client.release();
    await pool.end();
  }
})();
