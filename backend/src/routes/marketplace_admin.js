'use strict';
const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { success, error } = require('../utils/response');
router.use(authenticate, authorize('admin'));
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
const fail = message => { throw Object.assign(new Error(message), {status:400}); };
const run = fn => async (req,res) => { try { await fn(req,res); } catch(e) {
 if(e.code==='23505') return error(res,'That category already exists.',409);
 if(e.code==='23503') return error(res,'The selected category or institution no longer exists.',409);
 return error(res,e.status ? e.message : 'Unable to save marketplace changes. Please retry.',e.status||500);
}};
router.param('id',(req,res,next,id)=>uuid(id)?next():error(res,'Invalid ID.',400));
router.get('/',run(async(req,res)=>{
 const q = typeof req.query.q==='string' ? req.query.q.trim().slice(0,180) : '';
 const page = Math.max(1,Math.min(100000,parseInt(req.query.page,10)||1));
 const [products,count,categories,summary] = await Promise.all([
 query(`SELECT p.*, c.name category_name, i.name institution_name FROM marketplace_products p JOIN marketplace_categories c ON c.id=p.category_id LEFT JOIN institutions i ON i.id=p.institution_id WHERE p.title ILIKE $1 ORDER BY p.updated_at DESC,p.id LIMIT 20 OFFSET $2`,['%'+q+'%',(page-1)*20]),
 query('SELECT count(*) FROM marketplace_products WHERE title ILIKE $1',['%'+q+'%']),
 query('SELECT * FROM marketplace_categories ORDER BY name'),
 query("SELECT count(*) total,count(*) FILTER(WHERE status='draft') drafts,count(*) FILTER(WHERE status='ready') ready,count(*) FILTER(WHERE format='physical' AND stock=0 AND status<>'archived') out_of_stock FROM marketplace_products")]);
 success(res,{products:products.rows,categories:categories.rows,summary:summary.rows[0],total:Number(count.rows[0].count),pages:Math.max(1,Math.ceil(Number(count.rows[0].count)/20)),page,commerce_enabled:false});
}));
router.post('/categories',run(async(req,res)=>{
 const name=typeof req.body.name==='string'?req.body.name.trim():'';
 if(!name||name.length>100)fail('Enter a category name of 1–100 characters.');
 success(res,(await query('INSERT INTO marketplace_categories(name) VALUES($1) RETURNING *',[name])).rows[0],'Category created',201);
}));
function product(body){
 const title=typeof body.title==='string'?body.title.trim():'';
 const description=typeof body.description==='string'?body.description.trim():'';
 if(!title||title.length>180||description.length>5000)fail('Enter a title up to 180 characters and description up to 5,000 characters.');
 if(!uuid(body.category_id))fail('Choose a category.');
 const institution=body.institution_id||null;
 if(institution!==null&&!uuid(institution))fail('Choose an institution or all institutions.');
 if(!['digital','physical'].includes(body.format))fail('Choose digital or physical.');
 if(!['draft','ready','archived'].includes(body.status))fail('Choose draft, ready or archived.');
 if(!Number.isInteger(body.price_kobo)||body.price_kobo<0||body.price_kobo>100000000)fail('Price must be between ₦0 and ₦1,000,000.');
 const stock=body.format==='digital'?null:body.stock;
 if(body.format==='physical'&&(!Number.isInteger(stock)||stock<0||stock>1000000))fail('Enter a whole stock count between 0 and 1,000,000.');
 return [title,description,body.category_id,institution,body.format,body.price_kobo,stock,body.status];
}
router.post('/products',run(async(req,res)=>{
 const p=product(req.body);
 success(res,(await query(`INSERT INTO marketplace_products(title,description,category_id,institution_id,format,price_kobo,stock,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[...p,req.user.id])).rows[0],'Product saved for launch',201);
}));
router.patch('/products/:id',run(async(req,res)=>{
 const p=product(req.body);
 const result=await query(`UPDATE marketplace_products SET title=$1,description=$2,category_id=$3,institution_id=$4,format=$5,price_kobo=$6,stock=$7,status=$8,updated_at=now() WHERE id=$9 RETURNING *`,[...p,req.params.id]);
 if(!result.rows.length)return error(res,'Product not found.',404);
 success(res,result.rows[0],'Product updated');
}));
module.exports=router;
