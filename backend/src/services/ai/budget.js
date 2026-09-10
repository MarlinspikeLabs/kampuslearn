'use strict';
const { randomUUID } = require('node:crypto');
const { getClient, query } = require('../../config/database');
const { aiError } = require('./config');
async function dailyUsage(userId, config) {
  const r = await query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(tokens_used),0)::int AS tokens
    FROM ai_generation_requests WHERE user_id=$1 AND created_at > NOW()-INTERVAL '24 hours'`, [userId]);
  return { messages_today: r.rows[0].n, tokens_today: r.rows[0].tokens, daily_limit: config.dailyLimit,
    limit: config.dailyLimit, remaining: Math.max(0, config.dailyLimit-r.rows[0].n), plan: 'free' };
}
async function reserve(userId, feature, cost, config) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Cross-process lock: protects the budget and capacity across all PM2 workers.
    await client.query('SELECT pg_advisory_xact_lock(724109, 1)');
    const r = await client.query(`SELECT
      COUNT(*) FILTER (WHERE user_id=$1 AND created_at>NOW()-INTERVAL '24 hours')::int AS daily,
      COUNT(*) FILTER (WHERE created_at>NOW()-INTERVAL '24 hours')::int AS global_daily,
      COUNT(*) FILTER (WHERE created_at>NOW()-INTERVAL '1 minute')::int AS global_minute,
      COUNT(*) FILTER (WHERE status='pending' AND created_at>NOW()-INTERVAL '2 minutes')::int AS active,
      COUNT(*) FILTER (WHERE user_id=$1 AND status='pending' AND created_at>NOW()-INTERVAL '2 minutes')::int AS user_active,
      COALESCE(SUM(cost_micros) FILTER (WHERE created_at>=date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0) AS spent
      FROM ai_generation_requests`, [userId]);
    const row = r.rows[0];
    if (row.daily >= config.dailyLimit) throw aiError(`You have used your ${config.dailyLimit} study requests in the last 24 hours. Please return later.`, 429, 'DAILY_LIMIT');
    if (row.user_active || row.active >= config.maxConcurrent) throw aiError('Your study mate is busy. Please wait a moment and try again.', 429, 'CAPACITY_LIMIT');
    if (row.global_daily >= config.globalDailyLimit) throw aiError('The free AI pilot has reached its daily allowance. Please return later. Course materials and practice remain available.',429,'GLOBAL_DAILY_LIMIT');
    if (row.global_minute >= config.globalMinuteLimit) throw aiError('Several study requests arrived together. Please wait a minute and try again.',429,'GLOBAL_MINUTE_LIMIT');
    const id = randomUUID();
    await client.query('INSERT INTO ai_generation_requests(id,user_id,feature,cost_micros) VALUES($1,$2,$3,$4)', [id,userId,feature,cost]);
    await client.query('COMMIT');
    return id;
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}
async function fail(id) {
  // Failed attempts still count toward free-tier admission limits; no automatic retry.
  await query("UPDATE ai_generation_requests SET status='failed', updated_at=NOW() WHERE id=$1 AND status='pending'", [id]);
}
module.exports = { dailyUsage, reserve, fail };
