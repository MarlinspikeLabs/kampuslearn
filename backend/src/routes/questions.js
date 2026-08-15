const router = require("express").Router();
const { query } = require("../config/database");
const { authenticate, authorize, optionalAuth } = require("../middleware/auth");
const { success, error } = require("../utils/response");

// GET /api/questions
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { course_id, topic_id, difficulty, type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let conditions = ["q.is_approved = TRUE"];
    if (course_id) { params.push(course_id); conditions.push("q.course_id = $" + params.length); }
    if (topic_id)  { params.push(topic_id);  conditions.push("q.topic_id = $" + params.length); }
    if (difficulty){ params.push(difficulty); conditions.push("q.difficulty = $" + params.length); }
    if (type)      { params.push(type);       conditions.push("q.question_type = $" + params.length); }
    const where = "WHERE " + conditions.join(" AND ");
    const countRes = await query("SELECT COUNT(*) FROM questions q " + where, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(parseInt(limit), offset);
    const result = await query(
      "SELECT q.id, q.question_text, q.question_type, q.options, q.difficulty, q.marks, q.year, q.created_at, c.title AS course_title, c.code AS course_code, t.name AS topic_name, u.full_name AS created_by_name FROM questions q JOIN courses c ON c.id = q.course_id LEFT JOIN topics t ON t.id = q.topic_id JOIN users u ON u.id = q.created_by " + where + " ORDER BY q.created_at DESC LIMIT $" + (params.length-1) + " OFFSET $" + params.length,
      params
    );
    return success(res, { questions: result.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total/parseInt(limit)) } });
  } catch(e) { console.error(e.message); return error(res, "Failed to fetch questions", 500); }
});

// GET /api/questions/course/:courseId/stats
router.get("/course/:courseId/stats", optionalAuth, async (req, res) => {
  try {
    const r = await query(
      "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE difficulty='easy') AS easy, COUNT(*) FILTER (WHERE difficulty='medium') AS medium, COUNT(*) FILTER (WHERE difficulty='hard') AS hard, COUNT(*) FILTER (WHERE question_type='mcq') AS mcq, COUNT(DISTINCT topic_id) AS topics_covered, COUNT(DISTINCT year) AS years_covered, MIN(year) AS earliest_year, MAX(year) AS latest_year FROM questions WHERE course_id = $1 AND is_approved = TRUE",
      [req.params.courseId]
    );
    return success(res, r.rows[0]);
  } catch(e) { return error(res, "Failed to fetch stats", 500); }
});

// GET /api/questions/:id
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const r = await query(
      "SELECT q.*, c.title AS course_title, c.code AS course_code, t.name AS topic_name, u.full_name AS created_by_name FROM questions q JOIN courses c ON c.id=q.course_id LEFT JOIN topics t ON t.id=q.topic_id JOIN users u ON u.id=q.created_by WHERE q.id=$1 AND q.is_approved=TRUE",
      [req.params.id]
    );
    if (r.rows.length === 0) return error(res, "Question not found", 404);
    const q = r.rows[0];
    if (!req.user || !["admin","lecturer"].includes(req.user.role)) { delete q.correct_answer; delete q.explanation; }
    return success(res, q);
  } catch(e) { return error(res, "Failed to fetch question", 500); }
});

// POST /api/questions
router.post("/", authenticate, authorize("admin","lecturer"), async (req, res) => {
  try {
    const { course_id, question_text, question_type="mcq", options, correct_answer, explanation, difficulty="medium", marks=1, topic_id, year } = req.body;
    if (!course_id || !question_text || !correct_answer) return error(res, "course_id, question_text, correct_answer required", 400);
    if (question_type==="mcq" && (!options||!Array.isArray(options)||options.length<2)) return error(res,"MCQ needs 2+ options",400);
    const cc = await query("SELECT id FROM courses WHERE id=$1",[course_id]);
    if (cc.rows.length===0) return error(res,"Course not found",404);
    const r = await query(
      "INSERT INTO questions (course_id,created_by,question_text,question_type,options,correct_answer,explanation,difficulty,marks,topic_id,year,is_approved) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE) RETURNING id,question_text,question_type,difficulty,marks,created_at",
      [course_id,req.user.id,question_text.trim(),question_type,options?JSON.stringify(options):null,correct_answer.trim(),explanation||null,difficulty,parseInt(marks),topic_id||null,year||null]
    );
    return success(res, r.rows[0], "Question added", 201);
  } catch(e) { return error(res,"Failed to add question",500); }
});

// DELETE /api/questions/:id
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const r = await query("DELETE FROM questions WHERE id=$1 RETURNING id",[req.params.id]);
    if (r.rows.length===0) return error(res,"Not found",404);
    return success(res,{},"Question deleted");
  } catch(e) { return error(res,"Delete failed",500); }
});

module.exports = router;