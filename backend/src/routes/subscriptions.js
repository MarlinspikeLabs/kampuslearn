const router = require('express').Router();
const { query }        = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error } = require('../utils/response');

// GET /api/subscriptions/me — current user's subscription
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, plan, status, starts_at, expires_at, amount_paid, created_at
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [req.user.id]);

    const sub = result.rows[0] || { plan: 'free', status: 'active' };
    const now = new Date();
    const isActive = sub.status === 'active' &&
      (!sub.expires_at || new Date(sub.expires_at) > now);

    return success(res, { ...sub, is_active: isActive });
  } catch (err) { return error(res, 'Failed to fetch subscription', 500); }
});

// GET /api/subscriptions/plans — list available plans
router.get('/plans', async (req, res) => {
  return success(res, {
    plans: [
      {
        id:       'free',
        name:     'Free',
        price:    0,
        currency: 'NGN',
        features: [
          '20 AI messages per day',
          'Browse course materials',
          'Access past questions',
          '5 CBT practice tests per day',
          'Basic study tools'
        ],
        limits: { ai_messages_daily: 20, cbt_daily: 5 }
      },
      {
        id:       'premium',
        name:     'Premium',
        price:    3000,
        currency: 'NGN',
        period:   'monthly',
        features: [
          '200 AI messages per day',
          'Unlimited CBT practice',
          'Download all materials',
          'Exam readiness score',
          'Weak topic detection',
          'Personalised study plans',
          'Priority support'
        ],
        limits: { ai_messages_daily: 200, cbt_daily: -1 }
      }
    ]
  });
});

// POST /api/subscriptions/upgrade — upgrade plan
// In production this would verify a Paystack payment reference
router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const { plan, paystack_ref, amount_paid } = req.body;
    const validPlans = ['premium', 'institution'];
    if (!plan || !validPlans.includes(plan)) {
      return error(res, `plan must be one of: ${validPlans.join(', ')}`, 400);
    }

    // Expire existing active subscription
    await query(`
      UPDATE subscriptions SET status = 'expired'
      WHERE user_id = $1 AND status = 'active'
    `, [req.user.id]);

    // Create new subscription (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const result = await query(`
      INSERT INTO subscriptions
        (user_id, plan, status, expires_at, paystack_ref, amount_paid)
      VALUES ($1, $2, 'active', $3, $4, $5)
      RETURNING id, plan, status, expires_at
    `, [req.user.id, plan, expiresAt, paystack_ref || null, amount_paid || null]);

    return success(res, result.rows[0], `Upgraded to ${plan} successfully`, 201);
  } catch (err) { return error(res, 'Upgrade failed', 500); }
});

// GET /api/subscriptions/all (admin only)
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        s.id, s.plan, s.status, s.starts_at, s.expires_at, s.amount_paid,
        u.full_name, u.email
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
      LIMIT 100
    `);
    return success(res, result.rows);
  } catch (err) { return error(res, 'Failed to fetch subscriptions', 500); }
});

module.exports = router;
