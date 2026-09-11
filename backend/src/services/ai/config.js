'use strict';
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const configPath = path.resolve(__dirname, '../../../.env.gemini');
// This file is server-only and takes precedence over stale PM2 environment values.
function getConfig() {
  const env = { ...process.env, ...(fs.existsSync(configPath) ? dotenv.parse(fs.readFileSync(configPath)) : {}) };
  function number(name, fallback, min, max) {
    const value = Number(env[name] ?? fallback);
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
    return value;
  }
  return {
    provider: env.AI_PROVIDER || 'disabled',
    apiKey: env.GEMINI_API_KEY || '',
    model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    billingTier: env.GEMINI_BILLING_TIER || 'free',
    monthlyBudgetMicros: 0,
    globalDailyLimit: Math.floor(number('AI_GLOBAL_DAILY_LIMIT', 20, 1, 10000)),
    globalMinuteLimit: Math.floor(number('AI_GLOBAL_MINUTE_LIMIT', 4, 1, 100)),
    dailyLimit: Math.floor(number('AI_DAILY_LIMIT', 10, 1, 200)),
    maxConcurrent: Math.floor(number('AI_MAX_CONCURRENT', 1, 1, 10)),
    maxOutput: Math.floor(number('AI_MAX_OUTPUT_TOKENS', 1024, 128, 2048)),
    maxInput: 8192,
    timeoutMs: 25000,
  };
}
function aiError(message, status = 503, code = 'AI_UNAVAILABLE') {
  return Object.assign(new Error(message), { status, code, publicMessage: message });
}
function requireGemini(config = getConfig()) {
  if (config.provider !== 'gemini' || !config.apiKey) throw aiError('Your study mate is being connected. Please try again shortly.');
  // This release has no paid mode or model fallback. Google project billing is managed in AI Studio.
  if (config.billingTier !== 'free' || config.model !== 'gemini-3.5-flash-lite') throw aiError('The study service configuration needs attention.');
  return config;
}
module.exports = { getConfig, requireGemini, aiError, configPath };
