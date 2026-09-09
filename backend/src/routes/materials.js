const tokenService = require('../services/tokenService');
const router   = require('express').Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 }         = require('uuid');
const { query }               = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { success, error }      = require('../utils/response');

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const safeName = `material-${uuidv4()}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024 }
});

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { course_id, type, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let conditions = ['cm.is_approved = TRUE'];
    if (['institution','generic'].includes(req.query.scope)) { params.push(req.query.scope); conditions.push(`cm.content_scope = $${params.length}`); }

    if (course_id) {
      params.push(course_id);
      conditions.push(`(cm.course_id = $${params.length} OR cm.content_scope = 'generic')`);
    }
    if (type) {
      params.push(type);
      conditions.push(`cm.material_type = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(cm.title ILIKE $${params.length} OR cm.description ILIKE $${params.length} OR cm.generic_subject ILIKE $${params.length})`);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) FROM course_materials cm ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(`
      SELECT
        cm.id, cm.title, cm.description, cm.material_type, cm.content_scope, cm.generic_subject,
        cm.file_url, cm.file_name, cm.file_size_kb,
        cm.download_count, cm.view_count,
        cm.is_featured, cm.tags, cm.created_at,
        u.full_name  AS uploader_name,
        COALESCE(c.title, cm.generic_subject)      AS course_title,
        COALESCE(c.code, 'GENERIC')       AS course_code,
        c.level      AS course_level,
        c.level_type AS course_level_type
      FROM course_materials cm
      JOIN users   u ON u.id = cm.uploaded_by
      LEFT JOIN courses c ON c.id = cm.course_id
      ${whereClause}
      ORDER BY cm.is_featured DESC, cm.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    return success(res, {
      materials: result.rows,
      pagination: {
        total,
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('materials list error:', err.message);
    return error(res, 'Failed to fetch materials', 500);
  }
});

router.get('/admin/pending', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        cm.id, cm.title, cm.material_type, cm.file_name,
        cm.file_size_kb, cm.created_at,
        u.full_name AS uploader_name,
        u.email     AS uploader_email,
        COALESCE(c.title, cm.generic_subject)     AS course_title,
        COALESCE(c.code, 'GENERIC')      AS course_code
      FROM course_materials cm
      JOIN users   u ON u.id = cm.uploaded_by
      LEFT JOIN courses c ON c.id = cm.course_id
      WHERE cm.is_approved = FALSE
      ORDER BY cm.created_at ASC
    `);
    return success(res, result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch pending materials', 500);
  }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        cm.*,
        u.full_name  AS uploader_name,
        COALESCE(c.title, cm.generic_subject)      AS course_title,
        COALESCE(c.code, 'GENERIC')       AS course_code,
        c.level      AS course_level,
        c.level_type AS course_level_type,
        d.name       AS department_name
      FROM course_materials cm
      JOIN users       u ON u.id = cm.uploaded_by
      LEFT JOIN courses     c ON c.id = cm.course_id
      LEFT JOIN departments d ON d.id = c.department_id
      WHERE cm.id = $1 AND cm.is_approved = TRUE
    `, [req.params.id]);

    if (result.rows.length === 0) return error(res, 'Material not found', 404);

    await query(
      'UPDATE course_materials SET view_count = view_count + 1 WHERE id = $1',
      [req.params.id]
    );
    return success(res, result.rows[0]);
  } catch (err) {
    return error(res, 'Failed to fetch material', 500);
  }
});

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { course_id, title, description, material_type = 'lecture_note', tags } = req.body;

    if (!course_id || !title) {
      if (req.file) fs.unlinkSync(req.file.path);
      return error(res, 'course_id and title are required', 400);
    }
    if (!req.file) return error(res, 'No file uploaded', 400);

    const courseCheck = await query(
      'SELECT id FROM courses WHERE id = $1 AND is_active = TRUE', [course_id]
    );
    if (courseCheck.rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return error(res, 'Course not found', 404);
    }

    const fileUrl        = `/uploads/${req.file.filename}`;
    const fileSizeKb     = Math.round(req.file.size / 1024);
    const tagArray       = tags ? JSON.parse(tags) : [];
    const isAutoApproved = ['admin', 'super_admin', 'lecturer'].includes(req.user.role);

    const result = await query(`
      INSERT INTO course_materials
        (course_id, uploaded_by, title, description, material_type,
         file_url, file_name, file_size_kb, is_approved, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, title, material_type, file_url, file_size_kb, is_approved, created_at
    `, [
      course_id, req.user.id, title.trim(), description || null,
      material_type, fileUrl, req.file.originalname,
      fileSizeKb, isAutoApproved, tagArray
    ]);

    const message = isAutoApproved
      ? 'Material uploaded and published successfully'
      : 'Material uploaded and is pending admin review';

    return success(res, result.rows[0], message, 201);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('upload error:', err.message);
    return error(res, 'Upload failed. Please try again.', 500);
  }
});

router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, file_url, file_name, is_approved FROM course_materials WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return error(res, 'Material not found', 404);
    if (!result.rows[0].is_approved) return error(res, 'Material not yet approved', 403);

    const DOWNLOAD_COST = 5;
    const wallet = await tokenService.getBalance(req.user.id);

    if (wallet.balance < DOWNLOAD_COST) {
      return error(res,
        `You need ${DOWNLOAD_COST} KP to download. You have ${wallet.balance} KP. Earn more by logging in daily or referring friends.`,
        402
      );
    }

    const debit = await tokenService.debitTokens(
      req.user.id, DOWNLOAD_COST, 'download_spend',
      `Downloaded: ${result.rows[0].file_name}`
    );

    await query(
      'UPDATE course_materials SET download_count = download_count + 1 WHERE id = $1',
      [req.params.id]
    );

    return success(res, {
      file_url:      result.rows[0].file_url,
      file_name:     result.rows[0].file_name,
      kp_spent:      DOWNLOAD_COST,
      balance_after: debit.balance
    }, 'Download ready');
  } catch (err) {
    console.error('Download error:', err.message);
    return error(res, 'Download failed', 500);
  }
});

router.patch('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      UPDATE course_materials SET is_approved = TRUE, updated_at = NOW()
      WHERE id = $1 RETURNING id, title, is_approved
    `, [req.params.id]);
    if (result.rows.length === 0) return error(res, 'Material not found', 404);
    return success(res, result.rows[0], 'Material approved and published');
  } catch (err) {
    return error(res, 'Approval failed', 500);
  }
});

router.patch('/:id/feature', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      UPDATE course_materials SET is_featured = NOT is_featured, updated_at = NOW()
      WHERE id = $1 RETURNING id, title, is_featured
    `, [req.params.id]);
    if (result.rows.length === 0) return error(res, 'Material not found', 404);
    const status = result.rows[0].is_featured ? 'featured' : 'unfeatured';
    return success(res, result.rows[0], `Material ${status}`);
  } catch (err) {
    return error(res, 'Feature toggle failed', 500);
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, file_url, uploaded_by FROM course_materials WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return error(res, 'Material not found', 404);

    const material = result.rows[0];
    if (!['admin', 'super_admin'].includes(req.user.role) && material.uploaded_by !== req.user.id) {
      return error(res, 'You can only delete your own uploads', 403);
    }

    await query('DELETE FROM course_materials WHERE id = $1', [req.params.id]);
    const filePath = path.resolve('.' + material.file_url);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) { console.warn('Removed content record; file cleanup pending'); }


    return success(res, {}, 'Material deleted successfully');
  } catch (err) {
    return error(res, 'Delete failed', 500);
  }
});

module.exports = router;

// GET /api/materials/:id/read — free online reading (no KP cost)
// Returns file URL for in-browser viewing only
router.get('/:id/read', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, file_url, file_name, is_approved FROM course_materials WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return error(res, 'Not found', 404);
    if (!result.rows[0].is_approved) return error(res, 'Material not approved', 403);

    // Track view count only — no KP deducted
    await query(
      'UPDATE course_materials SET view_count = view_count + 1 WHERE id = $1',
      [req.params.id]
    );

    return success(res, {
      file_url:  result.rows[0].file_url,
      file_name: result.rows[0].file_name,
      free:      true
    }, 'Read online — free');
  } catch (err) {
    return error(res, 'Failed', 500);
  }
});
