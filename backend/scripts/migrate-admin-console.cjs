'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/config/database');
(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query(fs.readFileSync(path.resolve(__dirname, '../migrations/20260908_admin_console.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Admin console migration complete. Existing accounts and academic data preserved.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
})().catch(err => { console.error(err.message); process.exitCode = 1; pool.end(); });
