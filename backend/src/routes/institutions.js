const router = require('express').Router();
const { query }          = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error } = require('../utils/response');

// ════════════════════════════════════════════════════════════
// GET /api/institutions
// List all active institutions
// ════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id, name, short_name, type, state, city,
        logo_url, website_url, is_verified
      FROM institutions
      WHERE is_active = TRUE
      ORDER BY name
    `);
    return success(res, result.rows);
  } catch (err) {
    console.error('institutions list error:', err.message);
    return error(res, 'Failed to fetch institutions', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/institutions/:id
// Single institution detail
// ════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id, name, short_name, type, state, city,
        logo_url, website_url, is_verified
      FROM institutions
      WHERE id = $1 AND is_active = TRUE
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return error(res, 'Institution not found', 404);
    }
    return success(res, result.rows[0]);
  } catch (err) {
    return error(res, 'Failed to fetch institution', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/institutions/:id/faculties
// Faculties for a university
// ════════════════════════════════════════════════════════════
router.get('/:id/faculties', async (req, res) => {
  try {
    // Verify it's a university
    const inst = await query(
      `SELECT type FROM institutions WHERE id = $1`, [req.params.id]
    );
    if (inst.rows.length === 0) {
      return error(res, 'Institution not found', 404);
    }
    if (inst.rows[0].type !== 'university') {
      return error(res, 'This institution is not a university. Use /schools instead.', 400);
    }

    const result = await query(`
      SELECT id, name, code
      FROM faculties
      WHERE institution_id = $1
      ORDER BY name
    `, [req.params.id]);

    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch faculties', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/institutions/:id/schools
// Schools for a polytechnic
// ════════════════════════════════════════════════════════════
router.get('/:id/schools', async (req, res) => {
  try {
    // Verify it's a polytechnic
    const inst = await query(
      `SELECT type FROM institutions WHERE id = $1`, [req.params.id]
    );
    if (inst.rows.length === 0) {
      return error(res, 'Institution not found', 404);
    }
    if (inst.rows[0].type !== 'polytechnic') {
      return error(res, 'This institution is not a polytechnic. Use /faculties instead.', 400);
    }

    const result = await query(`
      SELECT id, name, code
      FROM schools
      WHERE institution_id = $1
      ORDER BY name
    `, [req.params.id]);

    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch schools', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/institutions/faculties/:facultyId/departments
// Departments under a faculty
// ════════════════════════════════════════════════════════════
router.get('/faculties/:facultyId/departments', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, code
      FROM departments
      WHERE faculty_id = $1
      ORDER BY name
    `, [req.params.facultyId]);

    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch departments', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/institutions/schools/:schoolId/departments
// Departments under a school
// ════════════════════════════════════════════════════════════
router.get('/schools/:schoolId/departments', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, code
      FROM departments
      WHERE school_id = $1
      ORDER BY name
    `, [req.params.schoolId]);

    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch departments', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/institutions/departments/:deptId/courses
// Courses for a department — with optional level & semester filter
// ?level=200  or  ?level=ND1  or  ?semester=first
// ════════════════════════════════════════════════════════════
router.get('/departments/:deptId/courses', async (req, res) => {
  try {
    const { level, semester } = req.query;

    let sql = `
      SELECT
        id, title, code, credit_units,
        level, level_type, semester, description
      FROM courses
      WHERE department_id = $1
        AND is_active = TRUE
    `;
    const params = [req.params.deptId];

    if (level) {
      params.push(level);
      sql += ` AND level = $${params.length}`;
    }
    if (semester) {
      params.push(semester);
      sql += ` AND semester = $${params.length}`;
    }

    // Order by level numerically for uni, by position for poly
    sql += `
      ORDER BY
        CASE level_type
          WHEN 'university'  THEN
            CASE level
              WHEN '100' THEN 1 WHEN '200' THEN 2 WHEN '300' THEN 3
              WHEN '400' THEN 4 WHEN '500' THEN 5 WHEN '600' THEN 6
              ELSE 9
            END
          WHEN 'polytechnic' THEN
            CASE level
              WHEN 'ND1' THEN 1 WHEN 'ND2' THEN 2
              WHEN 'HND1' THEN 3 WHEN 'HND2' THEN 4
              ELSE 9
            END
          ELSE 9
        END,
        semester, code
    `;

    const result = await query(sql, params);
    return success(res, result.rows);
  } catch (err) {
    console.error('courses fetch error:', err.message);
    return error(res, 'Failed to fetch courses', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/institutions/courses/:courseId
// Single course detail
// ════════════════════════════════════════════════════════════
router.get('/courses/:courseId', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        c.id, c.title, c.code, c.credit_units,
        c.level, c.level_type, c.semester, c.description,
        d.name  AS department_name,
        d.code  AS department_code,
        COALESCE(f.name, s.name) AS parent_name,
        COALESCE(f.code, s.code) AS parent_code,
        i.name       AS institution_name,
        i.short_name AS institution_short,
        i.type       AS institution_type,
        (SELECT COUNT(*) FROM course_materials
         WHERE course_id = c.id AND is_approved = TRUE) AS material_count,
        (SELECT COUNT(*) FROM past_questions
         WHERE course_id = c.id AND is_approved = TRUE) AS past_question_count,
        (SELECT COUNT(*) FROM topics
         WHERE course_id = c.id)                        AS topic_count
      FROM courses c
      JOIN departments d ON d.id = c.department_id
      LEFT JOIN faculties f ON f.id = d.faculty_id
      LEFT JOIN schools   s ON s.id = d.school_id
      LEFT JOIN institutions i ON
        i.id = COALESCE(f.institution_id, s.institution_id)
      WHERE c.id = $1 AND c.is_active = TRUE
    `, [req.params.courseId]);

    if (result.rows.length === 0) {
      return error(res, 'Course not found', 404);
    }
    return success(res, result.rows[0]);
  } catch (err) {
    return error(res, 'Failed to fetch course', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/institutions/departments/:deptId/levels
// Returns the distinct levels available in a department
// Useful for building level-filter dropdowns on the frontend
// ════════════════════════════════════════════════════════════
router.get('/departments/:deptId/levels', async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT level, level_type,
        CASE level_type
          WHEN 'university' THEN
            CASE level
              WHEN '100' THEN 1 WHEN '200' THEN 2 WHEN '300' THEN 3
              WHEN '400' THEN 4 WHEN '500' THEN 5 WHEN '600' THEN 6
              ELSE 9
            END
          WHEN 'polytechnic' THEN
            CASE level
              WHEN 'ND1' THEN 1 WHEN 'ND2' THEN 2
              WHEN 'HND1' THEN 3 WHEN 'HND2' THEN 4
              ELSE 9
            END
          ELSE 9
        END AS sort_order
      FROM courses
      WHERE department_id = $1 AND is_active = TRUE
      ORDER BY sort_order
    `, [req.params.deptId]);

    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch levels', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/institutions  (admin only)
// ════════════════════════════════════════════════════════════
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, short_name, type, state, city, website_url } = req.body;
    if (!name || !short_name || !type || !state || !city) {
      return error(res, 'name, short_name, type, state, city are required', 400);
    }
    if (!['university', 'polytechnic'].includes(type)) {
      return error(res, 'type must be university or polytechnic', 400);
    }
    const result = await query(`
      INSERT INTO institutions (name, short_name, type, state, city, website_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, short_name, type, state, city
    `, [name, short_name.toUpperCase(), type, state, city, website_url || null]);

    return success(res, result.rows[0], 'Institution created', 201);
  } catch (err) {
    return error(res, 'Failed to create institution', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/institutions/:id/faculties  (admin only)
// ════════════════════════════════════════════════════════════
router.post('/:id/faculties', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return error(res, 'name and code are required', 400);

    const result = await query(`
      INSERT INTO faculties (institution_id, name, code)
      VALUES ($1, $2, $3)
      RETURNING id, name, code
    `, [req.params.id, name, code.toUpperCase()]);

    return success(res, result.rows[0], 'Faculty created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Faculty code already exists', 409);
    return error(res, 'Failed to create faculty', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/institutions/:id/schools  (admin only)
// ════════════════════════════════════════════════════════════
router.post('/:id/schools', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return error(res, 'name and code are required', 400);

    const result = await query(`
      INSERT INTO schools (institution_id, name, code)
      VALUES ($1, $2, $3)
      RETURNING id, name, code
    `, [req.params.id, name, code.toUpperCase()]);

    return success(res, result.rows[0], 'School created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'School code already exists', 409);
    return error(res, 'Failed to create school', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/institutions/faculties/:facultyId/departments (admin)
// ════════════════════════════════════════════════════════════
router.post('/faculties/:facultyId/departments', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return error(res, 'name and code are required', 400);

    const result = await query(`
      INSERT INTO departments (faculty_id, name, code)
      VALUES ($1, $2, $3)
      RETURNING id, name, code
    `, [req.params.facultyId, name, code.toUpperCase()]);

    return success(res, result.rows[0], 'Department created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Department code already exists in this faculty', 409);
    return error(res, 'Failed to create department', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/institutions/schools/:schoolId/departments (admin)
// ════════════════════════════════════════════════════════════
router.post('/schools/:schoolId/departments', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return error(res, 'name and code are required', 400);

    const result = await query(`
      INSERT INTO departments (school_id, name, code)
      VALUES ($1, $2, $3)
      RETURNING id, name, code
    `, [req.params.schoolId, name, code.toUpperCase()]);

    return success(res, result.rows[0], 'Department created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Department code already exists in this school', 409);
    return error(res, 'Failed to create department', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/institutions/departments/:deptId/courses (admin/lecturer)
// ════════════════════════════════════════════════════════════
router.post('/departments/:deptId/courses', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  try {
    const { title, code, credit_units, level, level_type, semester, description } = req.body;

    if (!title || !code || !level || !level_type) {
      return error(res, 'title, code, level, and level_type are required', 400);
    }

    // Validate level against level_type
    const uniLevels  = ['100','200','300','400','500','600'];
    const polyLevels = ['ND1','ND2','HND1','HND2'];

    if (level_type === 'university' && !uniLevels.includes(level)) {
      return error(res, `University level must be one of: ${uniLevels.join(', ')}`, 400);
    }
    if (level_type === 'polytechnic' && !polyLevels.includes(level)) {
      return error(res, `Polytechnic level must be one of: ${polyLevels.join(', ')}`, 400);
    }

    const result = await query(`
      INSERT INTO courses
        (department_id, title, code, credit_units, level, level_type, semester, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, title, code, credit_units, level, level_type, semester
    `, [
      req.params.deptId,
      title, code.toUpperCase(),
      credit_units || 2,
      level, level_type,
      semester || 'first',
      description || null
    ]);

    return success(res, result.rows[0], 'Course created', 201);
  } catch (err) {
    if (err.code === '23505') return error(res, 'Course code already exists in this department', 409);
    return error(res, 'Failed to create course', 500);
  }
});

module.exports = router;
