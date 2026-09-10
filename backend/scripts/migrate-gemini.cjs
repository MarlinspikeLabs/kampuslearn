'use strict';
const path=require('node:path');
const fs=require('node:fs');
require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});
const {pool}=require('../src/config/database');
(async()=>{
  await pool.query(fs.readFileSync(path.resolve(__dirname,'../migrations/20260907_gemini.sql'),'utf8'));
  console.log('Gemini usage ledger, material index and message references are ready. Existing accounts and materials are preserved.');
})().catch(()=>{console.error('Gemini migration failed. Check database connectivity and schema; no API key is printed.');process.exitCode=1;}).finally(()=>pool.end());
