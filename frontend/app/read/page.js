'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ArrowLeft, ZoomIn, ZoomOut, AlignJustify,
  Columns, ChevronLeft, ChevronRight,
  BookOpen, Loader2, Download
} from 'lucide-react';
import toast from 'react-hot-toast';

// PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function ReaderPage() {
  const router   = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mat, setMat]         = useState(null);
  const [matId, setMatId]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState('');   // pdf | text
  const [textPages, setTextPages] = useState([]);

  // PDF state
  const [numPages, setNumPages]   = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale]         = useState(1.2);
  const [layout, setLayout]       = useState('vertical'); // vertical | single

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  // Get ID from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (!id) { router.push('/materials'); return; }
      setMatId(id);
    }
  }, []);

  // Load material
  useEffect(() => {
    if (!matId || !user) return;
    api.get(`/materials/${matId}/read`)
      .then(res => {
        const data = res.data.data;
        setMat(data);
        const base = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '');
        const url  = `${base}${data.file_url}`;
        setFileUrl(url);
        const ext = (data.file_name || '').split('.').pop().toLowerCase();
        if (['pdf'].includes(ext)) {
          setFileType('pdf');
        } else {
          setFileType('text');
          // Fetch text content
          fetch(url)
            .then(r => r.text())
            .then(text => {
              const words = text.split(/\s+/);
              const pages = [];
              for (let i = 0; i < words.length; i += 400) {
                pages.push(words.slice(i, i + 400).join(' '));
              }
              setTextPages(pages.length ? pages : [text]);
            });
        }
      })
      .catch(() => { toast.error('Failed to load'); router.push('/materials'); })
      .finally(() => setLoading(false));
  }, [matId, user]);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
  }, []);

  const zoomIn  = () => setScale(s => Math.min(2.5, +(s + 0.2).toFixed(1)));
  const zoomOut = () => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)));

  if (authLoading || loading) return (
    <div className="min-h-screen bg-[#1e1e2e] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading document...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1e1e2e] flex flex-col"
         style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5
                      bg-[#13131f] border-b border-white/10 flex-shrink-0 gap-4">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/materials"
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate max-w-xs">
              {mat?.file_name || 'Document'}
            </p>
            <p className="text-gray-500 text-xs">KampusLearn Reader</p>
          </div>
        </div>

        {/* Centre — page nav (PDF only) */}
        {fileType === 'pdf' && numPages && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                    disabled={pageNumber === 1}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10
                               rounded-lg disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-gray-300 text-xs font-mono min-w-[70px] text-center">
              {pageNumber} / {numPages}
            </span>
            <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                    disabled={pageNumber === numPages}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10
                               rounded-lg disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right — controls */}
        <div className="flex items-center gap-1">
          <button onClick={zoomOut}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-gray-500 text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          {fileType === 'pdf' && (
            <>
              <button onClick={() => setLayout('vertical')}
                      title="Scroll mode"
                      className={`p-2 rounded-lg transition-colors
                        ${layout === 'vertical'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
                <AlignJustify className="w-4 h-4" />
              </button>
              <button onClick={() => setLayout('single')}
                      title="Single page"
                      className={`p-2 rounded-lg transition-colors
                        ${layout === 'single'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
                <Columns className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* PDF viewer */}
        {fileType === 'pdf' && fileUrl && (
          <div className="flex flex-col items-center py-6 px-4 gap-4">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={() => toast.error('Failed to load PDF')}
              loading={
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              }
            >
              {layout === 'vertical' ? (
                // All pages stacked
                Array.from({ length: numPages || 0 }, (_, i) => (
                  <div key={i} className="mb-4 shadow-2xl">
                    <Page
                      pageNumber={i + 1}
                      scale={scale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="rounded-lg overflow-hidden"
                    />
                  </div>
                ))
              ) : (
                // Single page
                <div className="flex flex-col items-center gap-4">
                  <div className="shadow-2xl rounded-lg overflow-hidden">
                    <Page
                      key={pageNumber}
                      pageNumber={pageNumber}
                      scale={scale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </div>
                  {/* Page navigation below the page */}
                  <div className="flex items-center gap-4 pb-6">
                    <button onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                            disabled={pageNumber === 1}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white
                                       rounded-xl hover:bg-white/20 disabled:opacity-30 transition-colors text-sm">
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-gray-400 text-sm font-mono">
                      {pageNumber} / {numPages}
                    </span>
                    <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                            disabled={pageNumber === numPages}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white
                                       rounded-xl hover:bg-white/20 disabled:opacity-30 transition-colors text-sm">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </Document>
          </div>
        )}

        {/* Text viewer */}
        {fileType === 'text' && (
          <div className="max-w-3xl mx-auto py-8 px-4">
            {layout === 'vertical' ? (
              textPages.map((page, i) => (
                <div key={i} className="mb-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-gray-600 text-xs px-3">Page {i + 1}</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="bg-[#faf8f3] rounded-2xl shadow-2xl p-8 sm:p-12 min-h-[500px]"
                       style={{ fontFamily: 'Georgia, Palatino, serif', fontSize: `${scale * 13}px`, lineHeight: '1.9', color: '#2d2d2d' }}>
                    <p className="whitespace-pre-wrap">{page}</p>
                  </div>
                </div>
              ))
            ) : (
              <div>
                <div className="bg-[#faf8f3] rounded-2xl shadow-2xl p-8 sm:p-12 min-h-[500px] relative"
                     style={{ fontFamily: 'Georgia, Palatino, serif', fontSize: `${scale * 13}px`, lineHeight: '1.9', color: '#2d2d2d' }}>
                  <p className="whitespace-pre-wrap">{textPages[pageNumber - 1]}</p>
                  <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-400">
                    {pageNumber} / {textPages.length}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-5">
                  <button onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                          disabled={pageNumber === 1}
                          className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white
                                     rounded-xl hover:bg-white/20 disabled:opacity-30 text-sm">
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <button onClick={() => setPageNumber(p => Math.min(textPages.length, p + 1))}
                          disabled={pageNumber === textPages.length}
                          className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white
                                     rounded-xl hover:bg-white/20 disabled:opacity-30 text-sm">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Status bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2
                      bg-[#13131f] border-t border-white/10 flex-shrink-0">
        <span className="text-gray-600 text-xs flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5" />
          Reading is free · Save offline costs 5 KP
        </span>
        {fileType === 'pdf' && numPages && (
          <span className="text-gray-600 text-xs">
            {numPages} pages · PDF.js renderer
          </span>
        )}
      </div>
    </div>
  );
}
