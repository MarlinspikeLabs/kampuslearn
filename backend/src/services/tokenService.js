const { query } = require('../config/database');

// Token earning amounts
const EARN = {
  welcome_bonus:       50,
  referral_bonus:     100,   // referrer earns when their referral joins
  referral_join_bonus: 20,   // new user earns for using a referral code
  daily_login:          5,
  cbt_completion:       2,
  content_upload:      25,
};

// Token spending amounts
const SPEND = {
  ai_message:   1,
  download:     5,
};

// Purchase packages
const PACKAGES = [
  { id: 'starter',  amount_ngn: 200,  tokens: 50,   bonus_pct: 0  },
  { id: 'basic',    amount_ngn: 500,  tokens: 150,  bonus_pct: 20 },
  { id: 'popular',  amount_ngn: 1000, tokens: 350,  bonus_pct: 40 },
  { id: 'premium',  amount_ngn: 2500, tokens: 1000, bonus_pct: 60 },
];

// ── Get or create token wallet ────────────────────────────────
async function getBalance(userId) {
  const result = await query(
    'SELECT balance, total_earned, total_spent FROM user_tokens WHERE user_id = $1',
    [userId]
  );
  if (result.rows.length === 0) {
    await query(
      'INSERT INTO user_tokens (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING',
      [userId]
    );
    return { balance: 0, total_earned: 0, total_spent: 0 };
  }
  return result.rows[0];
}

// ── Credit tokens ─────────────────────────────────────────────
async function creditTokens(userId, amount, type, description = '', reference = null) {
  // Upsert wallet
  await query(
    `INSERT INTO user_tokens (user_id, balance, total_earned)
     VALUES ($1, $2, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       balance      = user_tokens.balance + $2,
       total_earned = user_tokens.total_earned + $2,
       updated_at   = NOW()`,
    [userId, amount]
  );

  // Get new balance
  const wallet = await query(
    'SELECT balance FROM user_tokens WHERE user_id = $1', [userId]
  );
  const balanceAfter = wallet.rows[0].balance;

  // Log transaction
  await query(
    `INSERT INTO token_ledger (user_id, type, amount, balance_after, description, reference)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, amount, balanceAfter, description, reference]
  );

  return { balance: balanceAfter, credited: amount };
}

// ── Debit tokens ──────────────────────────────────────────────
async function debitTokens(userId, amount, type, description = '') {
  const wallet = await getBalance(userId);
  if (wallet.balance < amount) {
    return { success: false, message: 'Insufficient tokens', balance: wallet.balance };
  }

  await query(
    `UPDATE user_tokens SET
       balance    = balance - $2,
       total_spent = total_spent + $2,
       updated_at = NOW()
     WHERE user_id = $1`,
    [userId, amount]
  );

  const updated = await query(
    'SELECT balance FROM user_tokens WHERE user_id = $1', [userId]
  );
  const balanceAfter = updated.rows[0].balance;

  await query(
    `INSERT INTO token_ledger (user_id, type, amount, balance_after, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, -amount, balanceAfter, description]
  );

  return { success: true, balance: balanceAfter, debited: amount };
}

// ── Check if user has enough tokens ──────────────────────────
async function hasTokens(userId, amount) {
  const wallet = await getBalance(userId);
  return wallet.balance >= amount;
}

// ── Generate unique referral code ─────────────────────────────
function generateCode(name) {
  const base = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${rand}`;
}

// ── Create referral code for user ────────────────────────────
async function getOrCreateReferralCode(userId, userName) {
  const existing = await query(
    'SELECT code FROM referral_codes WHERE user_id = $1', [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0].code;

  let code;
  let attempts = 0;
  do {
    code = generateCode(userName);
    const taken = await query('SELECT id FROM referral_codes WHERE code = $1', [code]);
    if (taken.rows.length === 0) break;
    attempts++;
  } while (attempts < 10);

  await query(
    'INSERT INTO referral_codes (user_id, code) VALUES ($1, $2)',
    [userId, code]
  );
  return code;
}

// ── Process referral on registration ─────────────────────────
async function processReferral(newUserId, referralCode) {
  if (!referralCode) return;

  const codeResult = await query(
    'SELECT user_id FROM referral_codes WHERE code = $1',
    [referralCode.toUpperCase()]
  );
  if (codeResult.rows.length === 0) return;

  const referrerId = codeResult.rows[0].user_id;
  if (referrerId === newUserId) return; // can't refer yourself

  // Check not already referred
  const alreadyReferred = await query(
    'SELECT id FROM referrals WHERE referred_id = $1', [newUserId]
  );
  if (alreadyReferred.rows.length > 0) return;

  // Record referral
  await query(
    'INSERT INTO referrals (referrer_id, referred_id, code) VALUES ($1, $2, $3)',
    [referrerId, newUserId, referralCode.toUpperCase()]
  );

  // Give join bonus to new user
  await creditTokens(
    newUserId, EARN.referral_join_bonus, 'referral_join_bonus',
    `Welcome bonus for joining via referral code ${referralCode}`
  );

  // Give referral bonus to referrer
  await creditTokens(
    referrerId, EARN.referral_bonus, 'referral_bonus',
    `Referral bonus — someone joined using your code`,
    newUserId
  );

  // Update referral code stats
  await query(
    `UPDATE referral_codes SET uses = uses + 1, tokens_earned = tokens_earned + $1
     WHERE code = $2`,
    [EARN.referral_bonus, referralCode.toUpperCase()]
  );
}

// ── Get transaction history ───────────────────────────────────
async function getHistory(userId, limit = 20) {
  const result = await query(
    `SELECT type, amount, balance_after, description, created_at
     FROM token_ledger WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

module.exports = {
  EARN, SPEND, PACKAGES,
  getBalance, creditTokens, debitTokens,
  hasTokens, getOrCreateReferralCode,
  processReferral, getHistory
};
