const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error } = require('../utils/response');

// ── Super admin only middleware ───────────────────────────────
const superOnly = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return error(res, 'Super admin access required', 403);
  }
  next();
};

// ════════════════════════════════════════════════════════════
// GET /api/admin/stats — platform overview
// ════════════════════════════════════════════════════════════
router.get('/stats', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const stats = await query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'student')           AS students,
        (SELECT COUNT(*) FROM users WHERE role = 'admin')             AS admins,
        (SELECT COUNT(*) FROM users WHERE role = 'super_admin')       AS super_admins,
        (SELECT COUNT(*) FROM users WHERE role = 'tutor')             AS tutors,
        (SELECT COUNT(*) FROM users
         WHERE created_at > NOW() - INTERVAL '7 days')                AS new_users_week,
        (SELECT COUNT(*) FROM institutions)                           AS institutions,
        (SELECT COUNT(*) FROM courses)                                AS courses,
        (SELECT COUNT(*) FROM course_materials)                       AS total_materials,
        (SELECT COUNT(*) FROM course_materials WHERE is_approved = FALSE) AS pending_materials,
        (SELECT COUNT(*) FROM past_questions)                         AS total_pqs,
        (SELECT COUNT(*) FROM past_questions WHERE is_approved = FALSE)  AS pending_pqs,
        (SELECT COUNT(*) FROM exam_attempts WHERE is_submitted = TRUE) AS total_attempts,
        (SELECT COUNT(*) FROM ai_conversations)                       AS ai_conversations,
        (SELECT COALESCE(SUM(tokens_used),0) FROM ai_usage_logs)      AS total_tokens,
        (SELECT COUNT(*) FROM subscriptions WHERE plan = 'premium'
         AND status = 'active')                                        AS premium_users
    `);
    return success(res, stats.rows[0]);
  } catch (err) {
    return error(res, 'Failed to fetch stats', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/admin/users — list all users with filters
// ════════════════════════════════════════════════════════════
router.get('/users', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let conditions = [];

    if (role) { params.push(role); conditions.push(`u.role = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM users u ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(`
      SELECT
        u.id, u.full_name, u.email, u.role, u.is_verified,
        u.last_login_at, u.created_at,
        sp.level, sp.matric_number,
        i.name AS institution_name, i.short_name,
        d.name AS department_name,
        s.plan AS subscription_plan
      FROM users u
      LEFT JOIN student_profiles sp ON sp.user_id = u.id
      LEFT JOIN institutions i ON i.id = sp.institution_id
      LEFT JOIN departments d ON d.id = sp.department_id
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      ${where}
      ORDER BY u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    return success(res, {
      users: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error(err.message);
    return error(res, 'Failed to fetch users', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/admin/users — create admin user (super_admin only)
// ════════════════════════════════════════════════════════════
router.post('/users', authenticate, superOnly, async (req, res) => {
  try {
    const { full_name, email, password, role = 'admin' } = req.body;
    if (!full_name || !email || !password) {
      return error(res, 'full_name, email and password are required', 400);
    }
    if (!['admin', 'lecturer'].includes(role)) {
      return error(res, 'Can only create admin or lecturer accounts', 400);
    }
    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) return error(res, 'Email already exists', 409);

    const hash = await bcrypt.hash(password, 12);
    const result = await query(`
      INSERT INTO users (full_name, email, password_hash, role, is_verified)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, full_name, email, role, created_at
    `, [full_name, email, hash, role]);

    await query(`
      INSERT INTO subscriptions (user_id, plan, status) VALUES ($1, 'premium', 'active')
    `, [result.rows[0].id]);

    return success(res, result.rows[0], `${role} account created`, 201);
  } catch (err) {
    return error(res, 'Failed to create user', 500);
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/admin/users/:id/role — change user role (super_admin only)
// ════════════════════════════════════════════════════════════
router.patch('/users/:id/role', authenticate, superOnly, async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ['student', 'tutor', 'lecturer', 'admin'];
    if (!allowed.includes(role)) return error(res, 'Invalid role', 400);

    const result = await query(`
      UPDATE users SET role = $1, updated_at = NOW()
      WHERE id = $2 RETURNING id, full_name, email, role
    `, [role, req.params.id]);
    if (result.rows.length === 0) return error(res, 'User not found', 404);
    return success(res, result.rows[0], 'Role updated');
  } catch (err) {
    return error(res, 'Update failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/admin/users/:id — delete user (super_admin only)
// ════════════════════════════════════════════════════════════
router.delete('/users/:id', authenticate, superOnly, async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      return error(res, 'Cannot delete your own account', 400);
    }
    // Prevent deleting other super_admins
    const target = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (target.rows[0]?.role === 'super_admin') {
      return error(res, 'Cannot delete a super admin account', 403);
    }
    // Clean up referral records before deleting user
    await query('DELETE FROM referrals WHERE referrer_id = $1 OR referred_id = $1', [req.params.id]);
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    return success(res, {}, 'User deleted');
  } catch (err) {
    return error(res, 'Delete failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/admin/content/pending — all pending approvals
// ════════════════════════════════════════════════════════════
router.get('/content/pending', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const materials = await query(`
      SELECT cm.id, cm.title, cm.material_type, cm.file_name, cm.file_size_kb, cm.created_at,
             'material' AS content_type,
             u.full_name AS uploader, u.email AS uploader_email,
             c.title AS course_title, c.code AS course_code
      FROM course_materials cm
      JOIN users u ON u.id = cm.uploaded_by
      JOIN courses c ON c.id = cm.course_id
      WHERE cm.is_approved = FALSE
      ORDER BY cm.created_at ASC
    `);

    const pqs = await query(`
      SELECT pq.id, pq.year::text AS title, pq.exam_type, pq.file_url, pq.created_at,
             'past_question' AS content_type,
             u.full_name AS uploader, u.email AS uploader_email,
             c.title AS course_title, c.code AS course_code
      FROM past_questions pq
      JOIN users u ON u.id = pq.uploaded_by
      JOIN courses c ON c.id = pq.course_id
      WHERE pq.is_approved = FALSE
      ORDER BY pq.created_at ASC
    `);

    return success(res, {
      materials:      materials.rows,
      past_questions: pqs.rows,
      total_pending:  materials.rows.length + pqs.rows.length
    });
  } catch (err) {
    return error(res, 'Failed to fetch pending content', 500);
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/admin/content/:type/:id/approve
// ════════════════════════════════════════════════════════════
router.patch('/content/:type/:id/approve', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type === 'material') {
      await query('UPDATE course_materials SET is_approved = TRUE WHERE id = $1', [id]);
    } else if (type === 'past_question') {
      await query('UPDATE past_questions SET is_approved = TRUE WHERE id = $1', [id]);
    } else {
      return error(res, 'Invalid content type', 400);
    }
    return success(res, {}, 'Content approved and published');
  } catch (err) {
    return error(res, 'Approval failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/admin/content/:type/:id/reject
// ════════════════════════════════════════════════════════════
router.patch('/content/:type/:id/reject', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type === 'material') {
      await query('DELETE FROM course_materials WHERE id = $1', [id]);
    } else if (type === 'past_question') {
      await query('DELETE FROM past_questions WHERE id = $1', [id]);
    } else {
      return error(res, 'Invalid content type', 400);
    }
    return success(res, {}, 'Content rejected and removed');
  } catch (err) {
    return error(res, 'Rejection failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/admin/activity — recent platform activity
// ════════════════════════════════════════════════════════════
router.get('/activity', authenticate, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM (
        SELECT 'New student' AS event, u.full_name AS actor,
               i.short_name AS detail, u.created_at AS time
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN institutions i ON i.id = sp.institution_id
        WHERE u.role = 'student'
        ORDER BY u.created_at DESC LIMIT 5
      ) students
      UNION ALL
      SELECT * FROM (
        SELECT 'Material uploaded' AS event, u.full_name AS actor,
               cm.title AS detail, cm.created_at AS time
        FROM course_materials cm JOIN users u ON u.id = cm.uploaded_by
        ORDER BY cm.created_at DESC LIMIT 5
      ) materials
      UNION ALL
      SELECT * FROM (
        SELECT 'Exam attempted' AS event, u.full_name AS actor,
               e.title AS detail, ea.started_at AS time
        FROM exam_attempts ea
        JOIN users u ON u.id = ea.student_id
        JOIN exams e ON e.id = ea.exam_id
        WHERE ea.is_submitted = TRUE
        ORDER BY ea.submitted_at DESC LIMIT 5
      ) exams
      ORDER BY time DESC LIMIT 15
    `);
    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch activity', 500);
  }
});

module.exports = router;
