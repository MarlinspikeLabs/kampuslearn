'use strict';
const fs=require('node:fs'),path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const {getClient,pool}=require('../src/config/database');
(async()=>{const c=await getClient();try{
 await c.query('BEGIN');
 await c.query(fs.readFileSync(path.resolve(__dirname,'../migrations/20260910_shared_academics.sql'),'utf8'));
 await c.query('COMMIT');console.log('Shared academic template tracking is ready. No institutions seeded.');
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
