'use strict';
// Index existing, approved admin-supplied PDFs/TXT/MD. Run from any directory.
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});
const {pool}=require('../src/config/database');
const backend=path.resolve(__dirname,'..');
function chunks(text){
  const out=[];
  text.split('\f').forEach((page,p)=>{
    const clean=page.replace(/\0/g,'').replace(/[ \t]+/g,' ').trim();
    for(let start=0;start<clean.length;start+=1500){
      const part=clean.slice(start,start+1800);
      if(part.trim().length>=40)out.push({page:p+1,content:part});
    }
  });
  return out;
}
async function extract(material,uploadRoot){
  if(!/^\/uploads\/[^/\\]+$/.test(material.file_url))throw new Error('unsupported file location');
  const filename=path.basename(material.file_url);
  const real=await fs.realpath(path.join(uploadRoot,filename));
  if(!real.startsWith(uploadRoot+path.sep))throw new Error('file is outside uploads');
  const stat=await fs.stat(real);
  if(!stat.isFile()||stat.size>50*1024*1024)throw new Error('file exceeds 50 MB');
  const ext=path.extname(filename).toLowerCase();
  if(ext==='.pdf')return (await exec('pdftotext',['-enc','UTF-8',real,'-'],{timeout:60000,maxBuffer:8*1024*1024})).stdout;
  if(['.txt','.md'].includes(ext)){
    if(stat.size>8*1024*1024)throw new Error('text exceeds 8 MB');
    return fs.readFile(real,'utf8');
  }
  throw new Error('convert DOC/PPT files to text PDF before indexing');
}
async function main(){
  const uploadRoot=await fs.realpath(path.resolve(backend,process.env.UPLOAD_DIR||'uploads'));
  const client=await pool.connect();
  let locked=false;
  try{
    locked=(await client.query('SELECT pg_try_advisory_lock(724109,2) AS locked')).rows[0].locked;
    if(!locked)throw new Error('another indexer is running');
    const r=await client.query(`SELECT cm.id,cm.file_url FROM course_materials cm JOIN users u ON u.id=cm.uploaded_by
      WHERE cm.is_approved=TRUE AND u.role IN ('admin','super_admin') ORDER BY cm.created_at`);
    let done=0,skipped=0;
    for(const material of r.rows){
      try{
        const parts=chunks(await extract(material,uploadRoot));
        if(!parts.length)throw new Error('no readable text; scanned PDFs need OCR');
        await client.query('BEGIN');
        await client.query('DELETE FROM ai_material_chunks WHERE material_id=$1',[material.id]);
        for(let i=0;i<parts.length;i++)await client.query('INSERT INTO ai_material_chunks(material_id,chunk_index,page,content,file_url) VALUES($1,$2,$3,$4,$5)',[material.id,i,parts[i].page,parts[i].content,material.file_url]);
        await client.query('COMMIT');
        done++;console.log(`Indexed ${material.id}: ${parts.length} passages.`);
      }catch(err){
        await client.query('ROLLBACK');
        // Never leave stale passages from an unreadable/replaced document active.
        await client.query('DELETE FROM ai_material_chunks WHERE material_id=$1',[material.id]);
        skipped++;console.log(`Skipped ${material.id}: ${err.code==='ENOENT'?'file or pdftotext missing':String(err.message).split('\n')[0].slice(0,120)}`);
      }
    }
    console.log(`Material index finished: ${done} indexed, ${skipped} skipped. Skipped files remain available in Learn.`);
  }finally{
    if(locked)await client.query('SELECT pg_advisory_unlock(724109,2)');
    client.release();
  }
}
if(require.main===module)main().catch(()=>{console.error('Indexing could not run. Check the database, migration and uploads directory.');process.exitCode=1;}).finally(()=>pool.end());
module.exports={chunks,extract};
