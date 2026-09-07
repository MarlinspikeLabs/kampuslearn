require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1); // Trust Nginx/Apache reverse proxy

// Trust Nginx reverse proxy headers for express-rate-limit
app.set('trust proxy', 1);

// Ensure uploads directory exists
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Security middleware ────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

// ── General middleware ─────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static file serving (uploaded PDFs, notes, etc.) ──────────
app.use('/uploads', express.static(uploadDir));

// ── Rate limiting ──────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests, slow down.' }
}));
app.use('/api/auth/login', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts.' }
}));

// ── Routes (we will add these one by one in next tasks) ───────
app.use('/api/student', require('./routes/student'));
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/institutions',   require('./routes/institutions'));
app.use('/api/materials',      require('./routes/materials'));
app.use('/api/past-questions', require('./routes/pastQuestions'));
app.use('/api/questions',      require('./routes/questions'));
app.use('/api/exams',          require('./routes/exams'));
app.use('/api/tokens',         require('./routes/tokens'));
app.use('/api/manage',        require('./routes/institution_manager'));
app.use('/api/admin-upload',  require('./routes/admin_upload'));
app.use('/api/admin',          require('./routes/admin'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/subscriptions',  require('./routes/subscriptions'));
app.use('/api/knowledge',     require('./routes/knowledge'));
app.use('/api/ai',             require('./routes/ai'));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const { pool } = require('./config/database');
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (_) {}

  res.json({
    success: true,
    service: 'KampusLearn API',
    version: '1.0.0',
    status: 'running',
    database: dbStatus,
    node: process.version,
    uptime: Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString()
  });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 20}MB`
    });
  }
  // Multer file filter errors (wrong file type)
  if (err.message && (
    err.message.includes('not allowed') ||
    err.message.includes('Only PDF') ||
    err.message.includes('File type')
  )) {
    return res.status(400).json({ success: false, message: err.message });
  }
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ── Start server ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 KampusLearn API`);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network:  http://192.168.40.4:${PORT}`);
  console.log(`   Health:   http://localhost:${PORT}/api/health`);
  console.log(`   Mode:     ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;

