const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 }         = require('uuid');
const { query }               = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { success, error }      = require('../utils/response');

// ── Multer config (same allowed types as materials) ──────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `pq-${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only PDF, Word, and image files allowed'));
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/past-questions
// List approved past questions
// ?course_id=  &year=  &exam_type=  &page=  &limit=
// ════════════════════════════════════════════════════════════
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { course_id, year, exam_type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let conditions = ['pq.is_approved = TRUE'];

    if (course_id) {
      params.push(course_id);
      conditions.push(`pq.course_id = $${params.length}`);
    }
    if (year) {
      params.push(parseInt(year));
      conditions.push(`pq.year = $${params.length}`);
    }
    if (exam_type) {
      params.push(exam_type);
      conditions.push(`pq.exam_type = $${params.length}`);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) FROM past_questions pq ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(`
      SELECT
        pq.id, pq.year, pq.exam_type, pq.file_url,
        pq.has_answers, pq.download_count, pq.created_at,
        c.id         AS course_id,
        c.title      AS course_title,
        c.code       AS course_code,
        c.level      AS course_level,
        c.level_type AS course_level_type,
        u.full_name  AS uploader_name,
        (SELECT COUNT(*) FROM questions q
         WHERE q.past_question_id = pq.id
           AND q.is_approved = TRUE) AS question_count
      FROM past_questions pq
      JOIN courses c ON c.id = pq.course_id
      JOIN users   u ON u.id = pq.uploaded_by
      ${whereClause}
      ORDER BY pq.year DESC, pq.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    return success(res, {
      past_questions: result.rows,
      pagination: {
        total,
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('past questions list error:', err.message);
    return error(res, 'Failed to fetch past questions', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/past-questions/:id
// Single past question paper detail
// ════════════════════════════════════════════════════════════
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        pq.*,
        c.title      AS course_title,
        c.code       AS course_code,
        c.level      AS course_level,
        c.level_type AS course_level_type,
        d.name       AS department_name,
        u.full_name  AS uploader_name,
        (SELECT COUNT(*) FROM questions q
         WHERE q.past_question_id = pq.id
           AND q.is_approved = TRUE) AS question_count
      FROM past_questions pq
      JOIN courses     c ON c.id = pq.course_id
      JOIN departments d ON d.id = c.department_id
      JOIN users       u ON u.id = pq.uploaded_by
      WHERE pq.id = $1 AND pq.is_approved = TRUE
    `, [req.params.id]);

    if (result.rows.length === 0) return error(res, 'Past question not found', 404);
    return success(res, result.rows[0]);
  } catch (err) {
    return error(res, 'Failed to fetch past question', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/past-questions/upload
// Upload a past question paper (PDF/image)
// ════════════════════════════════════════════════════════════
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { course_id, year, exam_type = 'semester', has_answers = false } = req.body;

    if (!course_id || !year) {
      if (req.file) fs.unlinkSync(req.file.path);
      return error(res, 'course_id and year are required', 400);
    }
    if (isNaN(parseInt(year)) || parseInt(year) < 1990 || parseInt(year) > new Date().getFullYear()) {
      if (req.file) fs.unlinkSync(req.file.path);
      return error(res, `year must be a valid year between 1990 and ${new Date().getFullYear()}`, 400);
    }

    const courseCheck = await query(
      'SELECT id, title FROM courses WHERE id = $1 AND is_active = TRUE', [course_id]
    );
    if (courseCheck.rows.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return error(res, 'Course not found', 404);
    }

    // Check for duplicate (same course + year + exam_type)
    const dupCheck = await query(
      'SELECT id FROM past_questions WHERE course_id = $1 AND year = $2 AND exam_type = $3',
      [course_id, parseInt(year), exam_type]
    );
    if (dupCheck.rows.length > 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return error(res, `A ${exam_type} past question for ${year} already exists for this course`, 409);
    }

    const fileUrl        = req.file ? `/uploads/${req.file.filename}` : null;
    const isAutoApproved = ['admin', 'super_admin', 'lecturer'].includes(req.user.role);

    const result = await query(`
      INSERT INTO past_questions
        (course_id, uploaded_by, year, exam_type, file_url, has_answers, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, year, exam_type, file_url, has_answers, is_approved, created_at
    `, [
      course_id, req.user.id, parseInt(year),
      exam_type, fileUrl,
      has_answers === 'true' || has_answers === true,
      isAutoApproved
    ]);

    const message = isAutoApproved
      ? 'Past question uploaded and published'
      : 'Past question uploaded and pending review';

    return success(res, result.rows[0], message, 201);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('PQ upload error:', err.message);
    return error(res, 'Upload failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/past-questions/:id/download
// Track download and return file URL
// ════════════════════════════════════════════════════════════
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, file_url, is_approved FROM past_questions WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return error(res, 'Not found', 404);
    if (!result.rows[0].is_approved) return error(res, 'Not yet approved', 403);
    if (!result.rows[0].file_url) return error(res, 'No file attached to this record', 404);

    await query(
      'UPDATE past_questions SET download_count = download_count + 1 WHERE id = $1',
      [req.params.id]
    );
    return success(res, { file_url: result.rows[0].file_url }, 'Download ready');
  } catch (err) {
    return error(res, 'Download failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/past-questions/:id/questions
// Get digitized questions from a past question paper
// ════════════════════════════════════════════════════════════
router.get('/:id/questions', optionalAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        q.id, q.question_text, q.question_type,
        q.options, q.difficulty, q.marks, q.year,
        t.name AS topic_name
      FROM questions q
      LEFT JOIN topics t ON t.id = q.topic_id
      WHERE q.past_question_id = $1
        AND q.is_approved = TRUE
      ORDER BY q.created_at ASC
    `, [req.params.id]);

    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch questions', 500);
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/past-questions/:id/questions
// Digitize a question from a past question paper
// (admin and lecturers only)
// ════════════════════════════════════════════════════════════
router.post('/:id/questions', authenticate, authorize('admin', 'lecturer'), async (req, res) => {
  try {
    const {
      question_text, question_type = 'mcq',
      options, correct_answer, explanation,
      difficulty = 'medium', marks = 1,
      topic_id, year
    } = req.body;

    if (!question_text || !correct_answer) {
      return error(res, 'question_text and correct_answer are required', 400);
    }

    // Verify the past question paper exists and get its course_id
    const pq = await query(
      'SELECT id, course_id, year FROM past_questions WHERE id = $1',
      [req.params.id]
    );
    if (pq.rows.length === 0) return error(res, 'Past question paper not found', 404);

    // Validate MCQ options format
    if (question_type === 'mcq') {
      if (!options || !Array.isArray(options) || options.length < 2) {
        return error(res, 'MCQ questions require at least 2 options', 400);
      }
    }

    const result = await query(`
      INSERT INTO questions
        (past_question_id, course_id, created_by, question_text, question_type,
         options, correct_answer, explanation, difficulty, marks, topic_id, year, is_approved)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, TRUE)
      RETURNING id, question_text, question_type, difficulty, marks, created_at
    `, [
      req.params.id,
      pq.rows[0].course_id,
      req.user.id,
      question_text.trim(),
      question_type,
      options ? JSON.stringify(options) : null,
      correct_answer.trim(),
      explanation || null,
      difficulty,
      parseInt(marks),
      topic_id || null,
      year || pq.rows[0].year
    ]);

    return success(res, result.rows[0], 'Question digitized successfully', 201);
  } catch (err) {
    console.error('digitize error:', err.message);
    return error(res, 'Failed to add question', 500);
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/past-questions/course/:courseId/years
// Get available years for a course (for filter dropdown)
// ════════════════════════════════════════════════════════════
router.get('/course/:courseId/years', optionalAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT year, exam_type,
        (SELECT COUNT(*) FROM questions q
         WHERE q.past_question_id = pq2.id
           AND q.is_approved = TRUE) AS question_count
      FROM past_questions pq2
      WHERE course_id = $1 AND is_approved = TRUE
      ORDER BY year DESC
    `, [req.params.courseId]);

    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch years', 500);
  }
});

// ════════════════════════════════════════════════════════════
// PATCH /api/past-questions/:id/approve  (admin only)
// ════════════════════════════════════════════════════════════
router.patch('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      UPDATE past_questions SET is_approved = TRUE
      WHERE id = $1
      RETURNING id, year, exam_type, is_approved
    `, [req.params.id]);
    if (result.rows.length === 0) return error(res, 'Not found', 404);
    return success(res, result.rows[0], 'Past question approved');
  } catch (err) {
    return error(res, 'Approval failed', 500);
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /api/past-questions/:id  (admin or uploader)
// ════════════════════════════════════════════════════════════
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, file_url, uploaded_by FROM past_questions WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return error(res, 'Not found', 404);

    const pq = result.rows[0];
    if (!['admin', 'super_admin'].includes(req.user.role) && pq.uploaded_by !== req.user.id) {
      return error(res, 'You can only delete your own uploads', 403);
    }

    await query('DELETE FROM past_questions WHERE id = $1', [req.params.id]);
    if (pq.file_url) {
      const filePath = path.resolve('.' + pq.file_url);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) { console.warn('Removed content record; file cleanup pending'); }
    }


    return success(res, {}, 'Past question deleted');
  } catch (err) {
    return error(res, 'Delete failed', 500);
  }
});

module.exports = router;
