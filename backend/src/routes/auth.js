require('dotenv').config();
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { query }              = require('../config/database');
const { authenticate }       = require('../middleware/auth');
const { success, error }     = require('../utils/response');
const tokenService           = require('../services/tokenService');

// ── Helper: sign JWT ─────────────────────────────────────────
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

// ── Helper: fetch full profile for response ──────────────────
const getFullProfile = async (userId, role) => {
  if (role === 'student') {
    const r = await query(`
      SELECT
        sp.*,
        i.name        AS institution_name,
        i.short_name  AS institution_short,
        i.type        AS institution_type,
        d.name        AS department_name,
        d.code        AS department_code,
        f.name        AS faculty_name,
        s.name        AS school_name,
        ap.id          AS programme_id,
        ap.name        AS programme_name,
        ap.award_type  AS programme_award,
        ap.accreditation_status AS programme_accreditation_status
      FROM student_profiles sp
      JOIN institutions i ON i.id = sp.institution_id
      LEFT JOIN departments d ON d.id = sp.department_id
      LEFT JOIN faculties f ON f.id = sp.faculty_id
      LEFT JOIN schools s ON s.id = sp.school_id
      LEFT JOIN academic_programmes ap ON ap.id = sp.programme_id
      WHERE sp.user_id = $1
    `, [userId]);
    return r.rows[0] || null;
  }
  if (role === 'tutor') {
    const r = await query(
      'SELECT * FROM tutor_profiles WHERE user_id = $1', [userId]
    );
    return r.rows[0] || null;
  }
  return null;
};

// ════════════════════════════════════════════════════════════
// POST /api/auth/register
// ════════════════════════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    const {
      full_name, email, phone, password,
      role = 'student',
      // Student-specific fields
      institution_id, department_id, faculty_id,
      school_id, programme_id, level, matric_number, admission_year,
      referral_code
    } = req.body;

    // ── Validation ───────────────────────────────────────────
    if (!full_name || !email || !password) {
      return error(res, 'Full name, email, and password are required', 400);
    }
    if (password.length < 8) {
      return error(res, 'Password must be at least 8 characters', 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return error(res, 'Invalid email address', 400);
    }
    if (role === 'student') {
      if (!institution_id || !level) {
        return error(res, 'institution_id and level are required for students', 400);
      }
    }

    // ── Check duplicate email ─────────────────────────────────
    const exists = await query(
      'SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]
    );
    if (exists.rows.length > 0) {
      return error(res, 'An account with this email already exists', 409);
    }

    // ── Validate academic track against institution type ──────
    let studentTrack = null;

    if (role === 'student') {
      const inst = await query(
        'SELECT id, type FROM institutions WHERE id = $1 AND is_active = TRUE',
        [institution_id]
      );

      if (inst.rows.length === 0) {
        return error(res, 'Institution not found', 404);
      }

      const instType = inst.rows[0].type;
      const uniLevels = ['100','200','300','400','500','600'];
      const polyLevels = ['ND1','ND2','HND1','HND2'];

      if (instType === 'university') {
        if (!department_id) {
          return error(res, 'department_id is required for university students', 400);
        }

        if (!uniLevels.includes(level)) {
          return error(
            res,
            `University level must be one of: ${uniLevels.join(', ')}`,
            400
          );
        }

        const dept = await query(`
          SELECT d.id
          FROM departments d
          LEFT JOIN faculties f ON f.id = d.faculty_id
          LEFT JOIN schools s ON s.id = d.school_id
          WHERE d.id = $1
            AND COALESCE(f.institution_id, s.institution_id) = $2
        `, [department_id, institution_id]);

        if (dept.rows.length === 0) {
          return error(res, 'Department does not belong to this institution', 400);
        }

        studentTrack = 'department';
      }

      if (instType === 'polytechnic') {
        if (!polyLevels.includes(level)) {
          return error(
            res,
            `Polytechnic level must be one of: ${polyLevels.join(', ')}`,
            400
          );
        }

        // New programme-based polytechnic journey.
        if (programme_id) {
          const programme = await query(`
            SELECT id, award_type, is_active
            FROM academic_programmes
            WHERE id = $1
              AND institution_id = $2
              AND (
                regulator = 'NBTE'
                OR programme_source = 'generic_seed'
              )
          `, [programme_id, institution_id]);

          if (programme.rows.length === 0) {
            return error(res, 'Programme does not belong to this institution', 400);
          }

          if (!programme.rows[0].is_active) {
            return error(res, 'This programme is not currently active', 400);
          }

          const award = programme.rows[0].award_type;

          if (
            (award === 'ND' && !['ND1','ND2'].includes(level)) ||
            (award === 'HND' && !['HND1','HND2'].includes(level))
          ) {
            return error(
              res,
              `${award} programme requires ${award === 'ND' ? 'ND1 or ND2' : 'HND1 or HND2'}`,
              400
            );
          }

          studentTrack = 'programme';

        // Keep the existing school/department path working
        // until the frontend migration is complete.
        } else if (department_id) {

          const dept = await query(`
            SELECT d.id
            FROM departments d
            JOIN schools s ON s.id = d.school_id
            WHERE d.id = $1
              AND s.institution_id = $2
          `, [department_id, institution_id]);

          if (dept.rows.length === 0) {
            return error(res, 'Department does not belong to this polytechnic', 400);
          }

          studentTrack = 'department';

        } else {
          return error(
            res,
            'programme_id is required for new polytechnic students',
            400
          );
        }
      }
    }

    // ── Hash password ─────────────────────────────────────────
    const password_hash = await bcrypt.hash(password, 12);

    // ── Create user ───────────────────────────────────────────
    const userResult = await query(`
      INSERT INTO users (full_name, email, phone, password_hash, role, is_verified)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      RETURNING id, full_name, email, role, is_verified, created_at
    `, [
      full_name.trim(),
      email.toLowerCase().trim(),
      phone || null,
      password_hash,
      role
    ]);
    const user = userResult.rows[0];

    // ── Create student profile ────────────────────────────────
    if (role === 'student') {
      const useProgramme = studentTrack === 'programme';

      await query(`
        INSERT INTO student_profiles
          (
            user_id,
            institution_id,
            department_id,
            faculty_id,
            school_id,
            programme_id,
            level,
            matric_number,
            admission_year
          )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        user.id,
        institution_id,
        useProgramme ? null : department_id,
        useProgramme ? null : (faculty_id || null),
        useProgramme ? null : (school_id || null),
        useProgramme ? programme_id : null,
        level,
        matric_number || null,
        admission_year || null
      ]);
    }

    // ── Create free subscription ──────────────────────────────
    await query(`
      INSERT INTO subscriptions (user_id, plan, status)
      VALUES ($1, 'free', 'active')
    `, [user.id]);

    // ── Welcome token bonus ───────────────────────────────────
    try {
      await tokenService.creditTokens(
        user.id, tokenService.EARN.welcome_bonus,
        'welcome_bonus', 'Welcome to KampusLearn!'
      );
    } catch (e) { console.warn('Welcome bonus failed:', e.message); }

    // ── Process referral if code provided ─────────────────────
    if (req.body.referral_code) {
      try {
        await tokenService.processReferral(user.id, req.body.referral_code);
      } catch (e) { console.warn('Referral bonus failed:', e.message); }
    }

    // ── Sign token & respond ──────────────────────────────────
    const token   = signToken(user.id);
    const profile = await getFullProfile(user.id, role);

    return success(res, { token, user, profile }, 'Account created successfully', 201);

  } catch (err) {
    console.error('Register error:', err.message);
    return error(res, 'Registration failed. Please try again.', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/auth/login
// ════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 'Email and password are required', 400);
    }

    // ── Fetch user ────────────────────────────────────────────
    const result = await query(`
      SELECT id, full_name, email, phone, password_hash,
             role, is_verified, is_suspended, avatar_url, created_at
      FROM users WHERE email = $1
    `, [email.toLowerCase().trim()]);

    if (result.rows.length === 0) {
      return error(res, 'Invalid email or password', 401);
    }
    const user = result.rows[0];

    // ── Check password ────────────────────────────────────────
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return error(res, 'Invalid email or password', 401);
    }

    if (user.is_suspended) return error(res, 'This account is suspended. Contact KampusLearn support.', 403);

    // ── Update last login ─────────────────────────────────────
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]
    );

    // ── Fetch subscription ────────────────────────────────────
    const subResult = await query(`
      SELECT plan, status, expires_at
      FROM subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `, [user.id]);
    const subscription = subResult.rows[0] || { plan: 'free', status: 'active' };

    // ── Clean up response (no password hash) ─────────────────
    const { password_hash, ...safeUser } = user;
    const token   = signToken(user.id);
    const profile = await getFullProfile(user.id, user.role);

    return success(res, {
      token,
      user: safeUser,
      profile,
      subscription
    }, 'Login successful');

  } catch (err) {
    console.error('Login error:', err.message);
    return error(res, 'Login failed. Please try again.', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/auth/me  (requires token)
// ════════════════════════════════════════════════════════════
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, full_name, email, phone, role,
             is_verified, avatar_url, last_login_at, created_at
      FROM users WHERE id = $1
    `, [req.user.id]);

    const subResult = await query(`
      SELECT plan, status, expires_at
      FROM subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `, [req.user.id]);

    const profile      = await getFullProfile(req.user.id, req.user.role);
    const subscription = subResult.rows[0] || { plan: 'free', status: 'active' };

    return success(res, {
      user: result.rows[0],
      profile,
      subscription
    });

  } catch (err) {
    console.error('Me error:', err.message);
    return error(res, 'Failed to fetch profile', 500);
  }
});

// ════════════════════════════════════════════════════════════
// PUT /api/auth/profile  (requires token)
// ════════════════════════════════════════════════════════════
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    if (!full_name) return error(res, 'Full name is required', 400);

    const result = await query(`
      UPDATE users
      SET full_name = $1, phone = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, full_name, email, phone, role, is_verified, avatar_url
    `, [full_name.trim(), phone || null, req.user.id]);

    return success(res, { user: result.rows[0] }, 'Profile updated');
  } catch (err) {
    return error(res, 'Profile update failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// PUT /api/auth/change-password  (requires token)
// ════════════════════════════════════════════════════════════
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return error(res, 'Current and new password are required', 400);
    }
    if (new_password.length < 8) {
      return error(res, 'New password must be at least 8 characters', 400);
    }

    // ── Verify current password ───────────────────────────────
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1', [req.user.id]
    );
    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!valid) {
      return error(res, 'Current password is incorrect', 401);
    }

    // ── Update to new password ────────────────────────────────
    const newHash = await bcrypt.hash(new_password, 12);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );

    return success(res, {}, 'Password changed successfully');
  } catch (err) {
    return error(res, 'Password change failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/auth/logout  (client just discards token,
//                         but we log it server-side)
// ════════════════════════════════════════════════════════════
router.post('/logout', authenticate, async (req, res) => {
  // JWT is stateless — client deletes the token
  // We just update last_login as a logout marker
  await query(
    'UPDATE users SET updated_at = NOW() WHERE id = $1', [req.user.id]
  ).catch(() => {});
  return success(res, {}, 'Logged out successfully');
});

module.exports = router;
