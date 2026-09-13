'use strict';

const { randomUUID } = require('node:crypto');
const { getClient, query } = require('../../config/database');
const { aiError } = require('./config');
const tokenService = require('../tokenService');

const AI_KP_COST = tokenService.SPEND.ai_message;

/**
 * Usage model:
 *
 * - First config.dailyLimit requests in a rolling 24-hour window are free.
 * - Requests after that cost AI_KP_COST KP each.
 * - Existing global Gemini capacity/quota limits still apply.
 */
async function dailyUsage(userId, config) {
  const [usage, wallet] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int AS n,
        COALESCE(SUM(tokens_used),0)::int AS tokens
      FROM ai_generation_requests
      WHERE user_id=$1
        AND status='completed'
        AND created_at > NOW()-INTERVAL '24 hours'
    `, [userId]),

    query(`
      SELECT balance
      FROM user_tokens
      WHERE user_id=$1
    `, [userId])
  ]);

  const n = Number(usage.rows[0].n || 0);
  const freeRemaining = Math.max(0, config.dailyLimit - n);
  const kpBalance = Number(wallet.rows[0]?.balance || 0);

  return {
    messages_today: n,
    tokens_today: Number(usage.rows[0].tokens || 0),

    daily_limit: config.dailyLimit,
    limit: config.dailyLimit,

    // Keep this for existing frontend compatibility.
    remaining: freeRemaining,

    free_used: Math.min(n, config.dailyLimit),
    free_remaining: freeRemaining,

    paid_requests: Math.max(0, n - config.dailyLimit),

    kp_per_paid_prompt: AI_KP_COST,
    kp_balance: kpBalance,

    next_request_free: n < config.dailyLimit,
    next_request_cost_kp: n < config.dailyLimit ? 0 : AI_KP_COST,

    plan: 'free_then_kp'
  };
}

async function reserve(userId, feature, cost, config) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Protect quota + wallet admission across all PM2 workers.
    await client.query('SELECT pg_advisory_xact_lock(724109, 1)');

    const r = await client.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE user_id=$1
            AND status='completed'
            AND created_at>NOW()-INTERVAL '24 hours'
        )::int AS daily,

        COUNT(*) FILTER (
          WHERE created_at>NOW()-INTERVAL '24 hours'
        )::int AS global_daily,

        COUNT(*) FILTER (
          WHERE created_at>NOW()-INTERVAL '1 minute'
        )::int AS global_minute,

        COUNT(*) FILTER (
          WHERE status='pending'
            AND created_at>NOW()-INTERVAL '2 minutes'
        )::int AS active,

        COUNT(*) FILTER (
          WHERE user_id=$1
            AND status='pending'
            AND created_at>NOW()-INTERVAL '2 minutes'
        )::int AS user_active,

        COALESCE(
          SUM(cost_micros) FILTER (
            WHERE created_at >=
              date_trunc('month', NOW() AT TIME ZONE 'UTC')
              AT TIME ZONE 'UTC'
          ),
          0
        ) AS spent

      FROM ai_generation_requests
    `, [userId]);

    const row = r.rows[0];

    if (row.user_active || row.active >= config.maxConcurrent) {
      throw aiError(
        'Your study mate is busy. Please wait a moment and try again.',
        429,
        'CAPACITY_LIMIT'
      );
    }

    if (row.global_daily >= config.globalDailyLimit) {
      throw aiError(
        'The AI service has reached its current daily capacity. Please return later.',
        429,
        'GLOBAL_DAILY_LIMIT'
      );
    }

    if (row.global_minute >= config.globalMinuteLimit) {
      throw aiError(
        'Several study requests arrived together. Please wait a minute and try again.',
        429,
        'GLOBAL_MINUTE_LIMIT'
      );
    }

    const requestId = randomUUID();

    const isPaid = row.daily >= config.dailyLimit;
    let kpCharged = 0;
    let kpBalance = null;

    if (isPaid) {
      // Ensure a wallet row exists.
      await client.query(`
        INSERT INTO user_tokens (user_id, balance)
        VALUES ($1, 0)
        ON CONFLICT (user_id) DO NOTHING
      `, [userId]);

      // Atomic debit prevents spending the same KP twice.
      const debit = await client.query(`
        UPDATE user_tokens
        SET
          balance = balance - $2,
          total_spent = total_spent + $2,
          updated_at = NOW()
        WHERE user_id=$1
          AND balance >= $2
        RETURNING balance
      `, [userId, AI_KP_COST]);

      if (!debit.rows.length) {
        const wallet = await client.query(`
          SELECT balance
          FROM user_tokens
          WHERE user_id=$1
        `, [userId]);

        const balance = Number(wallet.rows[0]?.balance || 0);

        throw aiError(
          `Your ${config.dailyLimit} free AI requests have been used. Each additional request costs ${AI_KP_COST} KP. Your balance is ${balance} KP.`,
          402,
          'INSUFFICIENT_KP'
        );
      }

      kpCharged = AI_KP_COST;
      kpBalance = Number(debit.rows[0].balance);

      await client.query(`
        INSERT INTO token_ledger
          (
            user_id,
            type,
            amount,
            balance_after,
            description,
            reference
          )
        VALUES
          ($1,'ai_spend',$2,$3,$4,$5)
      `, [
        userId,
        -AI_KP_COST,
        kpBalance,
        `AI request after ${config.dailyLimit} free requests`,
        requestId
      ]);
    }

    await client.query(`
      INSERT INTO ai_generation_requests
        (id,user_id,feature,cost_micros)
      VALUES
        ($1,$2,$3,$4)
    `, [
      requestId,
      userId,
      feature,
      cost
    ]);

    await client.query('COMMIT');

    return {
      id: requestId,
      kp_charged: kpCharged,
      kp_balance: kpBalance,
      paid: isPaid
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;

  } finally {
    client.release();
  }
}

/**
 * Mark a failed AI request and refund KP when this was a paid request.
 */
async function fail(reservation) {
  if (!reservation) return;

  // Backward compatibility with old callers.
  const id = typeof reservation === 'string'
    ? reservation
    : reservation.id;

  const kpCharged = typeof reservation === 'object'
    ? Number(reservation.kp_charged || 0)
    : 0;

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const changed = await client.query(`
      UPDATE ai_generation_requests
      SET
        status='failed',
        updated_at=NOW()
      WHERE id=$1
        AND status='pending'
      RETURNING user_id
    `, [id]);

    if (changed.rows.length && kpCharged > 0) {
      const userId = changed.rows[0].user_id;

      const refunded = await client.query(`
        UPDATE user_tokens
        SET
          balance = balance + $2,
          total_spent = GREATEST(0, total_spent - $2),
          updated_at = NOW()
        WHERE user_id=$1
        RETURNING balance
      `, [userId, kpCharged]);

      if (refunded.rows.length) {
        await client.query(`
          INSERT INTO token_ledger
            (
              user_id,
              type,
              amount,
              balance_after,
              description,
              reference
            )
          VALUES
            ($1,'ai_spend',$2,$3,$4,$5)
        `, [
          userId,
          kpCharged,
          refunded.rows[0].balance,
          'Refund for failed AI request',
          id
        ]);
      }
    }

    await client.query('COMMIT');

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;

  } finally {
    client.release();
  }
}

module.exports = {
  AI_KP_COST,
  dailyUsage,
  reserve,
  fail
};
