const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

router.use(authenticate, (req, res, next) => {
  if (req.user.role !== 'student') return error(res, 'Student account required', 403);
  next();
});

const defaults = () => ({ status: 'draft', step: 0, preferred_name: '', goals: [], course_ids: [], modes: [], daily_minutes: 30, weekly_target: 3 });
const catalogue = userId => query(`
  SELECT c.id, c.code, c.title, c.level, c.semester, c.credit_units
  FROM courses c JOIN student_profiles sp ON sp.department_id = c.department_id
  WHERE sp.user_id = $1 AND c.is_active = TRUE AND c.level::text = sp.level::text
  ORDER BY c.code, c.id`, [userId]);

router.get('/settings', async (req, res) => {
  try {
    const [saved, courses] = await Promise.all([
      query('SELECT settings FROM student_settings WHERE user_id = $1', [req.user.id]), catalogue(req.user.id)
    ]);
    return success(res, { settings: { ...defaults(), ...saved.rows[0]?.settings }, courses: courses.rows });
  } catch (err) { console.error('Student settings:', err.message); return error(res, 'Could not load your study setup. Please try again.', 500); }
});

router.put('/settings', async (req, res) => {
  try {
    const b = req.body;
    const allowed = (items, list, max) => Array.isArray(items) && items.length <= max && items.every(x => typeof x === 'string' && list.includes(x)) && new Set(items).size === items.length;
    if (!b || !['draft','complete','skipped'].includes(b.status) || !Number.isInteger(b.step) || b.step < 0 || b.step > 5 ||
      typeof b.preferred_name !== 'string' || b.preferred_name.trim().length > 60 ||
      !allowed(b.goals, ['understand','exams','papers','ai','progress','habit'], 6) ||
      !allowed(b.modes, ['quick','deep','exam','practice'], 4) ||
      ![15,30,60,120].includes(b.daily_minutes) || !Number.isInteger(b.weekly_target) || b.weekly_target < 1 || b.weekly_target > 14 ||
      !Array.isArray(b.course_ids) || b.course_ids.length > 60 || b.course_ids.some(id => typeof id !== 'string') || new Set(b.course_ids).size !== b.course_ids.length) {
      return error(res, 'Check your study choices and try again.', 400);
    }
    const courses = await catalogue(req.user.id);
    const ids = new Set(courses.rows.map(c => c.id));
    if (b.course_ids.some(id => !ids.has(id))) return error(res, 'Some courses are no longer available for your department and level. Reload your setup.', 400);
    const settings = {
      status: b.status, step: b.status === 'draft' ? b.step : 5,
      preferred_name: b.preferred_name.trim(), goals: b.goals, course_ids: b.course_ids,
      modes: b.modes, daily_minutes: b.daily_minutes, weekly_target: b.weekly_target
    };
    // Explicit fields only. The authenticated user ID is never accepted from the request body.
    await query(`INSERT INTO student_settings (user_id, settings) VALUES ($1, $2::jsonb)
      ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`, [req.user.id, JSON.stringify(settings)]);
    return success(res, { settings }, 'Study setup saved');
  } catch (err) { console.error('Save student settings:', err.message); return error(res, 'Your choices were not saved. Please try again.', 500); }
});

router.get('/overview', async (req, res) => {
  try {
    const [exams, knowledge, ai] = await Promise.all([
      query(`SELECT COUNT(*)::int AS attempts, ROUND(AVG(percent_score)::numeric, 1) AS average,
        COUNT(*) FILTER (WHERE (submitted_at AT TIME ZONE 'Africa/Lagos') >= date_trunc('week', NOW() AT TIME ZONE 'Africa/Lagos'))::int AS weekly_attempts
        FROM exam_attempts WHERE student_id = $1 AND is_submitted = TRUE`, [req.user.id]),
      query(`SELECT c.id, c.code, c.title, ROUND(AVG(sk.knowledge_level))::int AS knowledge,
        COUNT(*) FILTER (WHERE sk.strength = 'weak')::int AS weak_topics
        FROM student_knowledge sk JOIN courses c ON c.id = sk.course_id
        WHERE sk.user_id = $1 GROUP BY c.id, c.code, c.title ORDER BY knowledge DESC, c.code`, [req.user.id]),
      query('SELECT COUNT(*)::int AS messages FROM ai_usage_logs WHERE user_id = $1', [req.user.id])
    ]);
    return success(res, { exams: exams.rows[0], courses: knowledge.rows, ai_messages: ai.rows[0].messages });
  } catch (err) { console.error('Student overview:', err.message); return error(res, 'Could not load your academic progress. Please try again.', 500); }
});

module.exports = router;
