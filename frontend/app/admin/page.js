'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Users, BookOpen, FileText, Brain, BarChart3,
  CheckCircle, XCircle, Shield, Crown, Loader2,
  UserPlus, Clock, TrendingUp, AlertTriangle,
  ChevronRight, Eye, Trash2, GraduationCap, LogOut
} from 'lucide-react';

// ── Sidebar nav ───────────────────────────────────────────────
const NAV = [
  { id: 'overview',  icon: BarChart3,  label: 'Overview'        },
  { id: 'content',   icon: FileText,   label: 'Content Approval' },
  { id: 'users',     icon: Users,      label: 'Users'            },
  { id: 'admins',    icon: Shield,     label: 'Manage Admins'    },
];

function Sidebar({ active, setActive, user, logout }) {
  return (
    <aside className="w-64 bg-gray-950 text-white flex flex-col flex-shrink-0 h-screen">
      {/* Logo */}
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
        {/* Admin badge */}
        <div className="flex items-center gap-2 bg-gray-900 rounded-xl p-3">
          <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-orange-500
                          rounded-full flex items-center justify-center font-bold text-sm text-white">
            {user?.full_name?.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Crown className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-yellow-400 font-medium">Super Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
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

      {/* Footer */}
      <div className="p-3 border-t border-gray-800">
        <a href="/dashboard"
           className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                      text-gray-400 hover:bg-gray-900 hover:text-white transition-colors">
          <GraduationCap className="w-5 h-5" />
          Student View
        </a>
        <button onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                           text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors mt-1">
          <LogOut className="w-5 h-5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, alert }) {
  return (
    <div className={`bg-white rounded-2xl p-5 border ${alert ? 'border-amber-200 bg-amber-50' : 'border-gray-100'} shadow-sm`}>
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

// ── Overview tab ──────────────────────────────────────────────
function Overview({ stats, activity }) {
  if (!stats) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Platform Overview</h2>
        <p className="text-gray-500 text-sm">Live stats across all institutions</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}     label="Students"       value={stats.students}        color="bg-blue-100 text-blue-600"   sub={`+${stats.new_users_week} this week`} />
        <StatCard icon={BookOpen}  label="Courses"        value={stats.courses}         color="bg-purple-100 text-purple-600" />
        <StatCard icon={BarChart3} label="Exam Attempts"  value={stats.total_attempts}  color="bg-green-100 text-green-600" />
        <StatCard icon={Brain}     label="AI Chats"       value={stats.ai_conversations} color="bg-orange-100 text-orange-600" sub={`${stats.total_tokens} tokens used`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}      label="Materials"       value={stats.total_materials}  color="bg-cyan-100 text-cyan-600" />
        <StatCard icon={FileText}      label="Past Questions"  value={stats.total_pqs}         color="bg-indigo-100 text-indigo-600" />
        <StatCard icon={Crown}         label="Premium Users"   value={stats.premium_users}     color="bg-yellow-100 text-yellow-600" />
        <StatCard icon={AlertTriangle} label="Pending Review"
          value={parseInt(stats.pending_materials) + parseInt(stats.pending_pqs)}
          color="bg-amber-100 text-amber-600"
          alert={parseInt(stats.pending_materials) + parseInt(stats.pending_pqs) > 0}
          sub="Materials + Past Qs" />
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {activity.length === 0
            ? <p className="text-center text-gray-400 py-8 text-sm">No activity yet</p>
            : activity.slice(0, 8).map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{a.event}</span>
                    <span className="text-sm text-gray-500"> — {a.actor}</span>
                    {a.detail && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{a.detail}</p>}
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(a.time).toLocaleDateString()}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Content approval tab ──────────────────────────────────────
function ContentApproval({ onRefresh }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/admin/content/pending')
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const approve = async (type, id) => {
    try {
      await api.patch(`/admin/content/${type}/${id}/approve`);
      toast.success('Content approved and published');
      load();
    } catch { toast.error('Approval failed'); }
  };

  const reject = async (type, id) => {
    if (!confirm('Reject and delete this content?')) return;
    try {
      await api.patch(`/admin/content/${type}/${id}/reject`);
      toast.success('Content rejected');
      load();
    } catch { toast.error('Rejection failed'); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  const total = (data?.materials?.length || 0) + (data?.past_questions?.length || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Content Approval</h2>
          <p className="text-gray-500 text-sm mt-1">
            {total === 0 ? 'All content is up to date' : `${total} item${total !== 1 ? 's' : ''} awaiting review`}
          </p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">Refresh</button>
      </div>

      {total === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">All clear! Nothing to review.</p>
        </div>
      ) : (
        <>
          {/* Materials */}
          {data.materials.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">
                  Course Materials ({data.materials.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.materials.map(m => (
                  <div key={m.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{m.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.course_code} · {m.material_type} · by {m.uploader}
                      </p>
                      <p className="text-xs text-gray-400">
                        {m.file_size_kb > 0 ? `${m.file_size_kb} KB · ` : ''}{new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => approve('material', m.id)}
                              className="flex items-center gap-1.5 bg-green-600 text-white
                                         text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700">
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => reject('material', m.id)}
                              className="flex items-center gap-1.5 bg-red-50 text-red-600
                                         text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-100">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past Questions */}
          {data.past_questions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">
                  Past Questions ({data.past_questions.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.past_questions.map(pq => (
                  <div key={pq.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {pq.course_code} — {pq.title} {pq.exam_type} Exam
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {pq.course_title} · uploaded by {pq.uploader}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => approve('past_question', pq.id)}
                              className="flex items-center gap-1.5 bg-green-600 text-white
                                         text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700">
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => reject('past_question', pq.id)}
                              className="flex items-center gap-1.5 bg-red-50 text-red-600
                                         text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-100">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────
function UsersTab({ isSuperAdmin }) {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('student');
  const [pagination, setPagination] = useState(null);
  const [page, setPage]     = useState(1);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 15 });
    if (roleFilter) params.append('role', roleFilter);
    if (search) params.append('search', search);
    api.get(`/admin/users?${params}`)
      .then(r => { setUsers(r.data.data.users); setPagination(r.data.data.pagination); })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [roleFilter, page]);

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      toast.success('Role updated');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const deleteUser = async (id, name) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('User deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const ROLE_COLORS = {
    student:     'bg-blue-100 text-blue-700',
    tutor:       'bg-purple-100 text-purple-700',
    lecturer:    'bg-green-100 text-green-700',
    admin:       'bg-orange-100 text-orange-700',
    super_admin: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Users</h2>
        <p className="text-gray-500 text-sm mt-1">
          {pagination?.total ?? 0} total users
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {['student','tutor','lecturer','admin'].map(r => (
            <button key={r} onClick={() => { setRoleFilter(r); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors
                      ${roleFilter === r ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
              {r}
            </button>
          ))}
        </div>
        <input className="input flex-1 min-w-[200px] text-sm py-2"
               placeholder="Search name or email..."
               value={search}
               onChange={e => setSearch(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && load()} />
        <button onClick={load} className="btn-primary text-sm px-4 py-2">Search</button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : users.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No users found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Institution</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
                  {isSuperAdmin && <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{u.full_name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {u.short_name || '—'}
                      {u.level && <span className="ml-1 text-gray-400">· {u.level}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {u.role !== 'super_admin' && (
                            <select
                              value={u.role}
                              onChange={e => changeRole(u.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1
                                         focus:outline-none focus:ring-1 focus:ring-blue-500">
                              <option value="student">student</option>
                              <option value="tutor">tutor</option>
                              <option value="lecturer">lecturer</option>
                              <option value="admin">admin</option>
                            </select>
                          )}
                          {u.role !== 'super_admin' && (
                            <button onClick={() => deleteUser(u.id, u.full_name)}
                                    className="p-1.5 text-gray-400 hover:text-red-500
                                               hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Page {page} of {pagination.pages} · {pagination.total} users
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                      className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Prev
              </button>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p+1))} disabled={page === pagination.pages}
                      className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manage Admins tab (super_admin only) ──────────────────────
function ManageAdmins({ isSuperAdmin }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name:'', email:'', password:'', role:'admin' });
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/admin/users?role=admin')
      .then(r => setAdmins(r.data.data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createAdmin = async () => {
    if (!form.full_name || !form.email || !form.password) {
      toast.error('All fields required'); return;
    }
    setCreating(true);
    try {
      await api.post('/admin/users', form);
      toast.success(`${form.role} account created`);
      setShowForm(false);
      setForm({ full_name:'', email:'', password:'', role:'admin' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setCreating(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Super Admin access only</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manage Admins</h2>
          <p className="text-gray-500 text-sm mt-1">Create and manage admin accounts</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
                className="btn-primary flex items-center gap-2 text-sm">
          <UserPlus className="w-4 h-4" />
          New Admin
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Create New Admin Account</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" placeholder="e.g. Ibrahim Musa"
                     value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="admin@example.com"
                     value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="Minimum 8 characters"
                     value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role}
                      onChange={e => setForm({...form, role: e.target.value})}>
                <option value="admin">Admin — can approve content</option>
                <option value="lecturer">Lecturer — can upload content</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createAdmin} disabled={creating}
                    className="btn-primary flex items-center gap-2 text-sm">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Account
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Admin list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Admin Accounts</h3>
          <span className="text-xs text-gray-400">{admins.length} admins</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : admins.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">No admin accounts yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {admins.map(a => (
              <div key={a.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center
                                  justify-center font-bold text-orange-600 text-sm">
                    {a.full_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{a.full_name}</p>
                    <p className="text-xs text-gray-400">{a.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    {a.role}
                  </span>
                  <p className="text-xs text-gray-400">
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Super admins (read-only) */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl
                      border border-yellow-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-5 h-5 text-yellow-600" />
          <h3 className="font-semibold text-gray-900">Super Admins</h3>
          <span className="text-xs text-gray-500">(cannot be modified)</span>
        </div>
        <div className="space-y-3">
          {[
            { name: 'Usman Waziri',        email: 'usmawaziri555@gmail.com' },
            { name: 'Abdulazeez Mohammed', email: 'omomohmuhammed@gmail.com' },
          ].map(sa => (
            <div key={sa.email} className="flex items-center gap-3 bg-white rounded-xl p-3">
              <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-orange-500
                              rounded-full flex items-center justify-center font-bold text-white text-sm">
                {sa.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{sa.name}</p>
                <p className="text-xs text-gray-400">{sa.email}</p>
              </div>
              <Crown className="w-4 h-4 text-yellow-500 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────
export default function AdminPage() {
  const router   = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [tab, setTab]         = useState('overview');
  const [stats, setStats]     = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && user && !['admin','super_admin'].includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/activity'),
    ]).then(([s, a]) => {
      setStats(s.data.data);
      setActivity(a.data.data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || !['admin','super_admin'].includes(user.role)) return null;

  const isSuperAdmin = user.role === 'super_admin';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar active={tab} setActive={setTab} user={user} logout={logout} />

      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Admin</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900 font-medium capitalize">{tab}</span>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-gray-600 font-medium">{user.full_name}</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          {tab === 'overview' && <Overview stats={stats} activity={activity} />}
          {tab === 'content'  && <ContentApproval />}
          {tab === 'users'    && <UsersTab isSuperAdmin={isSuperAdmin} />}
          {tab === 'admins'   && <ManageAdmins isSuperAdmin={isSuperAdmin} />}
        </div>
      </main>
    </div>
  );
}
