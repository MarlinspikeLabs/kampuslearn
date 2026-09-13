const router = require('express').Router();

const { query, getClient } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

// ============================================================
// Helper: verify that a student can access a course
// Supports:
// - University: department-owned courses
// - Polytechnic: programme_courses
// ============================================================
async function studentCanAccessCourse(userId, courseId) {
  const result = await query(`
    SELECT
      sp.user_id,
      sp.department_id,
      sp.programme_id,
      c.id AS course_id
    FROM student_profiles sp
    JOIN courses c ON c.id = $2
    WHERE sp.user_id = $1
      AND c.is_active = TRUE
      AND (
        (
          sp.department_id IS NOT NULL
          AND c.department_id = sp.department_id
          AND c.level::text = sp.level::text
        )
        OR
        (
          sp.programme_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM programme_courses pc
            WHERE pc.programme_id = sp.programme_id
              AND pc.course_id = c.id
              AND pc.level::text = sp.level::text
          )
        )
      )
    LIMIT 1
  `, [userId, courseId]);

  return result.rows.length > 0;
}

// ============================================================
// Helper: recalculate and update student mastery
// V1:
// correct   +5
// incorrect -4
//
// 0-39  weak
// 40-69 medium
// 70-100 strong
// ============================================================
async function updateKnowledge(client, userId, courseId, topicId, isCorrect) {
  if (!topicId) return;

  const initialLevel = isCorrect ? 5 : 0;
  const delta = isCorrect ? 5 : -4;

  await client.query(`
    INSERT INTO student_knowledge (
      user_id,
      course_id,
      topic_id,
      knowledge_level,
      strength,
      last_practiced_at
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4::smallint,
      'weak'::knowledge_strength,
      NOW()
    )

    ON CONFLICT (user_id, course_id, topic_id)

    DO UPDATE SET
      knowledge_level = GREATEST(
        0,
        LEAST(
          100,
          student_knowledge.knowledge_level + $5::integer
        )
      ),

      strength = CASE
        WHEN GREATEST(
          0,
          LEAST(
            100,
            student_knowledge.knowledge_level + $5::integer
          )
        ) >= 70
          THEN 'strong'::knowledge_strength

        WHEN GREATEST(
          0,
          LEAST(
            100,
            student_knowledge.knowledge_level + $5::integer
          )
        ) >= 40
          THEN 'medium'::knowledge_strength

        ELSE 'weak'::knowledge_strength
      END,

      last_practiced_at = NOW(),
      updated_at = NOW()
  `, [
    userId,
    courseId,
    topicId,
    initialLevel,
    delta
  ]);
}

// ============================================================
// GET /api/practice/courses
// Courses available to logged-in student, with question counts
// ============================================================
router.get('/courses', authenticate, async (req, res) => {
  try {
    const result = await query(`
      WITH student AS (
        SELECT
          department_id,
          programme_id,
          level
        FROM student_profiles
        WHERE user_id = $1
        LIMIT 1
      ),

      accessible_courses AS (

        -- University students
        SELECT DISTINCT
          c.id,
          c.code,
          c.title,
          c.level,
          c.semester

        FROM student sp

        JOIN courses c
          ON c.department_id = sp.department_id
         AND c.is_active = TRUE
         AND c.level::text = sp.level::text

        WHERE sp.department_id IS NOT NULL

        UNION

        -- Polytechnic students
        SELECT DISTINCT
          c.id,
          c.code,
          c.title,
          pc.level AS level,
          COALESCE(pc.semester, c.semester) AS semester

        FROM student sp

        JOIN programme_courses pc
          ON pc.programme_id = sp.programme_id
         AND pc.level::text = sp.level::text

        JOIN courses c
          ON c.id = pc.course_id
         AND c.is_active = TRUE

        WHERE sp.programme_id IS NOT NULL
      )

      SELECT
        ac.id,
        ac.code,
        ac.title,
        ac.level,
        ac.semester,

        COUNT(q.id) FILTER (
          WHERE q.is_approved = TRUE
        )::int AS question_count

      FROM accessible_courses ac

      LEFT JOIN questions q
        ON q.course_id = ac.id

      GROUP BY
        ac.id,
        ac.code,
        ac.title,
        ac.level,
        ac.semester

      ORDER BY
        ac.semester,
        ac.code,
        ac.title
    `, [req.user.id]);

    return success(res, result.rows);

  } catch (err) {
    console.error('practice courses error:', err.message);
    return error(res, 'Failed to load practice courses', 500);
  }
});

// ============================================================
// GET /api/practice/courses/:courseId/topics
// ============================================================
router.get('/courses/:courseId/topics', authenticate, async (req, res) => {
  try {
    const allowed = await studentCanAccessCourse(
      req.user.id,
      req.params.courseId
    );

    if (!allowed) {
      return error(res, 'You do not have access to this course', 403);
    }

    const result = await query(`
      SELECT
        t.id,
        t.name,
        t.description,

        COUNT(q.id) FILTER (
          WHERE q.is_approved = TRUE
        )::int AS question_count

      FROM topics t

      LEFT JOIN questions q
        ON q.topic_id = t.id
        AND q.course_id = t.course_id

      WHERE t.course_id = $1

      GROUP BY
        t.id,
        t.name,
        t.description,
        t.order_num

      ORDER BY
        t.order_num,
        t.name
    `, [req.params.courseId]);

    return success(res, result.rows);

  } catch (err) {
    console.error('practice topics error:', err.message);
    return error(res, 'Failed to load topics', 500);
  }
});

// ============================================================
// POST /api/practice/sessions
//
// {
//   course_id,
//   topic_id: optional,
//   difficulty: mixed | easy | medium | hard,
//   question_count: 10,
//   mode: quick | weak_topics | past_questions
// }
// ============================================================
router.post('/sessions', authenticate, async (req, res) => {
  const client = await getClient();

  try {
    const {
      course_id,
      topic_id = null,
      difficulty = 'mixed',
      question_count = 10,
      mode = 'quick'
    } = req.body;

    if (!course_id) {
      return error(res, 'course_id is required', 400);
    }

    const allowedDifficulties = [
      'mixed',
      'easy',
      'medium',
      'hard'
    ];

    const allowedModes = [
      'quick',
      'weak_topics',
      'past_questions'
    ];

    if (!allowedDifficulties.includes(difficulty)) {
      return error(res, 'Invalid difficulty', 400);
    }

    if (!allowedModes.includes(mode)) {
      return error(res, 'Invalid practice mode', 400);
    }

    const count = parseInt(question_count, 10);

    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return error(
        res,
        'question_count must be between 1 and 100',
        400
      );
    }

    const allowed = await studentCanAccessCourse(
      req.user.id,
      course_id
    );

    if (!allowed) {
      return error(res, 'You do not have access to this course', 403);
    }

    if (topic_id) {
      const topic = await query(`
        SELECT id
        FROM topics
        WHERE id = $1
          AND course_id = $2
      `, [topic_id, course_id]);

      if (topic.rows.length === 0) {
        return error(res, 'Topic does not belong to this course', 400);
      }
    }

    const params = [
      course_id,
      req.user.id
    ];

    let where = `
      q.course_id = $1
      AND q.is_approved = TRUE
    `;

    if (topic_id) {
      params.push(topic_id);
      where += `
        AND q.topic_id = $${params.length}
      `;
    }

    if (difficulty !== 'mixed') {
      params.push(difficulty);
      where += `
        AND q.difficulty = $${params.length}::difficulty_level
      `;
    }

    if (mode === 'past_questions') {
      where += `
        AND q.past_question_id IS NOT NULL
      `;
    }

    /*
      Question selection V1

      Priority:
      1. Never answered before
      2. Previously answered incorrectly
      3. Previously answered correctly

      Within each group, randomise.
    */

    params.push(count);

    const questions = await query(`
      SELECT
        q.id,
        q.topic_id,

        CASE
          WHEN COALESCE(history.total_attempts, 0) = 0 THEN 0
          WHEN history.correct_attempts = 0 THEN 1
          ELSE 2
        END AS priority

      FROM questions q

      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS total_attempts,
          COUNT(*) FILTER (
            WHERE psq.is_correct = TRUE
          )::int AS correct_attempts

        FROM practice_session_questions psq

        JOIN practice_sessions ps
          ON ps.id = psq.session_id

        WHERE ps.user_id = $2
          AND psq.question_id = q.id
          AND psq.answered_at IS NOT NULL
      ) history ON TRUE

      WHERE ${where}

      ORDER BY
        priority ASC,
        RANDOM()

      LIMIT $${params.length}
    `, params);

    if (questions.rows.length === 0) {
      return error(
        res,
        'No approved practice questions are available for this selection yet',
        404
      );
    }

    await client.query('BEGIN');

    const session = await client.query(`
      INSERT INTO practice_sessions (
        user_id,
        course_id,
        topic_id,
        mode,
        difficulty,
        question_count
      )
      VALUES ($1,$2,$3,$4,$5,$6)

      RETURNING
        id,
        user_id,
        course_id,
        topic_id,
        mode,
        difficulty,
        question_count,
        status,
        started_at
    `, [
      req.user.id,
      course_id,
      topic_id,
      mode,
      difficulty,
      questions.rows.length
    ]);

    const sessionId = session.rows[0].id;

    for (let i = 0; i < questions.rows.length; i++) {
      await client.query(`
        INSERT INTO practice_session_questions (
          session_id,
          question_id,
          position
        )
        VALUES ($1,$2,$3)
      `, [
        sessionId,
        questions.rows[i].id,
        i + 1
      ]);
    }

    await client.query('COMMIT');

    const first = await query(`
      UPDATE practice_session_questions psq

      SET presented_at = COALESCE(
        psq.presented_at,
        NOW()
      )

      FROM questions q

      LEFT JOIN topics t
        ON t.id = q.topic_id

      WHERE psq.session_id = $1
        AND psq.position = 1
        AND q.id = psq.question_id

      RETURNING
        psq.id AS session_question_id,
        psq.position,
        q.id AS question_id,
        q.question_text,
        q.question_type,
        q.options,
        q.difficulty,
        q.marks,
        t.id AS topic_id,
        t.name AS topic_name
    `, [sessionId]);

    return success(res, {
      session: session.rows[0],
      available_questions: questions.rows.length,
      question: first.rows[0] || null
    }, 'Practice session started', 201);

  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error('create practice session error:', err.message);
    return error(res, 'Failed to start practice session', 500);

  } finally {
    client.release();
  }
});

// ============================================================
// GET /api/practice/sessions/:sessionId
// Resume / fetch next unanswered question
// ============================================================
router.get('/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const session = await query(`
      SELECT
        ps.*,
        c.code AS course_code,
        c.title AS course_title,
        t.name AS topic_name

      FROM practice_sessions ps

      JOIN courses c
        ON c.id = ps.course_id

      LEFT JOIN topics t
        ON t.id = ps.topic_id

      WHERE ps.id = $1
        AND ps.user_id = $2
    `, [
      req.params.sessionId,
      req.user.id
    ]);

    if (session.rows.length === 0) {
      return error(res, 'Practice session not found', 404);
    }

    const row = session.rows[0];

    const next = await query(`
      UPDATE practice_session_questions psq

      SET presented_at = COALESCE(
        psq.presented_at,
        NOW()
      )

      FROM questions q

      LEFT JOIN topics t
        ON t.id = q.topic_id

      WHERE psq.id = (
        SELECT psq2.id

        FROM practice_session_questions psq2

        WHERE psq2.session_id = $1
          AND psq2.answered_at IS NULL

        ORDER BY psq2.position
        LIMIT 1
      )

      AND q.id = psq.question_id

      RETURNING
        psq.id AS session_question_id,
        psq.position,
        q.id AS question_id,
        q.question_text,
        q.question_type,
        q.options,
        q.difficulty,
        q.marks,
        t.id AS topic_id,
        t.name AS topic_name
    `, [row.id]);

    return success(res, {
      session: row,
      question: next.rows[0] || null
    });

  } catch (err) {
    console.error('practice session fetch error:', err.message);
    return error(res, 'Failed to load practice session', 500);
  }
});

// ============================================================
// POST /api/practice/sessions/:sessionId/answer
//
// {
//   question_id,
//   answer
// }
// ============================================================
router.post(
  '/sessions/:sessionId/answer',
  authenticate,
  async (req, res) => {
    const client = await getClient();

    try {
      const {
        question_id,
        answer
      } = req.body;

      if (!question_id || answer === undefined || answer === null) {
        return error(
          res,
          'question_id and answer are required',
          400
        );
      }

      await client.query('BEGIN');

      const current = await client.query(`
        SELECT
          ps.id AS session_id,
          ps.user_id,
          ps.course_id,
          ps.status,

          psq.id AS session_question_id,
          psq.position,
          psq.answered_at,
          psq.presented_at,

          q.id AS question_id,
          q.correct_answer,
          q.explanation,
          q.topic_id,
          q.question_type

        FROM practice_sessions ps

        JOIN practice_session_questions psq
          ON psq.session_id = ps.id

        JOIN questions q
          ON q.id = psq.question_id

        WHERE ps.id = $1
          AND ps.user_id = $2
          AND q.id = $3

        FOR UPDATE
      `, [
        req.params.sessionId,
        req.user.id,
        question_id
      ]);

      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return error(res, 'Question not found in this session', 404);
      }

      const item = current.rows[0];

      if (item.status !== 'active') {
        await client.query('ROLLBACK');
        return error(res, 'This practice session is not active', 400);
      }

      if (item.answered_at) {
        await client.query('ROLLBACK');
        return error(res, 'This question has already been answered', 409);
      }

      const normalizedStudent = String(answer)
        .trim()
        .toUpperCase();

      const normalizedCorrect = String(item.correct_answer)
        .trim()
        .toUpperCase();

      const isCorrect =
        normalizedStudent === normalizedCorrect;

      const responseTimeMs = item.presented_at
        ? Math.max(
            0,
            Date.now() -
              new Date(item.presented_at).getTime()
          )
        : null;

      await client.query(`
        UPDATE practice_session_questions

        SET
          student_answer = $1,
          is_correct = $2,
          answered_at = NOW(),
          response_time_ms = $3

        WHERE id = $4
      `, [
        String(answer).trim(),
        isCorrect,
        responseTimeMs,
        item.session_question_id
      ]);

      const stats = await client.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE answered_at IS NOT NULL
          )::int AS answered,

          COUNT(*) FILTER (
            WHERE is_correct = TRUE
          )::int AS correct,

          COUNT(*) FILTER (
            WHERE is_correct = FALSE
          )::int AS wrong,

          COUNT(*)::int AS total

        FROM practice_session_questions

        WHERE session_id = $1
      `, [item.session_id]);

      const s = stats.rows[0];

      const accuracy =
        s.answered > 0
          ? Math.round(
              (s.correct / s.answered) * 10000
            ) / 100
          : 0;

      await client.query(`
        UPDATE practice_sessions

        SET
          answered_count = $1,
          correct_count = $2,
          wrong_count = $3,
          accuracy = $4

        WHERE id = $5
      `, [
        s.answered,
        s.correct,
        s.wrong,
        accuracy,
        item.session_id
      ]);

      await updateKnowledge(
        client,
        req.user.id,
        item.course_id,
        item.topic_id,
        isCorrect
      );

      await client.query('COMMIT');

      return success(res, {
        correct: isCorrect,

        student_answer: String(answer).trim(),

        correct_answer: item.correct_answer,

        explanation: item.explanation,

        progress: {
          answered: s.answered,
          total: s.total,
          correct: s.correct,
          wrong: s.wrong,
          accuracy
        }
      });

    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}

      console.error('practice answer error:', err.message);
      return error(res, 'Failed to submit answer', 500);

    } finally {
      client.release();
    }
  }
);

// ============================================================
// POST /api/practice/sessions/:sessionId/complete
// ============================================================
router.post(
  '/sessions/:sessionId/complete',
  authenticate,
  async (req, res) => {
    try {
      const result = await query(`
        UPDATE practice_sessions

        SET
          status = 'completed',
          completed_at = NOW(),
          duration_seconds =
            GREATEST(
              0,
              FLOOR(
                EXTRACT(
                  EPOCH FROM (
                    NOW() - started_at
                  )
                )
              )::int
            )

        WHERE id = $1
          AND user_id = $2
          AND status = 'active'

        RETURNING *
      `, [
        req.params.sessionId,
        req.user.id
      ]);

      if (result.rows.length === 0) {
        return error(
          res,
          'Active practice session not found',
          404
        );
      }

      return success(
        res,
        result.rows[0],
        'Practice session completed'
      );

    } catch (err) {
      console.error('complete practice error:', err.message);
      return error(res, 'Failed to complete practice session', 500);
    }
  }
);

// ============================================================
// GET /api/practice/history
// ============================================================
router.get('/history', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        ps.id,
        ps.mode,
        ps.difficulty,
        ps.question_count,
        ps.answered_count,
        ps.correct_count,
        ps.wrong_count,
        ps.accuracy,
        ps.started_at,
        ps.completed_at,
        ps.duration_seconds,

        c.id AS course_id,
        c.code AS course_code,
        c.title AS course_title,

        t.id AS topic_id,
        t.name AS topic_name

      FROM practice_sessions ps

      JOIN courses c
        ON c.id = ps.course_id

      LEFT JOIN topics t
        ON t.id = ps.topic_id

      WHERE ps.user_id = $1

      ORDER BY ps.started_at DESC

      LIMIT 50
    `, [req.user.id]);

    return success(res, result.rows);

  } catch (err) {
    console.error('practice history error:', err.message);
    return error(res, 'Failed to load practice history', 500);
  }
});

// ============================================================
// GET /api/practice/weak-areas
// ============================================================
router.get('/weak-areas', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        sk.course_id,
        c.code AS course_code,
        c.title AS course_title,

        sk.topic_id,
        t.name AS topic_name,

        sk.knowledge_level,
        sk.strength,
        sk.last_practiced_at

      FROM student_knowledge sk

      JOIN courses c
        ON c.id = sk.course_id

      LEFT JOIN topics t
        ON t.id = sk.topic_id

      WHERE sk.user_id = $1
        AND sk.strength IN (
          'weak'::knowledge_strength,
          'medium'::knowledge_strength
        )

      ORDER BY
        sk.knowledge_level ASC,
        sk.last_practiced_at ASC

      LIMIT 20
    `, [req.user.id]);

    return success(res, result.rows);

  } catch (err) {
    console.error('weak areas error:', err.message);
    return error(res, 'Failed to load weak areas', 500);
  }
});

module.exports = router;
