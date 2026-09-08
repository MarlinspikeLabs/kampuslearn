const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { error } = require('../utils/response');

// ── Require valid JWT ────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return error(res, 'Access token required', 401);
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      'SELECT id, full_name, email, role, is_verified, is_suspended FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return error(res, 'User no longer exists', 401);
    }

    if (result.rows[0].is_suspended) return error(res, 'This account is suspended. Contact KampusLearn support.', 403);
    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Session expired. Please log in again.', 401);
    }
    return error(res, 'Invalid token', 401);
  }
};

// ── Require specific role(s) ─────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  // super_admin has all permissions automatically
  if (req.user.role === 'super_admin') return next();
  if (!roles.includes(req.user.role)) {
    return error(res, 'You do not have permission to perform this action', 403);
  }
  next();
};

// Only super_admin can access
const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return error(res, 'Super admin access required', 403);
  }
  next();
};

// ── Attach user if token present, but don't block ───────────
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query(
        'SELECT id, full_name, email, role FROM users WHERE id = $1 AND is_suspended = FALSE',
        [decoded.userId]
      );
      if (result.rows.length > 0) if (result.rows[0].is_suspended) return error(res, 'This account is suspended. Contact KampusLearn support.', 403);
    req.user = result.rows[0];
    }
  } catch (_) {
    // silently ignore — optional
  }
  next();
};

module.exports = { authenticate, authorize, optionalAuth };
