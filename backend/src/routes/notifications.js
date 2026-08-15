const router = require('express').Router();
const { query }        = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error } = require('../utils/response');

// GET /api/notifications — list user notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [req.user.id];
    let extra = '';
    if (unread_only === 'true') { extra = 'AND n.is_read = FALSE'; }

    const result = await query(`
      SELECT id, title, body, type, is_read, data, created_at
      FROM notifications n
      WHERE user_id = $1 ${extra}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, parseInt(limit), offset]);

    const unread = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );

    return success(res, {
      notifications: result.rows,
      unread_count:  parseInt(unread.rows[0].count)
    });
  } catch (err) { return error(res, 'Failed to fetch notifications', 500); }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const result = await query(`
      UPDATE notifications SET is_read = TRUE
      WHERE id = $1 AND user_id = $2
      RETURNING id, is_read
    `, [req.params.id, req.user.id]);
    if (result.rows.length === 0) return error(res, 'Notification not found', 404);
    return success(res, result.rows[0], 'Marked as read');
  } catch (err) { return error(res, 'Update failed', 500); }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const result = await query(`
      UPDATE notifications SET is_read = TRUE
      WHERE user_id = $1 AND is_read = FALSE
      RETURNING COUNT(*)
    `, [req.user.id]);
    return success(res, {}, 'All notifications marked as read');
  } catch (err) { return error(res, 'Update failed', 500); }
});

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return error(res, 'Not found', 404);
    return success(res, {}, 'Notification deleted');
  } catch (err) { return error(res, 'Delete failed', 500); }
});

// POST /api/notifications — create notification (admin only, for broadcasts)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { user_id, title, body, type = 'info', data } = req.body;
    if (!user_id || !title || !body) return error(res, 'user_id, title, body required', 400);
    const result = await query(`
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, type, created_at
    `, [user_id, title, body, type, data ? JSON.stringify(data) : '{}']);
    return success(res, result.rows[0], 'Notification sent', 201);
  } catch (err) { return error(res, 'Failed to send notification', 500); }
});

module.exports = router;
