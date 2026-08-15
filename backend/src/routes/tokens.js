const router  = require('express').Router();
const { query }          = require('../config/database');
const { authenticate }   = require('../middleware/auth');
const { success, error } = require('../utils/response');
const tokenService       = require('../services/tokenService');

// GET /api/tokens/balance
router.get('/balance', authenticate, async (req, res) => {
  try {
    const wallet = await tokenService.getBalance(req.user.id);
    const code   = await tokenService.getOrCreateReferralCode(req.user.id, req.user.full_name);
    return success(res, { ...wallet, referral_code: code });
  } catch (err) {
    return error(res, 'Failed to fetch balance', 500);
  }
});

// GET /api/tokens/history
router.get('/history', authenticate, async (req, res) => {
  try {
    const history = await tokenService.getHistory(req.user.id, 30);
    return success(res, history);
  } catch (err) {
    return error(res, 'Failed to fetch history', 500);
  }
});

// GET /api/tokens/packages
router.get('/packages', async (req, res) => {
  return success(res, tokenService.PACKAGES);
});

// GET /api/tokens/referrals
router.get('/referrals', authenticate, async (req, res) => {
  try {
    const code = await tokenService.getOrCreateReferralCode(req.user.id, req.user.full_name);

    const stats = await query(
      `SELECT
         (SELECT COUNT(*) FROM referrals WHERE referrer_id = $1) AS total_referrals,
         COALESCE(rc.tokens_earned, 0) AS tokens_earned
       FROM referral_codes rc WHERE rc.user_id = $1`,
      [req.user.id]
    );

    // If no referral code row yet, create one and return zeros
    const statsRow = stats.rows[0] || { total_referrals: 0, tokens_earned: 0 };

    const referrals = await query(
      `SELECT u.full_name, u.created_at AS joined_at, r.bonus_paid
       FROM referrals r
       JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC LIMIT 20`,
      [req.user.id]
    );

    return success(res, {
      referral_code:   code,
      referral_url:    `${process.env.CLIENT_URL}/register?ref=${code}`,
      total_referrals: parseInt(statsRow.total_referrals || 0),
      tokens_earned:   parseInt(statsRow.tokens_earned || 0),
      referrals:       referrals.rows,
      earn_per_referral: tokenService.EARN.referral_bonus,
    });
  } catch (err) {
    console.error(err.message);
    return error(res, 'Failed to fetch referrals', 500);
  }
});

// POST /api/tokens/purchase/initiate
// Initiates a Paystack payment for token purchase
router.post('/purchase/initiate', authenticate, async (req, res) => {
  try {
    const { package_id } = req.body;
    const pkg = tokenService.PACKAGES.find(p => p.id === package_id);
    if (!pkg) return error(res, 'Invalid package', 400);

    // Create pending purchase
    const purchase = await query(
      `INSERT INTO token_purchases (user_id, amount_ngn, tokens, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [req.user.id, pkg.amount_ngn, pkg.tokens]
    );

    const purchaseId = purchase.rows[0].id;

    // In production: call Paystack API to initialize transaction
    // For now: return the details needed to initialize on frontend
    return success(res, {
      purchase_id:  purchaseId,
      amount_ngn:   pkg.amount_ngn,
      tokens:       pkg.tokens,
      email:        req.user.email,
      callback_url: `${process.env.CLIENT_URL}/tokens/verify?purchase_id=${purchaseId}`,
      metadata: {
        purchase_id: purchaseId,
        user_id:     req.user.id,
        tokens:      pkg.tokens,
        package:     pkg.id,
      }
    }, 'Purchase initiated');
  } catch (err) {
    return error(res, 'Failed to initiate purchase', 500);
  }
});

// POST /api/tokens/purchase/verify
// Called after Paystack payment completes
router.post('/purchase/verify', authenticate, async (req, res) => {
  try {
    const { purchase_id, paystack_ref } = req.body;
    if (!purchase_id || !paystack_ref) {
      return error(res, 'purchase_id and paystack_ref are required', 400);
    }

    // Fetch purchase
    const purchase = await query(
      `SELECT * FROM token_purchases WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
      [purchase_id, req.user.id]
    );
    if (purchase.rows.length === 0) {
      return error(res, 'Purchase not found or already processed', 404);
    }

    const pkg = purchase.rows[0];

    // TODO: In production, verify with Paystack API:
    // const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${paystack_ref}`, {
    //   headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    // });
    // const data = await paystackRes.json();
    // if (!data.status || data.data.status !== 'success') return error(res, 'Payment not verified', 400);

    // Mark purchase complete
    await query(
      `UPDATE token_purchases SET status = 'completed', paystack_ref = $1 WHERE id = $2`,
      [paystack_ref, purchase_id]
    );

    // Credit tokens
    const wallet = await tokenService.creditTokens(
      req.user.id, pkg.tokens, 'purchase',
      `Purchased ${pkg.tokens} tokens for ₦${pkg.amount_ngn}`,
      paystack_ref
    );

    return success(res, {
      tokens_credited: pkg.tokens,
      new_balance:     wallet.balance,
    }, `${pkg.tokens} tokens added to your wallet`);
  } catch (err) {
    console.error('verify error:', err.message);
    return error(res, 'Verification failed', 500);
  }
});

// POST /api/tokens/earn/daily-login
router.post('/earn/daily-login', authenticate, async (req, res) => {
  try {
    // Check if already claimed today
    const today = new Date().toISOString().split('T')[0];
    const already = await query(
      `SELECT id FROM token_ledger
       WHERE user_id = $1 AND type = 'daily_login'
         AND created_at::date = $2::date`,
      [req.user.id, today]
    );
    if (already.rows.length > 0) {
      return error(res, 'Daily login bonus already claimed today', 400);
    }

    const wallet = await tokenService.creditTokens(
      req.user.id, tokenService.EARN.daily_login,
      'daily_login', 'Daily login bonus'
    );

    return success(res, {
      earned:      tokenService.EARN.daily_login,
      new_balance: wallet.balance,
    }, `+${tokenService.EARN.daily_login} tokens for logging in today`);
  } catch (err) {
    return error(res, 'Failed to claim bonus', 500);
  }
});

// POST /api/tokens/earn/cbt-completion
router.post('/earn/cbt-completion', authenticate, async (req, res) => {
  try {
    const { attempt_id } = req.body;
    if (!attempt_id) return error(res, 'attempt_id required', 400);

    // Verify attempt belongs to user and is submitted
    const attempt = await query(
      `SELECT id FROM exam_attempts WHERE id = $1 AND student_id = $2 AND is_submitted = TRUE`,
      [attempt_id, req.user.id]
    );
    if (attempt.rows.length === 0) return error(res, 'Attempt not found', 404);

    // Check not already rewarded for this attempt
    const already = await query(
      `SELECT id FROM token_ledger WHERE user_id = $1 AND reference = $2 AND type = 'cbt_completion'`,
      [req.user.id, attempt_id]
    );
    if (already.rows.length > 0) {
      return error(res, 'Already rewarded for this attempt', 400);
    }

    const wallet = await tokenService.creditTokens(
      req.user.id, tokenService.EARN.cbt_completion,
      'cbt_completion', 'Completed a CBT practice test', attempt_id
    );

    return success(res, {
      earned:      tokenService.EARN.cbt_completion,
      new_balance: wallet.balance,
    }, `+${tokenService.EARN.cbt_completion} tokens for completing a CBT test`);
  } catch (err) {
    return error(res, 'Failed to award tokens', 500);
  }
});

module.exports = router;
