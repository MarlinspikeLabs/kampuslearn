'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const {getClient} = require('../config/database');
const tables = {material:'course_materials', past_question:'past_questions'};
const ident = value => '"' + value.replace(/"/g, '""') + '"';
const fail = (message,status) => Object.assign(new Error(message),{status});

// Refuse cascades: content may already be referenced by questions or student records.
module.exports = async function deleteContent(kind,id) {
 const table = Object.hasOwn(tables,kind) ? tables[kind] : null;
 if(!table) throw fail('Invalid content type',400);
 const client = await getClient();
 let fileUrl, shared = false;
 try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '5s'");
  const item = await client.query(`SELECT id,file_url FROM ${table} WHERE id=$1 FOR UPDATE`,[id]);
  if(!item.rows.length) throw fail('Content not found',404);
  fileUrl = item.rows[0].file_url;
  const refs = await client.query(`SELECT n.nspname schema_name,t.relname table_name,a.attname column_name
   FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
   JOIN pg_namespace n ON n.oid=t.relnamespace
   JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
   WHERE c.contype='f' AND c.confrelid=$1::regclass`,[table]);
  for(const r of refs.rows) {
   const used = await client.query(`SELECT 1 FROM ${ident(r.schema_name)}.${ident(r.table_name)} WHERE ${ident(r.column_name)}::text=$1 LIMIT 1`,[id]);
   if(used.rows.length) throw fail('This content has linked records. Unpublish it instead, or resolve its linked records before deleting.',409);
  }
  await client.query(`DELETE FROM ${table} WHERE id=$1`,[id]);
  if(fileUrl) {
   const other = await client.query('SELECT 1 FROM course_materials WHERE file_url=$1 UNION ALL SELECT 1 FROM past_questions WHERE file_url=$1 LIMIT 1',[fileUrl]);
   shared = other.rows.length>0;
  }
  await client.query('COMMIT');
 } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}

 // Only generated, flat local upload paths may be removed. Never follow remote URLs or symlinks.
 let file_cleanup = shared ? 'shared_file_retained' : 'not_applicable';
 if(!shared && typeof fileUrl==='string' && /^\/uploads\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(fileUrl)) {
  const root=path.resolve(process.env.UPLOAD_DIR||'./uploads');
  const candidate=path.join(root,path.basename(fileUrl));
  try {
   const stat=await fs.lstat(candidate);
   if(stat.isFile()&&!stat.isSymbolicLink()) {await fs.unlink(candidate);file_cleanup='removed';}
   else file_cleanup='retained';
  } catch(e) {
   file_cleanup=e.code==='ENOENT'?'already_absent':'pending';
   if(file_cleanup==='pending') console.warn('Content deleted; upload cleanup pending:',id,e.code);
  }
 }
 return {id,file_cleanup};
};
