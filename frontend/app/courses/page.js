'use client';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  BookOpen, ChevronRight, Search,
  GraduationCap, Loader2, Brain, FileText, BarChart3
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const LEVEL_ORDER = {
  '100': 1, '200': 2, '300': 3, '400': 4, '500': 5, '600': 6,
  'ND1': 1, 'ND2': 2, 'HND1': 3, 'HND2': 4
};

function CourseCard({ course }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md
                    transition-all duration-200 hover:border-blue-200 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center
                          flex-shrink-0 group-hover:bg-blue-100 transition-colors">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {course.code}
              </span>
              <span className="text-xs text-gray-400">{course.credit_units} units</span>
            </div>
            <p className="font-semibold text-gray-900 mt-1 text-sm leading-snug">
              {course.title}
            </p>
          </div>
        </div>
      </div>

      {/* Quick action links */}
      <div className="mt-4 flex gap-2">
        <Link href={`/ai-chat?course_id=${course.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium
                         bg-blue-50 text-blue-700 px-3 py-2 rounded-lg
                         hover:bg-blue-100 transition-colors">
          <Brain className="w-3.5 h-3.5" />
          AI Tutor
        </Link>
        <Link href={`/past-questions?course_id=${course.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium
                         bg-purple-50 text-purple-700 px-3 py-2 rounded-lg
                         hover:bg-purple-100 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          Past Qs
        </Link>
        <Link href={`/exams?course_id=${course.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium
                         bg-green-50 text-green-700 px-3 py-2 rounded-lg
                         hover:bg-green-100 transition-colors">
          <BarChart3 className="w-3.5 h-3.5" />
          CBT
        </Link>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const { profile } = useAuth();
  const [courses, setCourses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [semester, setSemester]     = useState('first');
  const [levelFilter, setLevelFilter] = useState('');
  const [levels, setLevels]         = useState([]);

  const levelType = profile?.institution_type || 'university';
  const uniLevels  = ['100','200','300','400','500','600'];
  const polyLevels = ['ND1','ND2','HND1','HND2'];
  const allLevels  = levelType === 'polytechnic' ? polyLevels : uniLevels;

  useEffect(() => {
    if (!profile?.department_id) return;
    setLoading(true);
    const params = new URLSearchParams({ semester });
    if (levelFilter) params.append('level', levelFilter);

    api.get(`/institutions/departments/${profile.department_id}/courses?${params}`)
      .then(r => {
        const data = r.data.data;
        setCourses(data);
        // Extract unique levels for filter tabs
        const uniqueLevels = [...new Set(data.map(c => c.level))]
          .sort((a, b) => (LEVEL_ORDER[a] || 0) - (LEVEL_ORDER[b] || 0));
        setLevels(uniqueLevels);
      })
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false));
  }, [profile, semester, levelFilter]);

  const filtered = courses.filter(c =>
    !search ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  // Group by level
  const grouped = filtered.reduce((acc, course) => {
    const key = course.level;
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {});

  const sortedLevelKeys = Object.keys(grouped)
    .sort((a, b) => (LEVEL_ORDER[a] || 0) - (LEVEL_ORDER[b] || 0));

  return (
    <AppLayout title="Courses">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Courses</h2>
          <p className="text-gray-500 text-sm mt-1">
            {profile
              ? `${profile.department_name} · ${profile.institution_short}`
              : 'Browse your course catalogue'}
          </p>
        </div>

        {/* Semester tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { value: 'first',  label: '1st Semester' },
            { value: 'second', label: '2nd Semester' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => { setSemester(tab.value); setLevelFilter(''); }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${semester === tab.value
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Level filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setLevelFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${!levelFilter
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All Levels
          </button>
          {allLevels.map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l === levelFilter ? '' : l)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${levelFilter === l
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Search courses by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No courses found</p>
            <p className="text-gray-400 text-sm mt-1">
              {search ? 'Try a different search term' : `No courses for ${semester} semester`}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedLevelKeys.map(level => (
              <div key={level}>
                {/* Level header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{level}</span>
                  </div>
                  <h3 className="font-bold text-gray-900">
                    {levelType === 'polytechnic'
                      ? level === 'ND1' ? 'ND1 — First Year, First Semester'
                        : level === 'ND2' ? 'ND2 — First Year, Second Semester'
                        : level === 'HND1' ? 'HND1 — Second Year, First Semester'
                        : 'HND2 — Second Year, Second Semester'
                      : `${level} Level`}
                  </h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {grouped[level].length} course{grouped[level].length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Course grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {grouped[level].map(course => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 pt-2">
            {filtered.length} course{filtered.length !== 1 ? 's' : ''} in{' '}
            {semester === 'first' ? '1st' : '2nd'} semester
            {levelFilter ? ` · ${levelFilter}` : ''}
          </p>
        )}
      </div>
    </AppLayout>
  );
}
