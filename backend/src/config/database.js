const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ DB connected');
  }
});

pool.on('error', (err) => {
  console.error('❌ DB pool error:', err.message);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`⚠️  Slow query (${ms}ms):`, text.substring(0, 80));
    }
    return res;
  } catch (err) {
    console.error('❌ Query error:', err.message, '\nSQL:', text.substring(0, 100));
    throw err;
  }
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
