const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

const superOnly = (req, res, next) => {
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    return error(res, 'Admin access required', 403);
  }
  next();
};

// ── INSTITUTIONS ─────────────────────────────────────────────

// GET /api/manage/institutions
router.get('/institutions', authenticate, superOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT i.*,
        (SELECT COUNT(*) FROM faculties WHERE institution_id = i.id) AS faculty_count,
        (SELECT COUNT(*) FROM departments d
         JOIN faculties f ON f.id = d.faculty_id
         WHERE f.institution_id = i.id) AS dept_count
      FROM institutions i ORDER BY i.name
    `);
    return success(res, result.rows);
  } catch (err) { return error(res, 'Failed', 500); }
});

// POST /api/manage/institutions
router.post('/institutions', authenticate, superOnly, async (req, res) => {
  try {
const { name, short_name, type, state, city, website_url } = req.body;
    if (!name || !short_name || !type) {
      return error(res, 'name, short_name and type are required', 400);
    }
    const result = await query(`
      INSERT INTO institutions (name, short_name, type, state, city, website_url, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING *
    `, [name, short_name, type, state || 'Borno', city || 'Maiduguri', website_url || null]);
    return success(res, result.rows[0], 'Institution created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Institution name or short name already exists', 409);
    return error(res, 'Failed to create institution', 500);
  }
});

// DELETE /api/manage/institutions/:id
router.delete('/institutions/:id', authenticate, superOnly, async (req, res) => {
  try {
    // Delete student profiles first to avoid FK constraint
    await query('DELETE FROM student_profiles WHERE institution_id = $1', [req.params.id]);
    await query('DELETE FROM institutions WHERE id = $1', [req.params.id]);
    return success(res, {}, 'Institution deleted');
  } catch (err) {
    console.error('Institution delete error:', err.message);
    return error(res, 'Delete failed: ' + err.message, 500);
  }
});

// ── FACULTIES ────────────────────────────────────────────────

// GET /api/manage/institutions/:id/faculties
router.get('/institutions/:id/faculties', authenticate, superOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT f.*,
        (SELECT COUNT(*) FROM departments WHERE faculty_id = f.id) AS dept_count
      FROM faculties f WHERE f.institution_id = $1 ORDER BY f.name
    `, [req.params.id]);
    return success(res, result.rows);
  } catch (err) { return error(res, 'Failed', 500); }
});

// POST /api/manage/institutions/:id/faculties
router.post('/institutions/:id/faculties', authenticate, superOnly, async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return error(res, 'name and code required', 400);
    const result = await query(`
      INSERT INTO faculties (institution_id, name, code)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, name, code.toUpperCase()]);
    return success(res, result.rows[0], 'Faculty created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Faculty code already exists', 409);
    return error(res, 'Failed to create faculty', 500);
  }
});

// DELETE /api/manage/faculties/:id
router.delete('/faculties/:id', authenticate, superOnly, async (req, res) => {
  try {
    await query('DELETE FROM faculties WHERE id = $1', [req.params.id]);
    return success(res, {}, 'Faculty deleted');
  } catch (err) { return error(res, 'Delete failed', 500); }
});

// ── SCHOOLS (polytechnic) ────────────────────────────────────

router.get('/institutions/:id/schools', authenticate, superOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM departments WHERE school_id = s.id) AS dept_count
      FROM schools s WHERE s.institution_id = $1 ORDER BY s.name
    `, [req.params.id]);
    return success(res, result.rows);
  } catch (err) { return error(res, 'Failed', 500); }
});

router.post('/institutions/:id/schools', authenticate, superOnly, async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return error(res, 'name and code required', 400);
    const result = await query(`
      INSERT INTO schools (institution_id, name, code)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, name, code.toUpperCase()]);
    return success(res, result.rows[0], 'School created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'School code already exists', 409);
    return error(res, 'Failed to create school', 500);
  }
});

router.delete('/schools/:id', authenticate, superOnly, async (req, res) => {
  try {
    await query('DELETE FROM schools WHERE id = $1', [req.params.id]);
    return success(res, {}, 'School deleted');
  } catch (err) { return error(res, 'Delete failed', 500); }
});

// ── DEPARTMENTS ──────────────────────────────────────────────

router.get('/faculties/:id/departments', authenticate, superOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM courses WHERE department_id = d.id) AS course_count
      FROM departments d WHERE d.faculty_id = $1 ORDER BY d.name
    `, [req.params.id]);
    return success(res, result.rows);
  } catch (err) { return error(res, 'Failed', 500); }
});

router.get('/schools/:id/departments', authenticate, superOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM courses WHERE department_id = d.id) AS course_count
      FROM departments d WHERE d.school_id = $1 ORDER BY d.name
    `, [req.params.id]);
    return success(res, result.rows);
  } catch (err) { return error(res, 'Failed', 500); }
});

router.post('/faculties/:id/departments', authenticate, superOnly, async (req, res) => {
  try {
    console.log('DEPT POST body:', JSON.stringify(req.body), 'faculty_id:', req.params.id);
    const { name, code } = req.body;
    if (!name || !code) return error(res, 'name and code required', 400);
    const fac = await query('SELECT institution_id FROM faculties WHERE id = $1', [req.params.id]);
    if (!fac.rows.length) return error(res, 'Faculty not found', 404);
    const result = await query(`
      INSERT INTO departments (faculty_id, name, code)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, name, code.toUpperCase()]);
    return success(res, result.rows[0], 'Department created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Department code already exists', 409);
    return error(res, 'Failed to create department', 500);
  }
});

router.post('/schools/:id/departments', authenticate, superOnly, async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return error(res, 'name and code required', 400);
    const school = await query('SELECT institution_id FROM schools WHERE id = $1', [req.params.id]);
    if (!school.rows.length) return error(res, 'School not found', 404);
    const result = await query(`
      INSERT INTO departments (school_id, name, code)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, name, code.toUpperCase()]);
    return success(res, result.rows[0], 'Department created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Department code already exists', 409);
    return error(res, 'Failed to create department', 500);
  }
});

router.delete('/departments/:id', authenticate, superOnly, async (req, res) => {
  try {
    await query('DELETE FROM departments WHERE id = $1', [req.params.id]);
    return success(res, {}, 'Department deleted');
  } catch (err) { return error(res, 'Delete failed', 500); }
});

// ── COURSES ──────────────────────────────────────────────────

router.get('/departments/:id/courses', authenticate, superOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM courses WHERE department_id = $1
      ORDER BY level, semester, code
    `, [req.params.id]);
    return success(res, result.rows);
  } catch (err) { return error(res, 'Failed', 500); }
});

router.post('/departments/:id/courses', authenticate, superOnly, async (req, res) => {
  try {
const { title, code, level, semester, credit_units } = req.body;
    if (!title || !code || !level || !semester) {
      return error(res, 'title, code, level and semester are required', 400);
    }
    const dept = await query(
      'SELECT id FROM departments WHERE id = $1', [req.params.id]
    );
    if (!dept.rows.length) return error(res, 'Department not found', 404);
    const result = await query(`
      INSERT INTO courses
        (department_id, title, code, level, semester, credit_units, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      req.params.id,
      title, code.toUpperCase(),
      level, semester,
      parseInt(credit_units) || 3,
      true
    ]);
    return success(res, result.rows[0], 'Course created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Course code already exists in this department', 409);
    console.error(err.message);
    return error(res, 'Failed to create course', 500);
  }
});

router.delete('/courses/:id', authenticate, superOnly, async (req, res) => {
  try {
    await query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    return success(res, {}, 'Course deleted');
  } catch (err) { return error(res, 'Delete failed', 500); }
});

module.exports = router;
