'use client';
import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  FileText, Download, Search, Filter,
  ChevronDown, BookOpen, Calendar, Eye,
  CheckCircle, XCircle, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

function PQCard({ pq, onDownload }) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {pq.course_code} — {pq.year} {pq.exam_type.replace('_', ' ')} Exam
            </p>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{pq.course_title}</p>
            <div className="flex items-center flex-wrap gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {pq.year}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {pq.download_count} downloads
              </span>
              {pq.question_count > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {pq.question_count} questions digitized
                </span>
              )}
              <span className={`flex items-center gap-1 ${pq.has_answers ? 'text-green-600' : 'text-gray-400'}`}>
                {pq.has_answers
                  ? <><CheckCircle className="w-3.5 h-3.5" /> With answers</>
                  : <><XCircle className="w-3.5 h-3.5" /> No answers</>}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {pq.file_url && (
            <button onClick={() => onDownload(pq)}
                    className="flex items-center gap-1.5 bg-purple-600 text-white text-xs
                               font-medium px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          )}
          {pq.question_count > 0 && (
            <a href={`/exams?course_id=${pq.course_id}`}
               className="flex items-center gap-1.5 bg-white border border-purple-200 text-purple-600
                          text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors">
              <BookOpen className="w-3.5 h-3.5" />
              Practice
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PastQuestionsPage() {
  const latestListRequest = useRef(0);
  const { profile } = useAuth();
  const [pqs, setPqs]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [courses, setCourses]   = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [years, setYears]       = useState([]);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);

  const LIMIT = 12;

  useEffect(() => {
    if (profile?.department_id) {
      api.get(`/institutions/departments/${profile.department_id}/courses?level=${profile.level}`)
        .then(r => {
          setCourses(r.data.data);
          const requested = new URLSearchParams(window.location.search).get('course_id');
          if (requested && r.data.data.some(c => c.id === requested)) setCourseFilter(requested);
        })
        .catch(() => {});
    }
  }, [profile]);

  useEffect(() => {
    if (courseFilter) {
      api.get(`/past-questions/course/${courseFilter}/years`)
        .then(r => setYears(r.data.data))
        .catch(() => {});
    } else {
      setYears([]);
    }
  }, [courseFilter]);

  useEffect(() => {
    fetchPQs();
  }, [courseFilter, yearFilter, typeFilter, page]);

  const fetchPQs = async () => {
    const request = ++latestListRequest.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (courseFilter) params.append('course_id', courseFilter);
      if (yearFilter)   params.append('year', yearFilter);
      if (typeFilter)   params.append('exam_type', typeFilter);
      const res = await api.get(`/past-questions?${params}`);
      if (request !== latestListRequest.current) return;
      setPqs(res.data.data.past_questions);
      setTotal(res.data.data.pagination.total);
    } catch {
      if (request === latestListRequest.current) toast.error('Failed to load past questions');
    } finally {
      if (request === latestListRequest.current) setLoading(false);
    }
  };

  const handleDownload = async (pq) => {
    try {
      const res = await api.get(`/past-questions/${pq.id}/download`);
      const fileUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${res.data.data.file_url}`;
      window.open(fileUrl, '_blank');
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    }
  };

  const filtered = pqs.filter(pq =>
    !search ||
    pq.course_title?.toLowerCase().includes(search.toLowerCase()) ||
    pq.course_code?.toLowerCase().includes(search.toLowerCase()) ||
    String(pq.year).includes(search)
  );

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AppLayout title="Past Questions">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">Past Questions</h2>
          <p className="text-gray-500 text-sm mt-1">
            Browse exam papers by course, year, and type
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Search by course name or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-3">
            {/* Course filter */}
            <select className="input flex-1 min-w-[180px]" value={courseFilter}
                    onChange={e => { setCourseFilter(e.target.value); setYearFilter(''); setPage(1); }}>
              <option value="">All courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>

            {/* Year filter */}
            <select className="input flex-1 min-w-[120px]" value={yearFilter}
                    onChange={e => { setYearFilter(e.target.value); setPage(1); }}
                    disabled={!courseFilter}>
              <option value="">All years</option>
              {years.map(y => (
                <option key={y.year} value={y.year}>{y.year}</option>
              ))}
            </select>

            {/* Type filter */}
            <select className="input flex-1 min-w-[140px]" value={typeFilter}
                    onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              <option value="semester">Semester</option>
              <option value="mock">Mock</option>
              <option value="carry_over">Carry Over</option>
              <option value="supplementary">Supplementary</option>
            </select>

            {/* Clear filters */}
            {(courseFilter || yearFilter || typeFilter || search) && (
              <button
                onClick={() => { setCourseFilter(''); setYearFilter(''); setTypeFilter(''); setSearch(''); setPage(1); }}
                className="text-sm text-red-500 hover:text-red-700 px-3 py-2 flex-shrink-0">
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {loading ? 'Loading...' : `${total} past question${total !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No past questions found</p>
            <p className="text-gray-400 text-sm mt-1">
              Try changing your filters or check back later
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(pq => (
              <PQCard key={pq.id} pq={pq} onDownload={handleDownload} />
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

