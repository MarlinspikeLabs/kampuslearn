const router  = require('express').Router();
const { query }              = require('../config/database');
const { authenticate }       = require('../middleware/auth');
const { success, error }     = require('../utils/response');
const { getAIResponse }      = require('../services/ai/aiService');

const FREE_DAILY_LIMIT    = 20;
const PREMIUM_DAILY_LIMIT = 200;

// ── Get user's daily usage ────────────────────────────────────
async function getDailyUsage(userId) {
  const r = await query(`
    SELECT COUNT(*) AS messages, COALESCE(SUM(tokens_used), 0) AS tokens
    FROM ai_usage_logs
    WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '24 hours'
      AND feature = 'chat'
  `, [userId]);
  return r.rows[0];
}

// ── Get user's active plan ────────────────────────────────────
async function getUserPlan(userId) {
  const r = await query(`
    SELECT plan FROM subscriptions
    WHERE user_id = $1 AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `, [userId]);
  return r.rows[0]?.plan || 'free';
}

// ── Get student's weak topics ─────────────────────────────────
async function getWeakTopics(userId, courseId) {
  const r = await query(`
    SELECT t.name
    FROM student_knowledge sk
    LEFT JOIN topics t ON t.id = sk.topic_id
    WHERE sk.user_id = $1
      AND ($2::uuid IS NULL OR sk.course_id = $2)
      AND sk.strength = 'weak'
    ORDER BY sk.knowledge_level ASC
    LIMIT 5
  `, [userId, courseId || null]);
  return r.rows.map(row => row.name).filter(Boolean);
}

// ════════════════════════════════════════════════════════════
// GET /api/ai/conversations
// List user's conversation history
// ════════════════════════════════════════════════════════════
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        ac.id, ac.title, ac.created_at, ac.updated_at,
        c.title AS course_title, c.code AS course_code,
        (SELECT COUNT(*) FROM ai_messages am WHERE am.conversation_id = ac.id) AS message_count
      FROM ai_conversations ac
      LEFT JOIN courses c ON c.id = ac.course_id
      WHERE ac.user_id = $1
      ORDER BY ac.updated_at DESC
      LIMIT 30
    `, [req.user.id]);
    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch conversations', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/ai/conversations/:id
// Get a conversation with all messages
// ════════════════════════════════════════════════════════════
router.get('/conversations/:id', authenticate, async (req, res) => {
  try {
    const convo = await query(`
      SELECT ac.*, c.title AS course_title, c.code AS course_code
      FROM ai_conversations ac
      LEFT JOIN courses c ON c.id = ac.course_id
      WHERE ac.id = $1 AND ac.user_id = $2
    `, [req.params.id, req.user.id]);

    if (convo.rows.length === 0) return error(res, 'Conversation not found', 404);

    const messages = await query(`
      SELECT id, role, content, tokens_used, created_at
      FROM ai_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `, [req.params.id]);

    return success(res, { conversation: convo.rows[0], messages: messages.rows });
  } catch (err) {
    return error(res, 'Failed to fetch conversation', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/ai/chat
// Send a message to the AI tutor
// Body: { message, conversation_id?, course_id? }
// ════════════════════════════════════════════════════════════
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, conversation_id, course_id } = req.body;

    if (!message || message.trim().length === 0) {
      return error(res, 'Message is required', 400);
    }
    if (message.length > 2000) {
      return error(res, 'Message too long (max 2000 characters)', 400);
    }

    // ── Check daily usage limit ───────────────────────────────
    const plan  = await getUserPlan(req.user.id);
    const usage = await getDailyUsage(req.user.id);
    const limit = plan === 'free' ? FREE_DAILY_LIMIT : PREMIUM_DAILY_LIMIT;

    if (parseInt(usage.messages) >= limit) {
      return error(res,
        plan === 'free'
          ? `Daily limit of ${FREE_DAILY_LIMIT} messages reached. Upgrade to Premium for unlimited access.`
          : `Daily limit of ${PREMIUM_DAILY_LIMIT} messages reached.`,
        429
      );
    }

    // ── Get or create conversation ────────────────────────────
    let convoId = conversation_id;
    if (!convoId) {
      const title = message.length > 80
        ? message.substring(0, 77) + '...'
        : message;
      const newConvo = await query(`
        INSERT INTO ai_conversations (user_id, course_id, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [req.user.id, course_id || null, title]);
      convoId = newConvo.rows[0].id;
    }

    // ── Fetch last 10 messages for context ────────────────────
    const history = await query(`
      SELECT role, content
      FROM ai_messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC LIMIT 10
    `, [convoId]);
    const messageHistory = history.rows.reverse();

    // ── Get course context ────────────────────────────────────
    let courseContext = null;
    if (course_id) {
      const courseResult = await query(
        'SELECT id, title, code, level, level_type, description FROM courses WHERE id = $1',
        [course_id]
      );
      courseContext = courseResult.rows[0] || null;
    }

    // ── Get student context (weak topics etc.) ────────────────
    const weakTopics = await getWeakTopics(req.user.id, course_id);
    const userContext = {
      full_name:  req.user.full_name,
      role:       req.user.role,
      weakTopics: weakTopics.length > 0 ? weakTopics : null
    };

    // ── Save user message ─────────────────────────────────────
    await query(`
      INSERT INTO ai_messages (conversation_id, role, content)
      VALUES ($1, 'user', $2)
    `, [convoId, message.trim()]);

    // ── Call AI service ───────────────────────────────────────
    const aiResult = await getAIResponse(
      [...messageHistory, { role: 'user', content: message }],
      courseContext,
      userContext
    );

    // ── Save AI response ──────────────────────────────────────
    const savedMsg = await query(`
      INSERT INTO ai_messages (conversation_id, role, content, tokens_used)
      VALUES ($1, 'assistant', $2, $3)
      RETURNING id, created_at
    `, [convoId, aiResult.content, aiResult.tokens_used]);

    // ── Update conversation timestamp ─────────────────────────
    await query(`
      UPDATE ai_conversations
      SET updated_at = NOW()
      WHERE id = $1
    `, [convoId]);

    // ── Log usage ─────────────────────────────────────────────
    await query(`
      INSERT INTO ai_usage_logs (user_id, tokens_used, feature)
      VALUES ($1, $2, 'chat')
    `, [req.user.id, aiResult.tokens_used]);

    return success(res, {
      conversation_id: convoId,
      message_id:      savedMsg.rows[0].id,
      reply:           aiResult.content,
      provider:        aiResult.provider,
      usage: {
        messages_today: parseInt(usage.messages) + 1,
        limit,
        remaining: limit - parseInt(usage.messages) - 1,
        plan
      }
    });

  } catch (err) {
    console.error('AI chat error:', err.message);
    return error(res, 'AI service temporarily unavailable', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/ai/generate-quiz
// Generate quiz questions for a course/topic
// Body: { course_id, topic?, count? }
// ════════════════════════════════════════════════════════════
router.post('/generate-quiz', authenticate, async (req, res) => {
  try {
    const { course_id, topic, count = 5 } = req.body;
    if (!course_id) return error(res, 'course_id is required', 400);

    const courseResult = await query(
      'SELECT id, title, code, level, level_type FROM courses WHERE id = $1',
      [course_id]
    );
    if (courseResult.rows.length === 0) return error(res, 'Course not found', 404);
    const course = courseResult.rows[0];

    const prompt = `generate ${count} practice questions for ${course.title} (${course.code}) on topic: ${topic || 'general revision'}`;
    const aiResult = await getAIResponse(
      [{ role: 'user', content: prompt }],
      course,
      { full_name: req.user.full_name }
    );

    await query(`
      INSERT INTO ai_usage_logs (user_id, tokens_used, feature)
      VALUES ($1, $2, 'quiz_gen')
    `, [req.user.id, aiResult.tokens_used]);

    return success(res, {
      course:  { title: course.title, code: course.code },
      topic:   topic || 'General Revision',
      content: aiResult.content,
      provider: aiResult.provider
    });
  } catch (err) {
    return error(res, 'Quiz generation failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/ai/usage
// Get current user's AI usage stats
// ════════════════════════════════════════════════════════════
router.get('/usage', authenticate, async (req, res) => {
  try {
    const plan  = await getUserPlan(req.user.id);
    const daily = await getDailyUsage(req.user.id);
    const limit = plan === 'free' ? FREE_DAILY_LIMIT : PREMIUM_DAILY_LIMIT;

    return success(res, {
      plan,
      messages_today: parseInt(daily.messages),
      tokens_today:   parseInt(daily.tokens),
      daily_limit:    limit,
      remaining:      Math.max(0, limit - parseInt(daily.messages))
    });
  } catch (err) {
    return error(res, 'Failed to fetch usage', 500);
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/ai/conversations/:id
// Delete a conversation and all its messages
// ════════════════════════════════════════════════════════════
router.delete('/conversations/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      DELETE FROM ai_conversations
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) return error(res, 'Conversation not found', 404);
    return success(res, {}, 'Conversation deleted');
  } catch (err) {
    return error(res, 'Delete failed', 500);
  }
});

module.exports = router;
