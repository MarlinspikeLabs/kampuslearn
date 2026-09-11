'use client';
import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Brain, Send, Plus, ChevronDown,
  Loader2, BookOpen, Zap, AlertCircle, User
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Render full Markdown including mathematical notation.
function MessageContent({ content }) {
  return (
    <div className="text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-4 mb-2">{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 my-3 text-gray-600">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto bg-gray-900 text-gray-100 rounded-lg p-3 my-3 text-xs">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-2 py-1">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
        ${isUser ? 'bg-blue-600' : 'bg-gray-700'}`}>
        {isUser
          ? <User className="w-4 h-4 text-white" />
          : <Brain className="w-4 h-4 text-white" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm
        ${isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
        {isUser
          ? <p className="text-sm leading-relaxed">{msg.content}</p>
          : <MessageContent content={msg.content} />}
        {!isUser && msg.grounding && (
          <p className="text-xs mt-3 text-gray-500">
            {msg.grounding === 'legacy_demo' ? 'Earlier demo response · generated before the live tutor was connected.' : msg.grounding === 'course_excerpts' ? 'Course or shared-library excerpts supplied for this answer. Check the references below.' : 'General explanation · no matching library excerpts found.'}
          </p>
        )}
        {!isUser && msg.sources?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {msg.sources.map(source => (
              <a key={source.number} href={`/read?id=${encodeURIComponent(source.material_id)}`}
                 className="block rounded-lg border border-gray-200 px-2 py-1 text-xs text-teal-700">
                [{source.number}] {source.title} · page {source.page}
              </a>
            ))}
          </div>
        )}
        {!isUser && msg.truncated && <p className="text-xs mt-2 text-gray-500">Ask “continue” for the next part.</p>}
        {msg.created_at && (
          <p className={`text-xs mt-2 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
        <Brain className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-5">
          {[0,1,2].map(i => (
            <div key={i}
                 className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                 style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  'Explain what an operating system is',
  'Quiz me on data structures',
  'Give me a 7-day exam plan',
  'Summarize computer networks',
  'What are my weak topics?',
  'How do I understand algorithms better?',
];

export default function AIChatPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [convoId, setConvoId]         = useState(null);
  const [usage, setUsage]             = useState(null);
  const [courses, setCourses]         = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [showCourses, setShowCourses] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [sendError, setSendError] = useState('');
  const busyRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    // Load AI usage
    api.get('/ai/usage')
      .then(r => setUsage(r.data.data))
      .catch(() => {});

    // Load conversations
    api.get('/ai/conversations')
      .then(r => setConversations(r.data.data))
      .catch(() => {});

    // Load courses for context selector
    if (profile?.department_id) {
      api.get(`/institutions/departments/${profile.department_id}/courses?level=${profile.level}`)
        .then(r => {
          setCourses(r.data.data);
          const requested = new URLSearchParams(window.location.search).get('course_id');
          if (requested && r.data.data.some(c => c.id === requested)) setSelectedCourse(requested);
        })
        .catch(() => {});
    }
  }, [profile]);

  // Reset chat state whenever the authenticated user changes.
  // Conversation IDs are user-owned and must never carry across sessions.
  useEffect(() => {
    setConvoId(null);
    setSelectedCourse('');
    setConversations([]);
    setSendError('');
    setMessages([{
      role: 'assistant',
      content: `Hello ${user?.full_name?.split(' ')[0] || ''}! I'm your study mate.\n\nLet's get you exam-ready. I can explain a difficult concept, give you practice questions, or help you plan your revision.\n\nSelect a course to use matching notes supplied by our academic team. I'll show you when an answer is a general explanation.\n\nWhat would you like to understand today?`,
      created_at: new Date().toISOString()
    }]);
  }, [user?.id]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || busyRef.current) return;
    if (msg.length > 2000) { setSendError('Please keep your question within 2000 characters.'); return; }
    busyRef.current = true;
    setSendError('');
    const pendingId = `pending-${Date.now()}`;

    setInput('');
    setMessages(prev => [...prev, {
      id: pendingId, role: 'user', content: msg, created_at: new Date().toISOString()
    }]);
    setLoading(true);

    try {
      const payload = {
        message: msg,
        conversation_id: convoId || undefined,
        course_id: selectedCourse || undefined,
      };

      let res;
      try {
        res = await api.post('/ai/chat', payload, { timeout: 60000 });
      } catch (err) {
        // Recover once if this browser tab holds a stale conversation ID.
        if (err.response?.status === 404 && convoId) {
          setConvoId(null);
          res = await api.post('/ai/chat', {
            message: msg,
            course_id: selectedCourse || undefined,
          }, { timeout: 60000 });
        } else {
          throw err;
        }
      }

      const data = res.data.data;
      setConvoId(data.conversation_id);
      setMessages(prev => [...prev, {
        role:       'assistant',
        content:    data.reply,
        sources:    data.sources,
        grounding:  data.grounding,
        truncated:  data.truncated,
        created_at: new Date().toISOString()
      }]);
      setUsage(prev => prev ? { ...prev, ...data.usage } : data.usage);
      api.get('/ai/conversations').then(r => setConversations(r.data.data)).catch(() => {});
    } catch (err) {
      const msg2 = err.response?.data?.message || 'AI service unavailable. Please try again.';
      setMessages(prev => prev.filter(item => item.id !== pendingId));
      setInput(msg);
      setSendError(msg2);
      api.get('/ai/usage').then(r => setUsage(r.data.data)).catch(() => {});
    } finally {
      busyRef.current = false;
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const loadConversation = async (id) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const res = await api.get(`/ai/conversations/${id}`);
      const { messages: msgs, conversation } = res.data.data;
      setMessages(msgs);
      setConvoId(id);
      setSelectedCourse(conversation.course_id || '');
      setSendError('');
      setShowHistory(false);
    } catch {
      toast.error('Failed to load conversation');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const newConversation = () => {
    if (busyRef.current) return;
    setSendError('');
    setMessages([{
      role: 'assistant',
      content: 'Starting a new conversation. What would you like to study?',
      created_at: new Date().toISOString()
    }]);
    setConvoId(null);
    setShowHistory(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedCourseName = courses.find(c => c.id === selectedCourse)?.title;

  return (
    <AppLayout title="AI Tutor">
      <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col gap-4">

        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Course selector */}
          <div className="relative">
            <button disabled={loading} onClick={() => setShowCourses(!showCourses)}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg
                               px-3 py-2 text-sm text-gray-700 hover:border-blue-400 transition-colors">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span className="max-w-[180px] truncate">
                {selectedCourseName || 'Select course (optional)'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showCourses && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200
                              rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
                <button
                  disabled={loading}
                  onClick={() => { newConversation(); setSelectedCourse(''); setShowCourses(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-500
                             hover:bg-gray-50 border-b border-gray-100">
                  No specific course
                </button>
                {courses.map(c => (
                  <button key={c.id}
                    disabled={loading}
                    onClick={() => { newConversation(); setSelectedCourse(c.id); setShowCourses(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors
                      ${selectedCourse === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                    <span className="font-medium">{c.code}</span> — {c.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History button */}
          <button onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg
                             px-3 py-2 text-sm text-gray-700 hover:border-blue-400 transition-colors">
            <Zap className="w-4 h-4 text-purple-600" />
            History
          </button>

          {/* New chat */}
          <button disabled={loading} onClick={newConversation}
                  className="flex items-center gap-2 bg-blue-600 text-white rounded-lg
                             px-3 py-2 text-sm hover:bg-blue-700 transition-colors ml-auto">
            <Plus className="w-4 h-4" />
            New chat
          </button>
        </div>

        {/* History drawer */}
        {showHistory && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Recent conversations</h3>
            {conversations.length === 0
              ? <p className="text-sm text-gray-400">No previous conversations</p>
              : conversations.slice(0, 6).map(c => (
                <button key={c.id} disabled={loading} onClick={() => loadConversation(c.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50
                                   transition-colors text-sm mb-1">
                  <p className="font-medium text-gray-800 truncate">{c.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.course_code ? `${c.course_code} · ` : ''}{c.message_count} messages
                  </p>
                </button>
              ))}
          </div>
        )}

        {/* Chat window */}
        <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col
                        overflow-hidden min-h-0">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-gray-400 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                          className="text-xs bg-white border border-gray-200 text-gray-600
                                     px-3 py-1.5 rounded-full hover:border-blue-400 hover:text-blue-600
                                     transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Usage bar */}
          {usage && (
            <div className="px-4 py-2 border-t border-gray-200 bg-white">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{usage.messages_today}/{usage.daily_limit} requests · last 24 hours</span>
                <span>{usage.remaining} remaining</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1">
                <div className={`h-1 rounded-full transition-all
                  ${usage.messages_today / usage.daily_limit > 0.8 ? 'bg-red-500' : 'bg-blue-500'}`}
                     style={{ width: `${Math.min(100, (usage.messages_today / usage.daily_limit) * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <p className="mb-2 text-xs text-gray-500">Free AI pilot · Keep personal and confidential information out of your study questions.</p>
            {usage?.available === false && <p className="mb-3 text-sm text-gray-600" role="status">Your study mate is being connected. Your course materials and practice are available in Learn.</p>}
            {sendError && <p className="mb-3 text-sm text-red-700" role="alert">{sendError}</p>}
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  rows={1}
                  aria-label="Your study question"
                  maxLength={2000}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedCourseName
                    ? `Ask about ${selectedCourseName}...`
                    : 'Ask me anything about your studies...'}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             resize-none disabled:opacity-50 max-h-32"
                  style={{ minHeight: '48px' }}
                  onInput={e => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                  }}
                />
              </div>
              <button
                onClick={() => sendMessage()}
                aria-label="Send question"
                disabled={loading || !input.trim() || usage?.available === false}
                className="w-11 h-11 bg-blue-600 text-white rounded-xl flex items-center justify-center
                           hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors flex-shrink-0">
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Send className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
