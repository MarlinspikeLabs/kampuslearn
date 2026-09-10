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

// Generic items belong to the shared library and never to a placeholder institution.
function destination(body) {
  const scope = body.content_scope || 'institution';
  if (!['institution', 'generic'].includes(scope)) throw Object.assign(new Error('Choose Institution based or Generic'), {status:400});
  if (scope === 'generic') {
    const subject = typeof body.generic_subject === 'string' ? body.generic_subject.trim() : '';
    if (!subject || subject.length > 180) throw Object.assign(new Error('Enter a subject of 1–180 characters for shared content'), {status:400});
    if (body.course_id) throw Object.assign(new Error('Generic content cannot have an institution course assignment'), {status:400});
    return {scope, subject, courseId:null};
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(body.course_id))) throw Object.assign(new Error('Choose an institution course'), {status:400});
  return {scope, subject:null, courseId:body.course_id};
}

// POST /api/admin-upload/material
router.post('/material', authenticate, superOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'No file uploaded', 400);
    const target = destination(req.body);

    const {
      title, course_id, material_type = 'lecture_note',
      description, tags
    } = req.body;

    if (typeof title !== 'string' || !title.trim() || title.length > 250 || !['lecture_note','slide','textbook','summary','other'].includes(material_type)) {
      fs.unlinkSync(req.file.path);
      return error(res, 'Choose a course, a valid title and material category', 400);
    }

    // Verify course exists
    const course = target.courseId ? await query('SELECT id FROM courses WHERE id = $1 AND is_active = TRUE', [target.courseId]) : {rows:[{}]};
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
         is_approved, is_featured, content_scope, generic_subject)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, FALSE, $10, $11)
      RETURNING id, title, file_url, material_type, is_approved, content_scope, generic_subject
    `, [
      target.courseId,
      req.user.id,
      title,
      description || null,
      material_type,
      fileUrl,
      req.file.originalname,
      fileSizeKb,
      tagsArr.length > 0 ? tagsArr : null,
      target.scope, target.subject
    ]);

    return success(res, result.rows[0], 'Material uploaded and published', 201);
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('Upload error:', err.message);
    return error(res, err.status ? err.message : 'Upload failed. Check the file and destination, then retry.', err.status || 500);
  }
});

// POST /api/admin-upload/past-question
router.post('/past-question', authenticate, superOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return error(res, 'No file uploaded', 400);
    const target = destination(req.body);

    const { course_id, year, exam_type = 'semester', has_answers = false } = req.body;

    if (!Number.isInteger(Number(year)) || Number(year) < 1960 || Number(year) > new Date().getFullYear()+1 || !['semester','mock','carry_over','supplementary'].includes(exam_type)) {
      fs.unlinkSync(req.file.path);
      return error(res, 'Choose a course, valid exam year and exam type', 400);
    }

    const course = target.courseId ? await query(
      'SELECT id, department_id FROM courses WHERE id = $1 AND is_active = TRUE', [target.courseId]
    ) : {rows:[{department_id:null}]};
    if (!course.rows.length) {
      fs.unlinkSync(req.file.path);
      return error(res, 'Course not found', 404);
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const result = await query(`
      INSERT INTO past_questions
        (course_id, department_id, uploaded_by, year, exam_type,
         file_url, has_answers, is_approved, content_scope, generic_subject)
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9)
      RETURNING id, year, exam_type, file_url, is_approved, content_scope, generic_subject
    `, [
      target.courseId,
      course.rows[0].department_id,
      req.user.id,
      parseInt(year),
      exam_type,
      fileUrl,
      has_answers === 'true' || has_answers === true,
      target.scope, target.subject
    ]);

    return success(res, result.rows[0], 'Past question uploaded and published', 201);
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('PQ upload error:', err.message);
    return error(res, err.status ? err.message : 'Upload failed', err.status || 500);
  }
});

router.use((err, req, res, next) => {
  if (!err) return next();
  return error(res, err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 50 MB or smaller' : 'Upload rejected. Use PDF, Word, PowerPoint or text files.', err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
});

module.exports = router;

