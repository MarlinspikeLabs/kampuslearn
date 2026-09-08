const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { query }          = require('../config/database');
const { authenticate }   = require('../middleware/auth');
const { success, error } = require('../utils/response');

const superOnly = (req, res, next) => {
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    return error(res, 'Admin access required', 403);
  }
  next();
};

// File storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `material-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed. Use PDF, DOC, DOCX, PPT, PPTX, TXT'));
  }
});

// POST /api/admin-upload/material
router.post('/material', authenticate, superOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'No file uploaded', 400);

    const {
      title, course_id, material_type = 'lecture_note',
      description, tags
    } = req.body;

    if (typeof title !== 'string' || !title.trim() || title.length > 250 || !/^[0-9a-f-]{36}$/i.test(String(course_id)) || !['lecture_note','slide','textbook','summary','other'].includes(material_type)) {
      fs.unlinkSync(req.file.path);
      return error(res, 'Choose a course, a valid title and material category', 400);
    }

    // Verify course exists
    const course = await query('SELECT id FROM courses WHERE id = $1 AND is_active = TRUE', [course_id]);
    if (!course.rows.length) {
      fs.unlinkSync(req.file.path);
      return error(res, 'Course not found', 404);
    }

    const fileUrl  = `/uploads/${req.file.filename}`;
    const fileSizeKb = Math.round(req.file.size / 1024);

    const tagsArr = tags
      ? tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const result = await query(`
      INSERT INTO course_materials
        (course_id, uploaded_by, title, description, material_type,
         file_url, file_name, file_size_kb, tags,
         is_approved, is_featured)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, FALSE)
      RETURNING id, title, file_url, material_type, is_approved
    `, [
      course_id,
      req.user.id,
      title,
      description || null,
      material_type,
      fileUrl,
      req.file.originalname,
      fileSizeKb,
      tagsArr.length > 0 ? tagsArr : null
    ]);

    return success(res, result.rows[0], 'Material uploaded and published', 201);
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('Upload error:', err.message);
    return error(res, 'Upload failed. Check the file and course, then retry.', 500);
  }
});

// POST /api/admin-upload/past-question
router.post('/past-question', authenticate, superOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'No file uploaded', 400);

    const { course_id, year, exam_type = 'semester', has_answers = false } = req.body;

    if (!/^[0-9a-f-]{36}$/i.test(String(course_id)) || !Number.isInteger(Number(year)) || Number(year) < 1960 || Number(year) > new Date().getFullYear()+1 || !['semester','mock','carry_over','supplementary'].includes(exam_type)) {
      fs.unlinkSync(req.file.path);
      return error(res, 'Choose a course, valid exam year and exam type', 400);
    }

    const course = await query(
      'SELECT id, department_id FROM courses WHERE id = $1 AND is_active = TRUE', [course_id]
    );
    if (!course.rows.length) {
      fs.unlinkSync(req.file.path);
      return error(res, 'Course not found', 404);
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const result = await query(`
      INSERT INTO past_questions
        (course_id, department_id, uploaded_by, year, exam_type,
         file_url, has_answers, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING id, year, exam_type, file_url, is_approved
    `, [
      course_id,
      course.rows[0].department_id,
      req.user.id,
      parseInt(year),
      exam_type,
      fileUrl,
      has_answers === 'true' || has_answers === true
    ]);

    return success(res, result.rows[0], 'Past question uploaded and published', 201);
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('PQ upload error:', err.message);
    return error(res, 'Upload failed', 500);
  }
});

router.use((err, req, res, next) => {
  if (!err) return next();
  return error(res, err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 50 MB or smaller' : 'Upload rejected. Use PDF, Word, PowerPoint or text files.', 400);
});

module.exports = router;
