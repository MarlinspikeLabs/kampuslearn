const router = require('express').Router();
const { query }          = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error } = require('../utils/response');

// ════════════════════════════════════════════════════════════
// GET /api/exams
// List available exams — filter by course
// ?course_id=  &page=  &limit=
// ════════════════════════════════════════════════════════════
router.get('/', authenticate, async (req, res) => {
  try {
    const { course_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = ["'active'"];
    let conditions = [`e.status = 'active'`, `e.is_public = TRUE`];

    if (course_id) {
      params.push(course_id);
      conditions.push(`e.course_id = $${params.length}`);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const result = await query(`
      SELECT
        e.id, e.title, e.description,
        e.duration_minutes, e.total_marks,
        e.question_count, e.pass_mark, e.is_timed,
        e.created_at,
        c.title      AS course_title,
        c.code       AS course_code,
        c.level      AS course_level,
        c.level_type AS course_level_type,
        u.full_name  AS created_by,
        (SELECT COUNT(*) FROM exam_attempts ea
         WHERE ea.exam_id = e.id
           AND ea.student_id = $1
           AND ea.is_submitted = TRUE) AS attempt_count
      FROM exams e
      JOIN courses c ON c.id = e.course_id
      JOIN users   u ON u.id = e.created_by
      WHERE e.status = 'active' AND e.is_public = TRUE
      ${course_id ? 'AND e.course_id = $2' : ''}
      ORDER BY e.created_at DESC
      LIMIT $${course_id ? 3 : 2} OFFSET $${course_id ? 4 : 3}
    `, course_id
        ? [req.user.id, course_id, parseInt(limit), offset]
        : [req.user.id, parseInt(limit), offset]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('exams list error:', err.message);
    return error(res, 'Failed to fetch exams', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/exams/:id
// Exam details with questions (NO correct answers sent to student)
// ════════════════════════════════════════════════════════════
router.get('/:id', authenticate, async (req, res) => {
  // Guard: don't match reserved paths
  if (req.params.id === 'attempts') {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  try {
    const exam = await query(`
      SELECT
        e.*,
        c.title      AS course_title,
        c.code       AS course_code,
        c.level      AS course_level,
        c.level_type AS course_level_type
      FROM exams e
      JOIN courses c ON c.id = e.course_id
      WHERE e.id = $1 AND e.status = 'active'
    `, [req.params.id]);

    if (exam.rows.length === 0) return error(res, 'Exam not found', 404);

    // Fetch questions — shuffle, never send correct_answer
    const questions = await query(`
      SELECT
        q.id, q.question_text, q.question_type,
        q.options, q.marks, q.difficulty,
        t.name AS topic_name
      FROM exam_questions eq
      JOIN questions q ON q.id = eq.question_id
      LEFT JOIN topics t ON t.id = q.topic_id
      WHERE eq.exam_id = $1
      ORDER BY RANDOM()
    `, [req.params.id]);

    return success(res, {
      exam: exam.rows[0],
      questions: questions.rows
    });
  } catch (err) {
    return error(res, 'Failed to fetch exam', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/exams/:id/start
// Start or resume an exam attempt
// ════════════════════════════════════════════════════════════
router.post('/:id/start', authenticate, async (req, res) => {
  try {
    // Check if exam exists and is active
    const exam = await query(
      `SELECT id, duration_minutes, question_count FROM exams WHERE id = $1 AND status = 'active'`,
      [req.params.id]
    );
    if (exam.rows.length === 0) return error(res, 'Exam not found or not active', 404);

    // Resume existing incomplete attempt
    const existing = await query(`
      SELECT id, started_at FROM exam_attempts
      WHERE exam_id = $1 AND student_id = $2 AND is_submitted = FALSE
    `, [req.params.id, req.user.id]);

    if (existing.rows.length > 0) {
      const attempt    = existing.rows[0];
      const elapsed    = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
      const remaining  = (exam.rows[0].duration_minutes * 60) - elapsed;
      return success(res, {
        attempt_id:       attempt.id,
        started_at:       attempt.started_at,
        time_remaining_s: Math.max(0, remaining),
        resumed:          true
      }, 'Exam resumed');
    }

    // Create new attempt
    const result = await query(`
      INSERT INTO exam_attempts (exam_id, student_id)
      VALUES ($1, $2)
      RETURNING id, started_at
    `, [req.params.id, req.user.id]);

    return success(res, {
      attempt_id:       result.rows[0].id,
      started_at:       result.rows[0].started_at,
      time_remaining_s: exam.rows[0].duration_minutes * 60,
      resumed:          false
    }, 'Exam started', 201);
  } catch (err) {
    console.error('start exam error:', err.message);
    return error(res, 'Failed to start exam', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/exams/attempts/:attemptId/submit
// Submit answers and auto-grade
// Body: { answers: { "question_id": "A", ... } }
// ════════════════════════════════════════════════════════════
router.post('/attempts/:attemptId/submit', authenticate, async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return error(res, 'answers object is required', 400);
    }

    // Verify attempt ownership
    const attempt = await query(`
      SELECT ea.*, e.pass_mark, e.duration_minutes, e.course_id
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.id = $1 AND ea.student_id = $2 AND ea.is_submitted = FALSE
    `, [req.params.attemptId, req.user.id]);

    if (attempt.rows.length === 0) {
      return error(res, 'Attempt not found or already submitted', 404);
    }

    const att      = attempt.rows[0];
    const passMark = att.pass_mark || 40;

    // Auto-expire check: if time exceeded, still allow submission
    const elapsed       = Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000);
    const timeTakenSecs = Math.min(elapsed, att.duration_minutes * 60);

    // Fetch all questions for this exam with correct answers
    const questions = await query(`
      SELECT q.id, q.correct_answer, q.marks
      FROM exam_questions eq
      JOIN questions q ON q.id = eq.question_id
      WHERE eq.exam_id = $1
    `, [att.exam_id]);

    // Grade each answer
    let totalScore = 0;
    let totalMarks = 0;
    const graded   = [];

    for (const q of questions.rows) {
      totalMarks += parseInt(q.marks);
      const studentAnswer = answers[q.id] ? answers[q.id].toString().trim().toUpperCase() : null;
      const correctAnswer = q.correct_answer.trim().toUpperCase();
      const isCorrect     = studentAnswer === correctAnswer;
      const marksEarned   = isCorrect ? parseInt(q.marks) : 0;
      totalScore += marksEarned;

      graded.push({
        question_id:    q.id,
        student_answer: studentAnswer,
        correct_answer: correctAnswer,
        is_correct:     isCorrect,
        marks_earned:   marksEarned
      });
    }

    const percentScore = totalMarks > 0
      ? Math.round((totalScore / totalMarks) * 10000) / 100
      : 0;
    const passed = percentScore >= passMark;

    // Save individual attempt answers
    for (const ans of graded) {
      await query(`
        INSERT INTO attempt_answers
          (attempt_id, question_id, student_answer, is_correct, marks_earned)
        VALUES ($1,$2,$3,$4,$5)
      `, [att.id, ans.question_id, ans.student_answer, ans.is_correct, ans.marks_earned]);
    }

    // Update the attempt record
    await query(`
      UPDATE exam_attempts
      SET answers       = $1,
          score         = $2,
          total_marks   = $3,
          percent_score = $4,
          time_taken_secs = $5,
          is_submitted  = TRUE,
          submitted_at  = NOW()
      WHERE id = $6
    `, [
      JSON.stringify(answers),
      totalScore, totalMarks, percentScore,
      timeTakenSecs, att.id
    ]);

    // Update student knowledge — wrapped in try/catch so failures never block submission
    const wrongQuestions = graded.filter(g => !g.is_correct);
    for (const wrong of wrongQuestions) {
      const topicResult = await query(
        'SELECT topic_id FROM questions WHERE id = $1', [wrong.question_id]
      );
      const topicId = topicResult.rows[0]?.topic_id;

      await query(`
        INSERT INTO student_knowledge
          (user_id, course_id, topic_id, knowledge_level, strength, last_practiced_at)
        VALUES ($1, $2, $3, 10, 'weak'::knowledge_strength, NOW())
        ON CONFLICT (user_id, course_id, topic_id)
        DO UPDATE SET
          knowledge_level  = GREATEST(student_knowledge.knowledge_level - 5, 0),
          strength         = 'weak'::knowledge_strength,
          last_practiced_at = NOW(),
          updated_at       = NOW()
      `, [req.user.id, att.course_id, topicId || null]);
    }

    // Boost knowledge for correct answers
    const correctQuestions = graded.filter(g => g.is_correct);
    for (const correct of correctQuestions) {
      const topicResult = await query(
        'SELECT topic_id, course_id FROM questions WHERE id = $1', [correct.question_id]
      );
      const row = topicResult.rows[0];

      try {
        await query(`
          INSERT INTO student_knowledge
            (user_id, course_id, topic_id, knowledge_level, strength, last_practiced_at)
          VALUES ($1, $2, $3, 20, 'weak'::knowledge_strength, NOW())
          ON CONFLICT (user_id, course_id, topic_id)
          DO UPDATE SET
            knowledge_level = LEAST(
              student_knowledge.knowledge_level + 10, 100
            ),
            strength = CASE
              WHEN student_knowledge.knowledge_level + 10 >= 80 THEN 'strong'::knowledge_strength
              WHEN student_knowledge.knowledge_level + 10 >= 50 THEN 'medium'::knowledge_strength
              ELSE 'weak'::knowledge_strength
            END,
            last_practiced_at = NOW(),
            updated_at = NOW()
        `, [req.user.id, att.course_id, row?.topic_id || null]);
      } catch (knowledgeErr) {
        console.warn('Knowledge update failed (non-fatal):', knowledgeErr.message);
      }
    }

    return success(res, {
      attempt_id:      att.id,
      score:           totalScore,
      total_marks:     totalMarks,
      percent_score:   percentScore,
      passed,
      pass_mark:       passMark,
      time_taken_secs: timeTakenSecs,
      correct_count:   correctQuestions.length,
      wrong_count:     wrongQuestions.length,
      total_questions: graded.length,
      results:         graded
    }, passed ? '🎉 Congratulations! You passed!' : 'Exam submitted. Keep practicing!');
  } catch (err) {
    console.error('submit exam error:', err.message);
    return error(res, 'Submission failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/exams/attempts/history
// Student's exam attempt history
// ════════════════════════════════════════════════════════════
router.get('/attempts/history', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        ea.id, ea.score, ea.total_marks, ea.percent_score,
        ea.time_taken_secs, ea.started_at, ea.submitted_at,
        e.title      AS exam_title,
        e.pass_mark,
        c.title      AS course_title,
        c.code       AS course_code,
        c.level      AS course_level
      FROM exam_attempts ea
      JOIN exams   e ON e.id = ea.exam_id
      JOIN courses c ON c.id = e.course_id
      WHERE ea.student_id = $1 AND ea.is_submitted = TRUE
      ORDER BY ea.submitted_at DESC
      LIMIT 50
    `, [req.user.id]);

    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch history', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/exams/attempts/:attemptId/review
// Review a submitted attempt with correct answers revealed
// ════════════════════════════════════════════════════════════
router.get('/attempts/:attemptId/review', authenticate, async (req, res) => {
  try {
    const attempt = await query(`
      SELECT ea.*, e.title AS exam_title, e.pass_mark,
             c.title AS course_title, c.code AS course_code
      FROM exam_attempts ea
      JOIN exams   e ON e.id = ea.exam_id
      JOIN courses c ON c.id = e.course_id
      WHERE ea.id = $1 AND ea.student_id = $2 AND ea.is_submitted = TRUE
    `, [req.params.attemptId, req.user.id]);

    if (attempt.rows.length === 0) {
      return error(res, 'Attempt not found', 404);
    }

    const answers = await query(`
      SELECT
        aa.student_answer, aa.is_correct, aa.marks_earned,
        q.question_text, q.question_type, q.options,
        q.correct_answer, q.explanation,
        q.difficulty, q.marks,
        t.name AS topic_name
      FROM attempt_answers aa
      JOIN questions q ON q.id = aa.question_id
      LEFT JOIN topics t ON t.id = q.topic_id
      WHERE aa.attempt_id = $1
      ORDER BY aa.id
    `, [req.params.attemptId]);

    return success(res, {
      attempt:  attempt.rows[0],
      answers:  answers.rows
    });
  } catch (err) {
    return error(res, 'Failed to fetch review', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/exams  (admin / lecturer only)
// Create an exam from question bank
// ════════════════════════════════════════════════════════════
router.post('/', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  try {
    const {
      course_id, title, description,
      duration_minutes = 60, total_marks = 100,
      pass_mark = 40, is_timed = true,
      question_ids   // array of question UUIDs
    } = req.body;

    if (!course_id || !title || !question_ids?.length) {
      return error(res, 'course_id, title, and question_ids are required', 400);
    }

    const exam = await query(`
      INSERT INTO exams
        (course_id, created_by, title, description,
         duration_minutes, total_marks, question_count, pass_mark, is_timed)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, title, duration_minutes, total_marks, question_count
    `, [
      course_id, req.user.id, title.trim(), description || null,
      parseInt(duration_minutes), parseInt(total_marks),
      question_ids.length, parseInt(pass_mark), is_timed
    ]);

    const examId = exam.rows[0].id;

    // Link questions to exam
    for (let i = 0; i < question_ids.length; i++) {
      await query(
        'INSERT INTO exam_questions (exam_id, question_id, order_num) VALUES ($1,$2,$3)',
        [examId, question_ids[i], i + 1]
      );
    }

    return success(res, exam.rows[0], 'Exam created successfully', 201);
  } catch (err) {
    console.error('create exam error:', err.message);
    return error(res, 'Failed to create exam', 500);
  }
});

module.exports = router;
