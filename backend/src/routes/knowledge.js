const router = require('express').Router();
const { query }      = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

// ════════════════════════════════════════════════════════════
// GET /api/knowledge/me
// Full knowledge profile for the logged-in student
// ════════════════════════════════════════════════════════════
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        sk.id, sk.knowledge_level, sk.strength,
        sk.last_practiced_at, sk.updated_at,
        c.id    AS course_id,
        c.title AS course_title,
        c.code  AS course_code,
        c.level AS course_level,
        c.level_type,
        t.id    AS topic_id,
        t.name  AS topic_name
      FROM student_knowledge sk
      JOIN courses c ON c.id = sk.course_id
      LEFT JOIN topics t ON t.id = sk.topic_id
      WHERE sk.user_id = $1
      ORDER BY sk.strength ASC, sk.knowledge_level ASC
    `, [req.user.id]);

    // Group by course
    const byCourse = {};
    for (const row of result.rows) {
      if (!byCourse[row.course_id]) {
        byCourse[row.course_id] = {
          course_id:    row.course_id,
          course_title: row.course_title,
          course_code:  row.course_code,
          course_level: row.course_level,
          level_type:   row.level_type,
          topics: [],
          avg_knowledge: 0,
          weak_count:    0,
          medium_count:  0,
          strong_count:  0
        };
      }
      const course = byCourse[row.course_id];
      course.topics.push({
        topic_id:       row.topic_id,
        topic_name:     row.topic_name || 'General',
        knowledge_level: row.knowledge_level,
        strength:       row.strength,
        last_practiced: row.last_practiced_at
      });
      if (row.strength === 'weak')   course.weak_count++;
      if (row.strength === 'medium') course.medium_count++;
      if (row.strength === 'strong') course.strong_count++;
    }

    // Calculate average knowledge per course
    for (const course of Object.values(byCourse)) {
      const total = course.topics.reduce((sum, t) => sum + t.knowledge_level, 0);
      course.avg_knowledge = course.topics.length
        ? Math.round(total / course.topics.length)
        : 0;
    }

    return success(res, {
      total_topics_tracked: result.rows.length,
      courses: Object.values(byCourse)
    });
  } catch (err) {
    console.error('knowledge me error:', err.message);
    return error(res, 'Failed to fetch knowledge profile', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/knowledge/weak
// Get weak topics for the student — optionally filter by course
// ?course_id=
// ════════════════════════════════════════════════════════════
router.get('/weak', authenticate, async (req, res) => {
  try {
    const { course_id } = req.query;
    const params = [req.user.id];
    let courseFilter = '';
    if (course_id) {
      params.push(course_id);
      courseFilter = `AND sk.course_id = $${params.length}`;
    }

    const result = await query(`
      SELECT
        sk.knowledge_level, sk.strength, sk.last_practiced_at,
        c.title AS course_title, c.code  AS course_code,
        t.name  AS topic_name,  t.id    AS topic_id
      FROM student_knowledge sk
      JOIN courses c ON c.id = sk.course_id
      LEFT JOIN topics t ON t.id = sk.topic_id
      WHERE sk.user_id = $1
        AND sk.strength = 'weak'
        ${courseFilter}
      ORDER BY sk.knowledge_level ASC
      LIMIT 20
    `, params);

    return success(res, {
      weak_topics: result.rows,
      count: result.rows.length,
      recommendation: result.rows.length > 0
        ? `You have ${result.rows.length} weak topic${result.rows.length > 1 ? 's' : ''} to work on. Focus on these before your next exam.`
        : 'Great job! No weak topics detected yet. Keep practicing to build stronger knowledge.'
    });
  } catch (err) {
    return error(res, 'Failed to fetch weak topics', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/knowledge/course/:courseId
// Knowledge breakdown for a specific course
// ════════════════════════════════════════════════════════════
router.get('/course/:courseId', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        sk.knowledge_level, sk.strength, sk.last_practiced_at,
        t.id AS topic_id, t.name AS topic_name, t.order_num
      FROM student_knowledge sk
      LEFT JOIN topics t ON t.id = sk.topic_id
      WHERE sk.user_id = $1 AND sk.course_id = $2
      ORDER BY t.order_num ASC NULLS LAST, sk.knowledge_level ASC
    `, [req.user.id, req.params.courseId]);

    const course = await query(
      'SELECT id, title, code, level, level_type FROM courses WHERE id = $1',
      [req.params.courseId]
    );
    if (course.rows.length === 0) return error(res, 'Course not found', 404);

    const topics      = result.rows;
    const totalTopics = topics.length;
    const avgLevel    = totalTopics
      ? Math.round(topics.reduce((s, t) => s + t.knowledge_level, 0) / totalTopics)
      : 0;

    const breakdown = {
      weak:   topics.filter(t => t.strength === 'weak').length,
      medium: topics.filter(t => t.strength === 'medium').length,
      strong: topics.filter(t => t.strength === 'strong').length
    };

    // Exam readiness score (0-100)
    const readinessScore = totalTopics
      ? Math.round((breakdown.strong * 100 + breakdown.medium * 60 + breakdown.weak * 20) / totalTopics)
      : 0;

    let readinessLabel;
    if (readinessScore >= 80)      readinessLabel = 'Exam Ready';
    else if (readinessScore >= 60) readinessLabel = 'Almost Ready';
    else if (readinessScore >= 40) readinessLabel = 'Needs Practice';
    else                           readinessLabel = 'Just Starting';

    return success(res, {
      course:          course.rows[0],
      avg_knowledge:   avgLevel,
      readiness_score: readinessScore,
      readiness_label: readinessLabel,
      breakdown,
      topics
    });
  } catch (err) {
    return error(res, 'Failed to fetch course knowledge', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/knowledge/stats
// Overall learning stats for the student dashboard
// ════════════════════════════════════════════════════════════
router.get('/stats', authenticate, async (req, res) => {
  try {
    const knowledge = await query(`
      SELECT
        COUNT(*)                                          AS total_tracked,
        COUNT(*) FILTER (WHERE strength = 'weak')        AS weak,
        COUNT(*) FILTER (WHERE strength = 'medium')      AS medium,
        COUNT(*) FILTER (WHERE strength = 'strong')      AS strong,
        ROUND(AVG(knowledge_level))                      AS avg_level,
        COUNT(DISTINCT course_id)                        AS courses_active
      FROM student_knowledge
      WHERE user_id = $1
    `, [req.user.id]);

    const exams = await query(`
      SELECT
        COUNT(*)                                          AS total_attempts,
        COUNT(*) FILTER (WHERE percent_score >= pass_mark) AS passed,
        ROUND(AVG(percent_score), 1)                     AS avg_score,
        MAX(percent_score)                               AS best_score,
        MAX(submitted_at)                                AS last_attempt
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.student_id = $1 AND ea.is_submitted = TRUE
    `, [req.user.id]);

    const materials = await query(`
      SELECT COUNT(*) AS total_downloads
      FROM course_materials
      WHERE id IN (
        SELECT DISTINCT material_id FROM (
          SELECT id AS material_id FROM course_materials LIMIT 0
        ) sub
      )
    `);

    const aiUsage = await query(`
      SELECT
        COUNT(*)                AS total_messages,
        COALESCE(SUM(tokens_used), 0) AS total_tokens
      FROM ai_usage_logs
      WHERE user_id = $1
    `, [req.user.id]);

    return success(res, {
      knowledge:  knowledge.rows[0],
      exams:      exams.rows[0],
      ai_usage:   aiUsage.rows[0]
    });
  } catch (err) {
    console.error('stats error:', err.message);
    return error(res, 'Failed to fetch stats', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/knowledge/update
// Manually update knowledge level for a topic
// (used when student self-reports confidence)
// Body: { course_id, topic_id?, knowledge_level }
// ════════════════════════════════════════════════════════════
router.post('/update', authenticate, async (req, res) => {
  try {
    const { course_id, topic_id, knowledge_level } = req.body;

    if (!course_id || knowledge_level === undefined) {
      return error(res, 'course_id and knowledge_level are required', 400);
    }
    if (knowledge_level < 0 || knowledge_level > 100) {
      return error(res, 'knowledge_level must be between 0 and 100', 400);
    }

    const level    = parseInt(knowledge_level);
    const strength = level >= 80 ? 'strong' : level >= 50 ? 'medium' : 'weak';

    await query(`
      INSERT INTO student_knowledge
        (user_id, course_id, topic_id, knowledge_level, strength, last_practiced_at)
      VALUES ($1, $2, $3, $4, $5::knowledge_strength, NOW())
      ON CONFLICT (user_id, course_id, topic_id)
      DO UPDATE SET
        knowledge_level   = $4,
        strength          = $5::knowledge_strength,
        last_practiced_at = NOW(),
        updated_at        = NOW()
    `, [req.user.id, course_id, topic_id || null, level, strength]);

    return success(res, { knowledge_level: level, strength }, 'Knowledge updated');
  } catch (err) {
    return error(res, 'Update failed', 500);
  }
});

module.exports = router;
