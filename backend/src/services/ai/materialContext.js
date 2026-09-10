'use strict';
const { query } = require('../../config/database');
async function retrieve(courseId, message) {
  // First release uses PostgreSQL full-text search; no embedding service or GPU.
  const terms = message.match(/[\p{L}\p{N}]{3,}/gu)?.slice(0, 32) || [];
  if (!terms.length) return [];
  const r = await query(`SELECT ch.material_id, ch.page, ch.content AS text, cm.title
    FROM ai_material_chunks ch JOIN course_materials cm ON cm.id=ch.material_id
    JOIN users u ON u.id=cm.uploaded_by
    WHERE (cm.course_id=$1::uuid OR cm.content_scope='generic') AND cm.is_approved=TRUE AND u.role IN ('admin','super_admin')
      AND ch.file_url=cm.file_url AND ch.search @@ websearch_to_tsquery('english',$2)
    ORDER BY (cm.course_id=$1::uuid) DESC NULLS LAST, ts_rank_cd(ch.search,websearch_to_tsquery('english',$2)) DESC, ch.material_id, ch.chunk_index LIMIT 4`,
  [courseId, terms.join(' OR ')]);
  return r.rows;
}
function publicSources(sources) {
  return sources.map((s,i) => ({ number:i+1, material_id:s.material_id, title:s.title, page:s.page,
    url:`/read?id=${encodeURIComponent(s.material_id)}&type=material` }));
}
module.exports = { retrieve, publicSources };
