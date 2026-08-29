'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Users, BookOpen, FileText, BarChart3, Brain,
  CheckCircle, XCircle, Shield, Crown, Loader2,
  UserPlus, AlertTriangle, ChevronRight,
  Trash2, GraduationCap, LogOut, Building2, Upload,
  Plus, ChevronDown, FolderOpen
} from 'lucide-react';

// ── Sidebar ───────────────────────────────────────────────────
const NAV = [
  { id: 'overview',     icon: BarChart3,  label: 'Overview'         },
  { id: 'content',      icon: FileText,   label: 'Content Approval' },
  { id: 'upload',       icon: Upload,     label: 'Upload Content'   },
  { id: 'institutions', icon: Building2,  label: 'Institutions'     },
  { id: 'users',        icon: Users,      label: 'Users'            },
  { id: 'admins',       icon: Shield,     label: 'Manage Admins'    },
];

function Sidebar({ active, setActive, user, logout }) {
  return (
    <aside className="w-64 bg-gray-950 text-white flex flex-col flex-shrink-0 h-screen">
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">KampusLearn</p>
            <p className="text-xs text-gray-400">Admin Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 rounded-xl p-3">
          <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-orange-500
                          rounded-full flex items-center justify-center font-bold text-sm text-white">
            {user?.full_name?.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Crown className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-yellow-400 font-medium capitalize">
                {user?.role?.replace('_',' ')}
              </span>
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(item => (
          <button key={item.id} onClick={() => setActive(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                              text-sm font-medium transition-colors text-left
                    ${active === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}>
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-800">
        <a href="/dashboard"
           className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                      text-gray-400 hover:bg-gray-900 hover:text-white transition-colors">
          <GraduationCap className="w-5 h-5" /> Student View
        </a>
        <button onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                           text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors mt-1">
          <LogOut className="w-5 h-5" /> Sign out
        </button>
      </div>
    </aside>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, alert }) {
  return (
    <div className={`bg-white rounded-2xl p-5 border shadow-sm
      ${alert ? 'border-amber-200 bg-amber-50' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────
function Overview({ stats, activity }) {
  if (!stats) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Platform Overview</h2>
        <p className="text-gray-500 text-sm">Live stats</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}     label="Students"      value={stats.students}         color="bg-blue-100 text-blue-600"   sub={`+${stats.new_users_week} this week`} />
        <StatCard icon={BookOpen}  label="Courses"       value={stats.courses}          color="bg-purple-100 text-purple-600" />
        <StatCard icon={BarChart3} label="Exam Attempts" value={stats.total_attempts}   color="bg-green-100 text-green-600" />
        <StatCard icon={Brain}     label="AI Chats"      value={stats.ai_conversations} color="bg-orange-100 text-orange-600" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}      label="Materials"      value={stats.total_materials} color="bg-cyan-100 text-cyan-600" />
        <StatCard icon={FileText}      label="Past Questions" value={stats.total_pqs}       color="bg-indigo-100 text-indigo-600" />
        <StatCard icon={Crown}         label="Premium Users"  value={stats.premium_users}   color="bg-yellow-100 text-yellow-600" />
        <StatCard icon={AlertTriangle} label="Pending Review"
          value={parseInt(stats.pending_materials||0)+parseInt(stats.pending_pqs||0)}
          color="bg-amber-100 text-amber-600"
          alert={parseInt(stats.pending_materials||0)+parseInt(stats.pending_pqs||0)>0} />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b"><h3 className="font-semibold text-gray-900">Recent Activity</h3></div>
        <div className="divide-y divide-gray-50">
          {activity.length === 0
            ? <p className="text-center text-gray-400 py-8 text-sm">No activity yet</p>
            : activity.slice(0,8).map((a,i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{a.event}</span>
                    <span className="text-sm text-gray-500"> — {a.actor}</span>
                    {a.detail && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{a.detail}</p>}
                  </div>
                </div>
                <span className="text-xs text-gray-400">{new Date(a.time).toLocaleDateString()}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Content Approval ──────────────────────────────────────────
function ContentApproval() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    api.get('/admin/content/pending').then(r => setData(r.data.data)).catch(() => toast.error('Failed')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const approve = async (type,id) => { try { await api.patch(`/admin/content/${type}/${id}/approve`); toast.success('Approved'); load(); } catch { toast.error('Failed'); } };
  const reject  = async (type,id) => { if (!confirm('Reject and delete?')) return; try { await api.patch(`/admin/content/${type}/${id}/reject`); toast.success('Rejected'); load(); } catch { toast.error('Failed'); } };
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  const total = (data?.materials?.length||0)+(data?.past_questions?.length||0);
  const ActionBtns = ({type,id}) => (
    <div className="flex gap-2 flex-shrink-0">
      <button onClick={()=>approve(type,id)} className="flex items-center gap-1 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg"><CheckCircle className="w-3.5 h-3.5"/>Approve</button>
      <button onClick={()=>reject(type,id)}  className="flex items-center gap-1 bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-lg"><XCircle className="w-3.5 h-3.5"/>Reject</button>
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-900">Content Approval</h2>
          <p className="text-gray-500 text-sm mt-1">{total===0?'All clear':`${total} items pending`}</p></div>
        <button onClick={load} className="btn-secondary text-sm">Refresh</button>
      </div>
      {total===0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3"/>
          <p className="text-gray-500 font-medium">All clear!</p>
        </div>
      ) : (
        <>
          {data.materials.length>0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50"><h3 className="font-semibold">Materials ({data.materials.length})</h3></div>
              {data.materials.map(m=>(
                <div key={m.id} className="px-5 py-4 flex items-center justify-between gap-4 border-b last:border-0">
                  <div className="min-w-0"><p className="font-medium text-gray-900 truncate">{m.title}</p><p className="text-xs text-gray-500">{m.course_code} · {m.material_type} · {m.uploader}</p></div>
                  <ActionBtns type="material" id={m.id}/>
                </div>
              ))}
            </div>
          )}
          {data.past_questions.length>0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50"><h3 className="font-semibold">Past Questions ({data.past_questions.length})</h3></div>
              {data.past_questions.map(pq=>(
                <div key={pq.id} className="px-5 py-4 flex items-center justify-between gap-4 border-b last:border-0">
                  <div className="min-w-0"><p className="font-medium">{pq.course_code} — {pq.title} {pq.exam_type}</p><p className="text-xs text-gray-500">{pq.uploader}</p></div>
                  <ActionBtns type="past_question" id={pq.id}/>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Upload Content ────────────────────────────────────────────
function UploadContent() {
  const [uploadType, setUploadType] = useState('material');
  const [scope, setScope]           = useState('specific');
  const [institutions, setInstitutions] = useState([]);
  const [faculties, setFaculties]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses]       = useState([]);
  const [selInst, setSelInst]       = useState('');
  const [selFac, setSelFac]         = useState('');
  const [selDept, setSelDept]       = useState('');
  const [selCourse, setSelCourse]   = useState('');
  const [file, setFile]             = useState(null);
  const [form, setForm]             = useState({
    title:'', material_type:'lecture_note', description:'', tags:'',
    year: new Date().getFullYear(), exam_type:'semester', has_answers:false,
    level:'100', course_code:'', course_title:'', semester:'first', credit_units:3
  });
  const [uploading, setUploading]   = useState(false);
  const [creating, setCreating]     = useState(false);

  const LEVELS = ['100','200','300','400','500','600','ND1','ND2','HND1','HND2'];

  useEffect(() => {
    api.get('/manage/institutions').then(r => setInstitutions(r.data.data)).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!selInst) { setFaculties([]); setSelFac(''); setDepartments([]); setSelDept(''); setCourses([]); setSelCourse(''); return; }
    const inst = institutions.find(i => i.id === selInst);
    const ep = inst?.type==='university' ? `/manage/institutions/${selInst}/faculties` : `/manage/institutions/${selInst}/schools`;
    api.get(ep).then(r => setFaculties(r.data.data)).catch(()=>{});
    setSelFac(''); setDepartments([]); setSelDept(''); setCourses([]); setSelCourse('');
  }, [selInst]);

  useEffect(() => {
    if (!selFac) { setDepartments([]); setSelDept(''); setCourses([]); setSelCourse(''); return; }
    const inst = institutions.find(i => i.id === selInst);
    const ep = inst?.type==='university' ? `/manage/faculties/${selFac}/departments` : `/manage/schools/${selFac}/departments`;
    api.get(ep).then(r => setDepartments(r.data.data)).catch(()=>{});
    setSelDept(''); setCourses([]); setSelCourse('');
  }, [selFac]);

  useEffect(() => {
    if (!selDept) { setCourses([]); setSelCourse(''); return; }
    api.get(`/manage/departments/${selDept}/courses`).then(r => setCourses(r.data.data)).catch(()=>{});
    setSelCourse('');
  }, [selDept]);

  // Resolve or create course, return course_id
  const resolveCourse = async () => {
    if (scope === 'specific') {
      if (selCourse) return selCourse;
      // Create course in selected department
      if (!selDept || !form.course_code || !form.course_title) {
        toast.error('Select department and enter course code + title'); return null;
      }
      setCreating(true);
      try {
        const r = await api.post(`/manage/departments/${selDept}/courses`, {
          title:        form.course_title,
          code:         form.course_code,
          level:        form.level,
          semester:     form.semester,
          credit_units: form.credit_units,
        });
        return r.data.data.id;
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to create course');
        return null;
      } finally { setCreating(false); }
    } else {
      // Generic — find existing by code or create in a generic department
      // Search all courses by code
      if (!form.course_code || !form.course_title) {
        toast.error('Enter course code and title'); return null;
      }
      try {
        const r = await api.get(`/institutions/courses/by-code?code=${form.course_code}`);
        if (r.data.data?.id) return r.data.data.id;
      } catch {}
      // Not found — need dept to create. Prompt admin to use specific mode.
      toast.error('Course code not found in database. Use "Institution Specific" to add new courses.');
      return null;
    }
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Select a file'); return; }
    setUploading(true);
    try {
      const courseId = await resolveCourse();
      if (!courseId) { setUploading(false); return; }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('course_id', courseId);

      if (uploadType === 'material') {
        fd.append('title', form.title || file.name);
        fd.append('material_type', form.material_type);
        fd.append('description', form.description);
        fd.append('tags', form.tags);
        await api.post('/admin-upload/material', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Material uploaded and published!');
      } else {
        fd.append('year', form.year);
        fd.append('exam_type', form.exam_type);
        fd.append('has_answers', form.has_answers);
        await api.post('/admin-upload/past-question', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Past question uploaded!');
      }
      setFile(null);
      setSelCourse('');
      setForm(f => ({ ...f, title:'', description:'', tags:'', course_code:'', course_title:'' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Upload Content</h2>
        <p className="text-gray-500 text-sm mt-1">Upload materials and past questions — published immediately</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Upload type dropdown */}
        <div>
          <label className="label">Content Type</label>
          <select className="input" value={uploadType} onChange={e => setUploadType(e.target.value)}>
            <option value="material">Course Material</option>
            <option value="past_question">Past Question</option>
          </select>
        </div>

        {/* Scope dropdown */}
        <div>
          <label className="label">Scope</label>
          <select className="input" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="specific">Institution Specific</option>
            <option value="generic">Generic (All Institutions)</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">

        {/* Institution Specific cascade */}
        {scope === 'specific' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Institution</label>
                <select className="input" value={selInst} onChange={e => setSelInst(e.target.value)}>
                  <option value="">Select institution</option>
                  {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Faculty / School</label>
                <select className="input" value={selFac} onChange={e => setSelFac(e.target.value)} disabled={!selInst}>
                  <option value="">Select faculty/school</option>
                  {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <select className="input" value={selDept} onChange={e => setSelDept(e.target.value)} disabled={!selFac}>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Level</label>
                <select className="input" value={form.level} onChange={e => setForm(f => ({...f, level: e.target.value}))}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Course — pick existing or create new */}
            <div>
              <label className="label">Course</label>
              <select className="input" value={selCourse} onChange={e => setSelCourse(e.target.value)} disabled={!selDept}>
                <option value="">— Select existing course or enter new below —</option>
                {courses.filter(c => !form.level || c.level === form.level)
                        .map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
              </select>
            </div>

            {/* New course entry — only if none selected */}
            {!selCourse && selDept && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-3">
                <p className="text-xs text-blue-700 font-medium">New course — will be created automatically on upload</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Course Code</label>
                    <input className="input" placeholder="e.g. CPE301"
                           value={form.course_code}
                           onChange={e => setForm(f => ({...f, course_code: e.target.value.toUpperCase()}))} />
                  </div>
                  <div>
                    <label className="label">Course Title</label>
                    <input className="input" placeholder="e.g. Digital Electronics"
                           value={form.course_title}
                           onChange={e => setForm(f => ({...f, course_title: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Semester</label>
                    <select className="input" value={form.semester} onChange={e => setForm(f => ({...f, semester: e.target.value}))}>
                      <option value="first">1st Semester</option>
                      <option value="second">2nd Semester</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Credit Units</label>
                    <input className="input" type="number" min="1" max="6" value={form.credit_units}
                           onChange={e => setForm(f => ({...f, credit_units: e.target.value}))} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generic scope */}
        {scope === 'generic' && (
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 border border-amber-100">
              Generic uploads search for the course by code. If found, the material is attached to all matching courses. If not found, switch to Institution Specific.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Level</label>
                <select className="input" value={form.level} onChange={e => setForm(f => ({...f, level: e.target.value}))}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Course Code</label>
                <input className="input" placeholder="e.g. CPE301"
                       value={form.course_code}
                       onChange={e => setForm(f => ({...f, course_code: e.target.value.toUpperCase()}))} />
              </div>
            </div>
          </div>
        )}

        {/* Material fields */}
        {uploadType === 'material' && (
          <>
            <div>
              <label className="label">Material Title</label>
              <input className="input" placeholder="e.g. Introduction to Computing — Lecture Note 1"
                     value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Material Type</label>
                <select className="input" value={form.material_type} onChange={e => setForm(f => ({...f, material_type: e.target.value}))}>
                  <option value="lecture_note">Lecture Note</option>
                  <option value="slide">Slide</option>
                  <option value="textbook">Textbook</option>
                  <option value="summary">Summary</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Tags (comma separated)</label>
                <input className="input" placeholder="e.g. week1, circuits"
                       value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} />
              </div>
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <textarea className="input" rows={2}
                        value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
            </div>
          </>
        )}

        {/* Past question fields */}
        {uploadType === 'past_question' && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Year</label>
              <input className="input" type="number" min="2000" max="2030"
                     value={form.year} onChange={e => setForm(f => ({...f, year: e.target.value}))} />
            </div>
            <div>
              <label className="label">Exam Type</label>
              <select className="input" value={form.exam_type} onChange={e => setForm(f => ({...f, exam_type: e.target.value}))}>
                <option value="semester">Semester</option>
                <option value="mock">Mock</option>
                <option value="carry_over">Carry Over</option>
                <option value="supplementary">Supplementary</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.has_answers}
                       onChange={e => setForm(f => ({...f, has_answers: e.target.checked}))} className="w-4 h-4" />
                <span className="text-sm text-gray-700">Has answers</span>
              </label>
            </div>
          </div>
        )}

        {/* File picker */}
        <div>
          <label className="label">File (PDF, DOC, DOCX, PPT, TXT — max 50MB)</label>
          <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                           ${file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-400'}`}
               onClick={() => document.getElementById('admin-file-input').click()}>
            <input id="admin-file-input" type="file" className="hidden"
                   accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                   onChange={e => setFile(e.target.files[0])} />
            {file ? (
              <div>
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2"/>
                <p className="text-green-700 font-medium text-sm">{file.name}</p>
                <p className="text-green-600 text-xs">{(file.size/1024/1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2"/>
                <p className="text-gray-500 text-sm">Click to select file</p>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleUpload} disabled={uploading || creating || !file}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3">
          {(uploading || creating) ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
          {creating ? 'Creating course...' : uploading ? 'Uploading...' : `Upload ${uploadType==='material'?'Material':'Past Question'}`}
        </button>
      </div>
    </div>
  );
}

// ── Add Form Modal — defined OUTSIDE InstitutionManager to prevent remount ──

// ── Add Form Modal ────────────────────────────────────────────
function AddFormModal({ showForm, setShowForm, form, setForm, onSave, saving }) {
  if (!showForm) return null;
  const { type, instType } = showForm;
  const LEVELS = ['100','200','300','400','500','600','ND1','ND2','HND1','HND2'];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-gray-900 mb-4 text-lg">
          {type === 'institution' ? 'Add Institution' :
           type === 'faculty'     ? (instType === 'university' ? 'Add Faculty' : 'Add School') :
           type === 'dept'        ? 'Add Department' : 'Add Course'}
        </h3>
        <div className="space-y-3">
          {type === 'institution' && (<>
            <div><label className="label">Full Name</label>
              <input className="input" placeholder="e.g. University of Maiduguri"
                     value={form.name||''} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
            <div><label className="label">Short Name</label>
              <input className="input" placeholder="e.g. UNIMAID"
                     value={form.short_name||''} onChange={e => setForm(f => ({...f, short_name: e.target.value}))} /></div>
            <div><label className="label">Type</label>
              <select className="input" value={form.type||'university'}
                      onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                <option value="university">University</option>
                <option value="polytechnic">Polytechnic</option>
                <option value="college">College of Education</option>
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">State</label>
                <input className="input" placeholder="e.g. Borno"
                       value={form.state||''} onChange={e => setForm(f => ({...f, state: e.target.value}))} /></div>
              <div><label className="label">City</label>
                <input className="input" placeholder="e.g. Maiduguri"
                       value={form.city||''} onChange={e => setForm(f => ({...f, city: e.target.value}))} /></div>
            </div>
          </>)}
          {(type === 'faculty' || type === 'dept') && (<>
            <div><label className="label">Name</label>
              <input className="input"
                     placeholder={type === 'faculty' ? 'e.g. Faculty of Engineering' : 'e.g. Computer Engineering'}
                     value={form.name||''} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
            <div><label className="label">Code</label>
              <input className="input" placeholder="e.g. ENG"
                     value={form.code||''} onChange={e => setForm(f => ({...f, code: e.target.value}))} /></div>
          </>)}
          {type === 'course' && (<>
            <div><label className="label">Course Title</label>
              <input className="input" placeholder="e.g. Digital Electronics"
                     value={form.title||''} onChange={e => setForm(f => ({...f, title: e.target.value}))} /></div>
            <div><label className="label">Course Code</label>
              <input className="input" placeholder="e.g. CPE301"
                     value={form.code||''} onChange={e => setForm(f => ({...f, code: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Level</label>
                <select className="input" value={form.level||'100'}
                        onChange={e => setForm(f => ({...f, level: e.target.value}))}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select></div>
              <div><label className="label">Semester</label>
                <select className="input" value={form.semester||'first'}
                        onChange={e => setForm(f => ({...f, semester: e.target.value}))}>
                  <option value="first">1st Semester</option>
                  <option value="second">2nd Semester</option>
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Credit Units</label>
                <input className="input" type="number" min="1" max="6"
                       value={form.credit_units||3}
                       onChange={e => setForm(f => ({...f, credit_units: e.target.value}))} /></div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_compulsory!==false}
                         onChange={e => setForm(f => ({...f, is_compulsory: e.target.checked}))}
                         className="w-4 h-4" />
                  <span className="text-sm">Compulsory</span>
                </label>
              </div>
            </div>
          </>)}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onSave} disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin"/>} Save
          </button>
          <button onClick={() => { setShowForm(null); setForm({}); }}
                  className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    </div>
  );
}


function InstitutionManager() {
  const [institutions, setInstitutions] = useState([]);
  const [expanded, setExpanded]         = useState({});
  const [faculties, setFaculties]       = useState({});
  const [departments, setDepartments]   = useState({});
  const [courses, setCourses]           = useState({});
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(null);
  const [form, setForm]                 = useState({});
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    api.get('/manage/institutions')
      .then(r => setInstitutions(r.data.data))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const getInstType = (facId) => {
    for (const inst of institutions) {
      if ((faculties[inst.id]||[]).some(f => f.id === facId)) return inst.type;
    }
    return 'university';
  };

  const toggle = async (type, id, extra) => {
    const key = `${type}-${id}`;
    if (expanded[key]) { setExpanded(p => ({...p, [key]: false})); return; }
    setExpanded(p => ({...p, [key]: true}));
    try {
      if (type === 'institution') {
        const instType = extra;
        const ep = instType==='university' ? `/manage/institutions/${id}/faculties` : `/manage/institutions/${id}/schools`;
        const r = await api.get(ep);
        setFaculties(p => ({...p, [id]: r.data.data}));
      } else if (type === 'faculty') {
        const instType = getInstType(id);
        const ep = instType==='university' ? `/manage/faculties/${id}/departments` : `/manage/schools/${id}/departments`;
        const r = await api.get(ep);
        setDepartments(p => ({...p, [id]: r.data.data}));
      } else if (type === 'dept') {
        const r = await api.get(`/manage/departments/${id}/courses`);
        setCourses(p => ({...p, [id]: r.data.data}));
      }
    } catch { toast.error('Failed to load'); }
  };

  const save = async () => {
    if (!showForm) return;
    setSaving(true);
    try {
      const { type, parentId, instType } = showForm;
      if (type === 'institution') {
        const r = await api.post('/manage/institutions', form);
        setInstitutions(p => [...p, r.data.data]);
      } else if (type === 'faculty') {
        const ep = instType==='university'
          ? `/manage/institutions/${parentId}/faculties`
          : `/manage/institutions/${parentId}/schools`;
        const r = await api.post(ep, form);
        setFaculties(p => ({...p, [parentId]: [...(p[parentId]||[]), r.data.data]}));
      } else if (type === 'dept') {
        const iType = getInstType(parentId);
        const ep = iType==='university'
          ? `/manage/faculties/${parentId}/departments`
          : `/manage/schools/${parentId}/departments`;
        const r = await api.post(ep, form);
        setDepartments(p => ({...p, [parentId]: [...(p[parentId]||[]), r.data.data]}));
      } else if (type === 'course') {
        const r = await api.post(`/manage/departments/${parentId}/courses`, form);
        setCourses(p => ({...p, [parentId]: [...(p[parentId]||[]), r.data.data]}));
      }
      toast.success('Created successfully');
      setShowForm(null);
      setForm({});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const del = async (type, id, parentId) => {
    if (!confirm(`Delete this ${type}? All nested items will be removed.`)) return;
    try {
      await api.delete(`/manage/${type}s/${id}`);
      if (type==='institution') setInstitutions(p=>p.filter(i=>i.id!==id));
      else if (type==='faculty') setFaculties(p=>({...p,[parentId]:(p[parentId]||[]).filter(f=>f.id!==id)}));
      else if (type==='department') setDepartments(p=>({...p,[parentId]:(p[parentId]||[]).filter(d=>d.id!==id)}));
      else if (type==='course') setCourses(p=>({...p,[parentId]:(p[parentId]||[]).filter(c=>c.id!==id)}));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;

  return (
    <div className="space-y-6">
      {/* Modal lives OUTSIDE the tree — no remount on state change */}
      <AddFormModal
        showForm={showForm} setShowForm={setShowForm}
        form={form} setForm={setForm}
        onSave={save} saving={saving}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Institution Manager</h2>
          <p className="text-gray-500 text-sm mt-1">{institutions.length} institutions</p>
        </div>
        <button onClick={() => { setForm({}); setShowForm({ type:'institution' }); }}
                className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4"/> Add Institution
        </button>
      </div>

      <div className="space-y-3">
        {institutions.map(inst => (
          <div key={inst.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 cursor-pointer"
                 onClick={() => toggle('institution', inst.id, inst.type)}>
              <div className="flex items-center gap-3">
                {expanded[`institution-${inst.id}`]
                  ? <ChevronDown className="w-4 h-4 text-gray-400"/>
                  : <ChevronRight className="w-4 h-4 text-gray-400"/>}
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-blue-600"/>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{inst.name}</p>
                  <p className="text-xs text-gray-400">{inst.short_name} · {inst.type} · {inst.faculty_count} faculties/schools</p>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setForm({}); setShowForm({type:'faculty', parentId:inst.id, instType:inst.type}); }}
                        className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                  + {inst.type==='university' ? 'Faculty' : 'School'}
                </button>
                <button onClick={() => del('institution', inst.id, null)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>

            {expanded[`institution-${inst.id}`] && (
              <div className="border-t border-gray-100">
                {!(faculties[inst.id]||[]).length
                  ? <p className="text-gray-400 text-sm px-14 py-3">No faculties/schools yet</p>
                  : (faculties[inst.id]||[]).map(fac => (
                  <div key={fac.id}>
                    <div className="flex items-center justify-between px-14 py-3
                                    hover:bg-gray-50 cursor-pointer border-b border-gray-50"
                         onClick={() => toggle('faculty', fac.id)}>
                      <div className="flex items-center gap-2">
                        {expanded[`faculty-${fac.id}`]
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400"/>
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400"/>}
                        <FolderOpen className="w-4 h-4 text-purple-500"/>
                        <span className="text-sm font-medium text-gray-800">{fac.name}</span>
                        <span className="text-xs text-gray-400">({fac.code}) · {fac.dept_count} depts</span>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setForm({}); setShowForm({type:'dept', parentId:fac.id, instType:inst.type}); }}
                                className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded-lg">+ Dept</button>
                        <button onClick={() => del('faculty', fac.id, inst.id)}
                                className="p-1 text-gray-300 hover:text-red-500 rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </div>

                    {expanded[`faculty-${fac.id}`] && (
                      <div className="bg-gray-50">
                        {!(departments[fac.id]||[]).length
                          ? <p className="text-gray-400 text-xs px-20 py-2">No departments yet</p>
                          : (departments[fac.id]||[]).map(dept => (
                          <div key={dept.id}>
                            <div className="flex items-center justify-between px-20 py-2.5
                                            hover:bg-gray-100 cursor-pointer"
                                 onClick={() => toggle('dept', dept.id)}>
                              <div className="flex items-center gap-2">
                                {expanded[`dept-${dept.id}`]
                                  ? <ChevronDown className="w-3 h-3 text-gray-400"/>
                                  : <ChevronRight className="w-3 h-3 text-gray-400"/>}
                                <BookOpen className="w-3.5 h-3.5 text-green-600"/>
                                <span className="text-xs font-medium text-gray-700">{dept.name}</span>
                                <span className="text-xs text-gray-400">({dept.code}) · {dept.course_count} courses</span>
                              </div>
                              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { setForm({}); setShowForm({type:'course', parentId:dept.id}); }}
                                        className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-lg">+ Course</button>
                                <button onClick={() => del('department', dept.id, fac.id)}
                                        className="p-1 text-gray-300 hover:text-red-500 rounded-lg"><Trash2 className="w-3 h-3"/></button>
                              </div>
                            </div>

                            {expanded[`dept-${dept.id}`] && (
                              <div className="px-24 py-2 space-y-1">
                                {!(courses[dept.id]||[]).length
                                  ? <p className="text-gray-400 text-xs py-1">No courses yet</p>
                                  : (courses[dept.id]||[]).map(course => (
                                  <div key={course.id} className="flex items-center justify-between py-1.5 px-3
                                                                   bg-white rounded-lg border border-gray-100">
                                    <div>
                                      <span className="text-xs font-bold text-blue-600 mr-2">{course.code}</span>
                                      <span className="text-xs text-gray-700">{course.title}</span>
                                      <span className="text-xs text-gray-400 ml-2">{course.level} · {course.semester} · {course.credit_units}u</span>
                                    </div>
                                    <button onClick={() => del('course', course.id, dept.id)}
                                            className="p-1 text-gray-300 hover:text-red-500 rounded-lg"><Trash2 className="w-3 h-3"/></button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Users ─────────────────────────────────────────────────────
function UsersTab({ isSuperAdmin }) {
  const [users,setUsers]=useState([]);const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');const [roleFilter,setRoleFilter]=useState('student');
  const [pagination,setPagination]=useState(null);const [page,setPage]=useState(1);
  const load=()=>{setLoading(true);const p=new URLSearchParams({page,limit:15});if(roleFilter)p.append('role',roleFilter);if(search)p.append('search',search);
    api.get(`/admin/users?${p}`).then(r=>{setUsers(r.data.data.users);setPagination(r.data.data.pagination);}).catch(()=>toast.error('Failed')).finally(()=>setLoading(false));};
  useEffect(()=>{load();},[roleFilter,page]);
  const changeRole=async(id,role)=>{try{await api.patch(`/admin/users/${id}/role`,{role});toast.success('Updated');load();}catch(e){toast.error(e.response?.data?.message||'Failed');}};
  const deleteUser=async(id,name)=>{if(!confirm(`Delete ${name}?`))return;try{await api.delete(`/admin/users/${id}`);toast.success('Deleted');load();}catch(e){toast.error(e.response?.data?.message||'Failed');}};
  const RC={student:'bg-blue-100 text-blue-700',tutor:'bg-purple-100 text-purple-700',lecturer:'bg-green-100 text-green-700',admin:'bg-orange-100 text-orange-700',super_admin:'bg-yellow-100 text-yellow-700'};
  return(
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold text-gray-900">Users</h2><p className="text-gray-500 text-sm mt-1">{pagination?.total??0} total</p></div>
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {['student','tutor','lecturer','admin'].map(r=>(
            <button key={r} onClick={()=>{setRoleFilter(r);setPage(1);}}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${roleFilter===r?'bg-white text-blue-600 shadow-sm':'text-gray-500'}`}>{r}</button>
          ))}
        </div>
        <input className="input flex-1 min-w-[200px] text-sm py-2" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}/>
        <button onClick={load} className="btn-primary text-sm px-4 py-2">Search</button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading?<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600"/></div>:(
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['User','Institution','Role','Joined'].map(h=><th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                  {isSuperAdmin&&<th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u=>(
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3"><p className="font-medium text-gray-900">{u.full_name}</p><p className="text-xs text-gray-400">{u.email}</p></td>
                    <td className="px-5 py-3 text-xs text-gray-500">{u.short_name||'—'}{u.level&&<span className="ml-1">· {u.level}</span>}</td>
                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RC[u.role]||'bg-gray-100 text-gray-600'}`}>{u.role}</span></td>
                    <td className="px-5 py-3 text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    {isSuperAdmin&&<td className="px-5 py-3"><div className="flex items-center gap-2">
                      {u.role!=='super_admin'&&<select value={u.role} onChange={e=>changeRole(u.id,e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none">
                        <option value="student">student</option><option value="tutor">tutor</option><option value="lecturer">lecturer</option><option value="admin">admin</option></select>}
                      {u.role!=='super_admin'&&<button onClick={()=>deleteUser(u.id,u.full_name)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>}
                    </div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination?.pages>1&&<div className="flex items-center justify-between px-5 py-3 border-t">
          <p className="text-xs text-gray-400">Page {page} of {pagination.pages}</p>
          <div className="flex gap-2">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40">Prev</button>
            <button onClick={()=>setPage(p=>Math.min(pagination.pages,p+1))} disabled={page===pagination.pages} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40">Next</button>
          </div>
        </div>}
      </div>
    </div>
  );
}

// ── Manage Admins ─────────────────────────────────────────────
function ManageAdmins({ isSuperAdmin }) {
  const [admins,setAdmins]=useState([]);const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);const [form,setForm]=useState({full_name:'',email:'',password:'',role:'admin'});const [creating,setCreating]=useState(false);
  const load=()=>{setLoading(true);api.get('/admin/users?role=admin').then(r=>setAdmins(r.data.data.users)).catch(()=>{}).finally(()=>setLoading(false));};
  useEffect(()=>{load();},[]);
  const createAdmin=async()=>{if(!form.full_name||!form.email||!form.password){toast.error('All fields required');return;}setCreating(true);
    try{await api.post('/admin/users',form);toast.success('Admin created');setShowForm(false);setForm({full_name:'',email:'',password:'',role:'admin'});load();}
    catch(e){toast.error(e.response?.data?.message||'Failed');}finally{setCreating(false);}};
  if(!isSuperAdmin)return(<div className="text-center py-20"><Shield className="w-12 h-12 text-gray-300 mx-auto mb-3"/><p className="text-gray-500">Super Admin only</p></div>);
  return(
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-900">Manage Admins</h2><p className="text-gray-500 text-sm mt-1">Create admin accounts</p></div>
        <button onClick={()=>setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm"><UserPlus className="w-4 h-4"/>New Admin</button>
      </div>
      {showForm&&(
        <div className="bg-white rounded-2xl border border-blue-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Create Admin</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Full Name</label><input className="input" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
            <div><label className="label">Password</label><input className="input" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div>
            <div><label className="label">Role</label><select className="input" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="admin">Admin</option><option value="lecturer">Lecturer</option></select></div>
          </div>
          <div className="flex gap-3"><button onClick={createAdmin} disabled={creating} className="btn-primary flex items-center gap-2 text-sm">{creating&&<Loader2 className="w-4 h-4 animate-spin"/>}Create</button>
            <button onClick={()=>setShowForm(false)} className="btn-secondary text-sm">Cancel</button></div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Admin Accounts</h3><span className="text-xs text-gray-400">{admins.length}</span>
        </div>
        {loading?<div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin"/></div>
          :admins.length===0?<p className="text-center text-gray-400 py-10 text-sm">No admins yet</p>
          :admins.map(a=>(
          <div key={a.id} className="px-5 py-4 flex items-center justify-between border-b last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center font-bold text-orange-600 text-sm">{a.full_name?.charAt(0)}</div>
              <div><p className="font-medium text-gray-900 text-sm">{a.full_name}</p><p className="text-xs text-gray-400">{a.email}</p></div>
            </div>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{a.role}</span>
          </div>
        ))}
      </div>
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200 p-5">
        <div className="flex items-center gap-2 mb-3"><Crown className="w-5 h-5 text-yellow-600"/><h3 className="font-semibold">Super Admins</h3></div>
        {[{name:'Usman Waziri',email:'usmawaziri555@gmail.com'},{name:'Abdulazeez Mohammed',email:'omomohmuhammed@gmail.com'}].map(sa=>(
          <div key={sa.email} className="flex items-center gap-3 bg-white rounded-xl p-3 mb-2 last:mb-0">
            <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center font-bold text-white text-sm">{sa.name.charAt(0)}</div>
            <div><p className="font-medium text-gray-900 text-sm">{sa.name}</p><p className="text-xs text-gray-400">{sa.email}</p></div>
            <Crown className="w-4 h-4 text-yellow-500 ml-auto"/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function AdminPage() {
  const router=useRouter();const {user,loading:authLoading,logout}=useAuth();
  const [tab,setTab]=useState('overview');const [stats,setStats]=useState(null);
  const [activity,setActivity]=useState([]);const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!authLoading&&!user){router.push('/login');return;}
    if(!authLoading&&user&&!['admin','super_admin'].includes(user.role))router.push('/dashboard');
  },[user,authLoading]);

  useEffect(()=>{
    if(!user)return;
    Promise.all([api.get('/admin/stats'),api.get('/admin/activity')])
      .then(([s,a])=>{setStats(s.data.data);setActivity(a.data.data);})
      .catch(()=>{}).finally(()=>setLoading(false));
  },[user]);

  if(authLoading||loading)return(<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>);
  if(!user||!['admin','super_admin'].includes(user.role))return null;
  const isSuperAdmin=user.role==='super_admin';

  return(
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar active={tab} setActive={setTab} user={user} logout={logout}/>
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Admin</span><ChevronRight className="w-4 h-4"/>
              <span className="text-gray-900 font-medium capitalize">{tab.replace('_',' ')}</span>
            </div>
            <div className="flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500"/>
              <span className="text-sm text-gray-600 font-medium">{user.full_name}</span></div>
          </div>
        </div>
        <div className="p-8">
          {tab==='overview'     && <Overview stats={stats} activity={activity}/>}
          {tab==='content'      && <ContentApproval/>}
          {tab==='upload'       && <UploadContent/>}
          {tab==='institutions' && <InstitutionManager/>}
          {tab==='users'        && <UsersTab isSuperAdmin={isSuperAdmin}/>}
          {tab==='admins'       && <ManageAdmins isSuperAdmin={isSuperAdmin}/>}
        </div>
      </main>
    </div>
  );
}
