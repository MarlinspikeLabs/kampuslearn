'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, Columns, AlignJustify, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, BookOpen, Loader2, X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReaderPage() {
  const router   = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mat, setMat]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout]   = useState('vertical');   // vertical | horizontal
  const [fontSize, setFontSize] = useState(16);
  const [matId, setMatId]     = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [fileType, setFileType] = useState(null);      // pdf | text | unknown
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const iframeRef = useRef(null);

  // Get material ID from URL on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (!id) { toast.error('No material specified'); router.push('/materials'); return; }
      setMatId(id);
    }
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  // Load material
  useEffect(() => {
    if (!matId || !user) return;
    setLoading(true);
    api.get(`/materials/${matId}/read`)
      .then(res => {
        setMat(res.data.data);
        const url  = res.data.data.file_url;
        const name = res.data.data.file_name || '';
        const ext  = name.split('.').pop().toLowerCase();
        if (ext === 'pdf') setFileType('pdf');
        else if (['txt','md','html'].includes(ext)) setFileType('text');
        else setFileType('pdf'); // try as pdf anyway
      })
      .catch(err => {
        toast.error(err.response?.data?.message || 'Failed to load material');
        router.push('/materials');
      })
      .finally(() => setLoading(false));
  }, [matId, user]);

  // Load text content for text files
  useEffect(() => {
    if (!mat || fileType !== 'text') return;
    const base = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '');
    fetch(`${base}${mat.file_url}`)
      .then(r => r.text())
      .then(text => {
        // Split into pages of ~500 words each
        const words   = text.split(/\s+/);
        const perPage = 400;
        const pages   = [];
        for (let i = 0; i < words.length; i += perPage) {
          pages.push(words.slice(i, i + perPage).join(' '));
        }
        setFileContent(pages.length > 0 ? pages : [text]);
        setTotalPages(pages.length > 0 ? pages.length : 1);
      })
      .catch(() => setFileContent(['Failed to load text content.']));
  }, [mat, fileType]);

  const fileUrl = mat
    ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${mat.file_url}`
    : '';

  if (authLoading || loading) return (
    <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading document...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col"
         style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>

      {/* ── Top toolbar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3
                      bg-[#16213e] border-b border-white/10 flex-shrink-0">
        {/* Left — back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/materials"
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10
                           rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate max-w-xs">
              {mat?.file_name || 'Document'}
            </p>
            <p className="text-gray-500 text-xs">KampusLearn Reader</p>
          </div>
        </div>

        {/* Right — controls */}
        <div className="flex items-center gap-1">
          {/* Font size */}
          <button onClick={() => setFontSize(f => Math.max(12, f - 2))}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-gray-400 text-xs w-8 text-center">{fontSize}px</span>
          <button onClick={() => setFontSize(f => Math.min(24, f + 2))}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-white/20 mx-1" />

          {/* Layout toggle */}
          <button onClick={() => setLayout('vertical')}
                  title="Vertical scroll"
                  className={`p-2 rounded-lg transition-colors
                    ${layout === 'vertical'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
            <AlignJustify className="w-4 h-4" />
          </button>
          <button onClick={() => setLayout('horizontal')}
                  title="Page view"
                  className={`p-2 rounded-lg transition-colors
                    ${layout === 'horizontal'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
            <Columns className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Reader body ──────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* PDF reader */}
        {fileType === 'pdf' && (
          <div className="flex-1 overflow-hidden">
            <iframe
              ref={iframeRef}
              src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full border-0"
              title="Document Reader"
              style={{ minHeight: 'calc(100vh - 56px)' }}
            />
          </div>
        )}

        {/* Text reader */}
        {fileType === 'text' && fileContent && (
          <>
            {layout === 'vertical' ? (
              /* Vertical scroll — all pages */
              <div className="flex-1 overflow-y-auto px-4 py-8">
                <div className="max-w-2xl mx-auto">
                  {fileContent.map((page, i) => (
                    <div key={i} className="mb-12">
                      {/* Page number */}
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-gray-500 text-xs font-medium px-3">
                          Page {i + 1}
                        </span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                      {/* Page content */}
                      <div className="bg-[#faf8f3] rounded-2xl shadow-2xl p-8 sm:p-12
                                      min-h-[600px]"
                           style={{
                             fontFamily: "'Georgia', 'Palatino', serif",
                             fontSize:   `${fontSize}px`,
                             lineHeight: '1.9',
                             color:      '#2d2d2d',
                             letterSpacing: '0.01em',
                           }}>
                        <p className="whitespace-pre-wrap">{page}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Horizontal page view — one page at a time */
              <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
                <div className="w-full max-w-2xl">
                  {/* Page */}
                  <div className="bg-[#faf8f3] rounded-2xl shadow-2xl p-8 sm:p-14
                                  min-h-[600px] relative"
                       style={{
                         fontFamily: "'Georgia', 'Palatino', serif",
                         fontSize:   `${fontSize}px`,
                         lineHeight: '1.9',
                         color:      '#2d2d2d',
                         letterSpacing: '0.01em',
                       }}>
                    <p className="whitespace-pre-wrap">
                      {fileContent[currentPage - 1]}
                    </p>
                    {/* Page number at bottom */}
                    <div className="absolute bottom-5 left-0 right-0 text-center">
                      <span className="text-gray-400 text-xs">
                        {currentPage} / {totalPages}
                      </span>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white
                                 rounded-xl hover:bg-white/20 transition-colors disabled:opacity-30
                                 text-sm font-medium">
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>

                    {/* Page dots */}
                    <div className="flex gap-1.5">
                      {Array.from({ length: Math.min(totalPages, 9) }).map((_, i) => {
                        const page = totalPages <= 9 ? i + 1 :
                          Math.round(1 + (i / 8) * (totalPages - 1));
                        return (
                          <button key={i}
                            onClick={() => setCurrentPage(page)}
                            className={`w-2 h-2 rounded-full transition-all
                              ${currentPage === page
                                ? 'bg-blue-400 w-4'
                                : 'bg-white/30 hover:bg-white/50'}`}
                          />
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white
                                 rounded-xl hover:bg-white/20 transition-colors disabled:opacity-30
                                 text-sm font-medium">
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Unknown file type fallback */}
        {fileType === 'unknown' && (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">This file type cannot be previewed in the reader.</p>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                 className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold
                            hover:bg-blue-700 transition-colors">
                Open file directly
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom status bar ────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2
                      bg-[#16213e] border-t border-white/10 flex-shrink-0">
        <span className="text-gray-500 text-xs flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5" />
          Reading is free · Save offline costs 5 KP
        </span>
        {fileType === 'text' && (
          <span className="text-gray-500 text-xs">
            {layout === 'vertical' ? 'Scroll mode' : `Page ${currentPage} of ${totalPages}`}
          </span>
        )}
      </div>
    </div>
  );
}
