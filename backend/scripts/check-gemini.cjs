'use strict';
const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});
const {requireGemini}=require('../src/services/ai/config');
const {prepare,generate}=require('../src/services/ai/gemini');
(async()=>{
  const config=requireGemini();
  console.log(`Configuration ready: ${config.model}, free-tier mode. API key is present and hidden.`);
  console.log('Confirm Free tier and disabled billing in AI Studio; an API key does not reveal its billing tier.');
  if(!process.argv.includes('--live')){console.log('No API call made. Add --live to make one small connection test using your project quota.');return;}
  const prepared=await prepare([{role:'user',content:'What is 2 + 2? Reply in one short sentence.'}],null,{},[],{...config,maxOutput:128});
  const result=await generate(prepared);
  console.log(`Gemini replied successfully: ${result.content}`);
  console.log(`Reported tokens: ${result.tokens_used}. This admin smoke test is outside the student usage ledger.`);
})().catch(err=>{console.error(`Gemini check failed (${err.code||'CONFIG'}): ${err.publicMessage||'Check configuration.'}`);process.exitCode=1;});
