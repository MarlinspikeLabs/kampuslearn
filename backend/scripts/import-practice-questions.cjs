'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../src/config/database');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const approve = !args.includes('--draft');

const fileArg = args.find(a => !a.startsWith('--'));

if (!fileArg) {
  console.error(`
Usage:
  node scripts/import-practice-questions.cjs <file.json>
  node scripts/import-practice-questions.cjs <file.json> --apply
  node scripts/import-practice-questions.cjs <file.json> --apply --draft
  `);
  process.exit(1);
}

const inputPath = path.resolve(fileArg);

function fail(message) {
  throw new Error(message);
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function questionFingerprint(courseId, questionText) {
  return crypto
    .createHash('sha256')
    .update(`${courseId}|${normalizeText(questionText).toLowerCase()}`)
    .digest('hex');
}

function validateQuestion(q, index) {
  const prefix = `Question ${index + 1}`;

  if (!q.question_text) {
    fail(`${prefix}: question_text is required`);
  }

  const type = q.question_type || 'mcq';

  if (!['mcq', 'true_false'].includes(type)) {
    fail(`${prefix}: unsupported question_type "${type}"`);
  }

  if (!q.correct_answer) {
    fail(`${prefix}: correct_answer is required`);
  }

  if (!['easy', 'medium', 'hard'].includes(q.difficulty || 'medium')) {
    fail(`${prefix}: invalid difficulty`);
  }

  if (type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      fail(`${prefix}: MCQ requires at least 2 options`);
    }

    const labels = q.options.map(o => String(o.label || '').trim().toUpperCase());

    if (new Set(labels).size !== labels.length) {
      fail(`${prefix}: duplicate option labels`);
    }

    if (!labels.includes(String(q.correct_answer).trim().toUpperCase())) {
      fail(`${prefix}: correct_answer is not one of the option labels`);
    }

    for (const [i, opt] of q.options.entries()) {
      if (!opt.label || !opt.text) {
        fail(`${prefix}: option ${i + 1} requires label and text`);
      }
    }
  }

  if (!q.explanation) {
    fail(`${prefix}: explanation is required`);
  }
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    fail(`File not found: ${inputPath}`);
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  if (!payload.course_code) fail('course_code is required');
  if (!payload.course_title) fail('course_title is required');
  if (!Array.isArray(payload.topics) || payload.topics.length === 0) {
    fail('topics array is required');
  }

  if (!payload.level) {
    fail('level is required');
  }

  // Prefer an explicitly mapped shared question bank.
  const mappedCourseRes = await pool.query(`
    SELECT
      source.id,
      source.code,
      source.title,
      source.level,
      source.semester,
      source.department_id,
      COUNT(*)::int AS mapped_courses

    FROM practice_course_question_sources pcs

    JOIN courses target
      ON target.id = pcs.course_id

    JOIN courses source
      ON source.id = pcs.source_course_id

    WHERE target.code = $1
      AND target.level::text = $2::text
      AND target.is_active = TRUE
      AND source.is_active = TRUE

    GROUP BY
      source.id,
      source.code,
      source.title,
      source.level,
      source.semester,
      source.department_id

    ORDER BY COUNT(*) DESC
  `, [
    payload.course_code,
    String(payload.level)
  ]);

  let course;

  if (mappedCourseRes.rows.length > 1) {
    fail(
      `Multiple shared question banks exist for ${payload.course_code} level ${payload.level}`
    );
  }

  if (mappedCourseRes.rows.length === 1) {
    course = mappedCourseRes.rows[0];

    console.log(
      `🔗 Shared bank resolved: ${payload.course_code} ${payload.level} -> ${course.id} (${course.mapped_courses} mapped courses)`
    );
  } else {
    // Non-shared courses are still supported, but ambiguity is forbidden.
    const directCourseRes = await pool.query(`
      SELECT
        id,
        code,
        title,
        level,
        semester,
        department_id

      FROM courses

      WHERE code = $1
        AND level::text = $2::text
        AND is_active = TRUE

      ORDER BY created_at
    `, [
      payload.course_code,
      String(payload.level)
    ]);

    if (directCourseRes.rows.length === 0) {
      fail(
        `No active course found for ${payload.course_code} level ${payload.level}`
      );
    }

    if (directCourseRes.rows.length > 1) {
      fail(
        `Multiple courses match ${payload.course_code} level ${payload.level}; create a shared-bank mapping or use a uniquely identified course`
      );
    }

    course = directCourseRes.rows[0];
  }

  const creatorRes = await pool.query(`
    SELECT id, full_name, email
    FROM users
    WHERE role = 'admin'
    ORDER BY created_at
    LIMIT 1
  `);

  if (creatorRes.rows.length === 0) {
    fail('No admin user found for created_by');
  }

  const creator = creatorRes.rows[0];

  const flattened = [];

  payload.topics.forEach((topic, topicIndex) => {
    if (!topic.name) {
      fail(`Topic ${topicIndex + 1}: name is required`);
    }

    if (!Array.isArray(topic.questions)) {
      fail(`Topic "${topic.name}": questions must be an array`);
    }

    topic.questions.forEach((q, i) => {
      validateQuestion(q, i);

      flattened.push({
        topic_name: normalizeText(topic.name),
        topic_description: topic.description || null,
        topic_order: topic.order_num ?? topicIndex + 1,
        ...q,
      });
    });
  });

  const seen = new Set();
  const duplicateInFile = [];

  for (const q of flattened) {
    const fp = questionFingerprint(course.id, q.question_text);

    if (seen.has(fp)) {
      duplicateInFile.push(q.question_text);
    }

    seen.add(fp);
  }

  if (duplicateInFile.length > 0) {
    fail(
      `Duplicate questions inside input file:\n- ${duplicateInFile.join('\n- ')}`
    );
  }

  const report = {
    source: inputPath,
    apply,
    approve,
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      level: course.level,
      semester: course.semester,
    },
    creator: {
      id: creator.id,
      email: creator.email,
    },
    topics: payload.topics.length,
    questions_in_file: flattened.length,
    topics_to_create: 0,
    questions_to_insert: 0,
    duplicates_skipped: 0,
    inserted: 0,
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const topicIds = new Map();

    for (const topic of payload.topics) {
      const existing = await client.query(`
        SELECT id
        FROM topics
        WHERE course_id = $1
          AND LOWER(name) = LOWER($2)
        LIMIT 1
      `, [course.id, normalizeText(topic.name)]);

      if (existing.rows.length) {
        topicIds.set(normalizeText(topic.name), existing.rows[0].id);
        continue;
      }

      report.topics_to_create++;

      if (apply) {
        const created = await client.query(`
          INSERT INTO topics (
            course_id,
            name,
            description,
            order_num
          )
          VALUES ($1,$2,$3,$4)
          RETURNING id
        `, [
          course.id,
          normalizeText(topic.name),
          topic.description || null,
          topic.order_num ?? 0,
        ]);

        topicIds.set(
          normalizeText(topic.name),
          created.rows[0].id
        );
      }
    }

    for (const q of flattened) {
      const existing = await client.query(`
        SELECT id
        FROM questions
        WHERE course_id = $1
          AND LOWER(REGEXP_REPLACE(question_text, '\\s+', ' ', 'g'))
              = LOWER(REGEXP_REPLACE($2, '\\s+', ' ', 'g'))
        LIMIT 1
      `, [course.id, normalizeText(q.question_text)]);

      if (existing.rows.length) {
        report.duplicates_skipped++;
        continue;
      }

      report.questions_to_insert++;

      if (!apply) continue;

      let topicId = topicIds.get(q.topic_name);

      if (!topicId) {
        const topicRes = await client.query(`
          SELECT id
          FROM topics
          WHERE course_id = $1
            AND LOWER(name) = LOWER($2)
          LIMIT 1
        `, [course.id, q.topic_name]);

        topicId = topicRes.rows[0]?.id;
      }

      if (!topicId) {
        fail(`Could not resolve topic: ${q.topic_name}`);
      }

      await client.query(`
        INSERT INTO questions (
          course_id,
          topic_id,
          created_by,
          question_text,
          question_type,
          options,
          correct_answer,
          explanation,
          difficulty,
          marks,
          year,
          is_approved
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
      `, [
        course.id,
        topicId,
        creator.id,
        normalizeText(q.question_text),
        q.question_type || 'mcq',
        q.options ? JSON.stringify(q.options) : null,
        String(q.correct_answer).trim(),
        normalizeText(q.explanation),
        q.difficulty || 'medium',
        Number.isInteger(q.marks) ? q.marks : 1,
        q.year || null,
        approve,
      ]);

      report.inserted++;
    }

    if (apply) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    console.log('\n=== PRACTICE QUESTION IMPORT REPORT ===');
    console.table(report);

    console.log(
      apply
        ? `\n✅ Applied successfully${approve ? ' with approval' : ' as draft questions'}`
        : '\n🧪 Dry run only — no database changes made'
    );

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch(err => {
    console.error('\n❌ Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
