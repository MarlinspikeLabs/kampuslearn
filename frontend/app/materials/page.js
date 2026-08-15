'use client';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  FileText, Download, Search, BookOpen,
  Star, Eye, Loader2, Filter, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_LABELS = {
  lecture_note: 'Lecture Note',
  textbook:     'Textbook',
  slide:        'Slide',
  summary:      'Summary',
  other:        'Other',
};

const TYPE_COLORS = {
  lecture_note: 'bg-blue-100 text-blue-700',
  textbook:     'bg-purple-100 text-purple-700',
  slide:        'bg-orange-100 text-orange-700',
  summary:      'bg-green-100 text-green-700',
  other:        'bg-gray-100 text-gray-600',
};

function MaterialCard({ mat, onDownload, onRead }) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center
                          justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">{mat.title}</p>
              {mat.is_featured && (
                <span className="flex items-center gap-1 text-xs text-yellow-600
                                 bg-yellow-50 px-2 py-0.5 rounded-full flex-shrink-0">
                  <Star className="w-3 h-3" /> Featured
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {mat.course_code} — {mat.course_title}
            </p>
            {mat.description && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{mat.description}</p>
            )}
            <div className="flex items-center flex-wrap gap-3 mt-2 text-xs text-gray-400">
              <span className={`px-2 py-0.5 rounded-full font-medium
                ${TYPE_COLORS[mat.material_type] || TYPE_COLORS.other}`}>
                {TYPE_LABELS[mat.material_type] || mat.material_type}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {mat.view_count} views
              </span>
              <span className="flex items-center gap-1">
                <Download className="w-3.5 h-3.5" />
                {mat.download_count} downloads
              </span>
              {mat.file_size_kb > 0 && (
                <span>{mat.file_size_kb < 1024
                  ? `${mat.file_size_kb} KB`
                  : `${(mat.file_size_kb / 1024).toFixed(1)} MB`}
                </span>
              )}
            </div>
            {mat.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {mat.tags.map(tag => (
                  <span key={tag}
                        className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={() => onDownload(mat)}
                className="flex items-center gap-1.5 bg-blue-600 text-white text-xs
                           font-medium px-3 py-2 rounded-lg hover:bg-blue-700
                           transition-colors flex-shrink-0">
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
      </div>
    </div>
  );
}

export default function MaterialsPage() {
  const { profile } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [courses, setCourses]   = useState([]);
  const [page, setPage]         = useState(1);
  const [pagination, setPagination] = useState(null);
  const LIMIT = 12;

  useEffect(() => {
    if (profile?.department_id) {
      api.get(`/institutions/departments/${profile.department_id}/courses?level=${profile.level}`)
        .then(r => setCourses(r.data.data))
        .catch(() => {});
    }
  }, [profile]);

  useEffect(() => {
    fetchMaterials();
  }, [courseFilter, typeFilter, page]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (courseFilter) params.append('course_id', courseFilter);
      if (typeFilter)   params.append('type', typeFilter);
      if (search)       params.append('search', search);
      const res = await api.get(`/materials?${params}`);
      setMaterials(res.data.data.materials);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchMaterials();
  };

  const handleRead = async (mat) => {
    try {
      const res = await api.get(`/materials/${mat.id}/read`);
      const base = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '');
      const url = `${base}${res.data.data.file_url}`;
      window.open(url, '_blank');
    } catch (err) {
      toast.error('Failed to open material');
    }
  };

  const handleDownload = async (mat) => {
    try {
      const res = await api.get(`/materials/${mat.id}/download`);
      const data = res.data.data;
      const base = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '');
      const url = `${base}${data.file_url}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = data.file_name || 'material';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloaded! ${data.kp_spent} KP spent. Balance: ${data.balance_after} KP`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Download failed';
      if (err.response?.status === 402) {
        toast.error(msg, { duration: 5000 });
      } else {
        toast.error(msg);
      }
    }
  };

  const totalPages = pagination?.pages || 1;

  return (
    <AppLayout title="Course Materials">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Course Materials</h2>
            <p className="text-gray-500 text-sm mt-1">
              Lecture notes, slides, textbooks and summaries
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-10 pr-24" placeholder="Search materials..."
                   value={search} onChange={e => setSearch(e.target.value)} />
            <button type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white
                               text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700">
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-3">
            <select className="input flex-1 min-w-[180px]" value={courseFilter}
                    onChange={e => { setCourseFilter(e.target.value); setPage(1); }}>
              <option value="">All courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>

            <select className="input flex-1 min-w-[140px]" value={typeFilter}
                    onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {(courseFilter || typeFilter || search) && (
              <button onClick={() => {
                setCourseFilter(''); setTypeFilter(''); setSearch(''); setPage(1);
                setTimeout(fetchMaterials, 0);
              }} className="text-sm text-red-500 hover:text-red-700 px-3 py-2 flex-shrink-0">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Count */}
        <p className="text-sm text-gray-500">
          {loading ? 'Loading...' : `${pagination?.total ?? 0} material${pagination?.total !== 1 ? 's' : ''} found`}
        </p>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No materials found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {materials.map(mat => (
              <MaterialCard key={mat.id} mat={mat} onDownload={handleDownload} onRead={handleRead} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg
                               hover:bg-gray-50 disabled:opacity-40 transition-colors">
              Previous
            </button>
            <span className="text-sm text-gray-500 px-2">
              Page {page} of {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg
                               hover:bg-gray-50 disabled:opacity-40 transition-colors">
              Next
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
