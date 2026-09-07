'use client';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart3, Clock, BookOpen, ChevronRight,
  CheckCircle, Trophy, Loader2, Play
} from 'lucide-react';
import toast from 'react-hot-toast';

function ExamCard({ exam, onStart }) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center
                          justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{exam.title}</p>
            <p className="text-sm text-gray-500 mt-0.5">{exam.course_title} · {exam.course_code}</p>
            <div className="flex items-center flex-wrap gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {exam.duration_minutes} mins
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {exam.question_count} questions
              </span>
              <span>Pass mark: {exam.pass_mark}%</span>
              {parseInt(exam.attempt_count) > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Attempted {exam.attempt_count}x
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => onStart(exam)}
                className="flex items-center gap-1.5 bg-green-600 text-white text-sm
                           font-medium px-4 py-2 rounded-lg hover:bg-green-700
                           transition-colors flex-shrink-0">
          <Play className="w-4 h-4" />
          Start
        </button>
      </div>
    </div>
  );
}

function ResultCard({ result, onRetry, onReview }) {
  const passed = result.passed;
  return (
    <div className={`rounded-2xl border-2 p-6 text-center
      ${passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4
        ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
        {passed
          ? <Trophy className="w-8 h-8 text-green-600" />
          : <BarChart3 className="w-8 h-8 text-red-600" />}
      </div>
      <h3 className={`text-2xl font-bold mb-1
        ${passed ? 'text-green-700' : 'text-red-700'}`}>
        {passed ? 'You Passed!' : 'Keep Practicing!'}
      </h3>
      <p className={`text-4xl font-bold mb-2
        ${passed ? 'text-green-600' : 'text-red-600'}`}>
        {result.percent_score}%
      </p>
      <p className="text-gray-600 text-sm mb-2">
        {result.score}/{result.total_marks} marks ·
        {result.correct_count} correct · {result.wrong_count} wrong
      </p>
      <p className="text-gray-500 text-xs mb-6">
        Time taken: {Math.floor(result.time_taken_secs / 60)}m {result.time_taken_secs % 60}s
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={onReview}
                className="btn-secondary text-sm px-6">
          Review Answers
        </button>
        <button onClick={onRetry}
                className="btn-primary text-sm px-6">
          Try Again
        </button>
      </div>
    </div>
  );
}

export default function ExamsPage() {
  const { profile } = useAuth();
  const [view, setView]           = useState('list');    // list | exam | result | review
  const [exams, setExams]         = useState([]);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeExam, setActiveExam]   = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState({});
  const [attemptId, setAttemptId] = useState(null);
  const [timeLeft, setTimeLeft]   = useState(0);
  const [current, setCurrent]     = useState(0);
  const [result, setResult]       = useState(null);
  const [review, setReview]       = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/exams' + (new URLSearchParams(window.location.search).get('course_id') ? '?course_id=' + encodeURIComponent(new URLSearchParams(window.location.search).get('course_id')) : '')),
      api.get('/exams/attempts/history')
    ])
      .then(([exRes, histRes]) => {
        setExams(exRes.data.data);
        setHistory(histRes.data.data);
      })
      .catch(() => toast.error('Failed to load exams'))
      .finally(() => setLoading(false));
  }, []);

  // Countdown timer
  useEffect(() => {
    if (view !== 'exam' || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(s => {
        if (s <= 1) { clearInterval(t); handleSubmit(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [view, timeLeft]);

  const startExam = async (exam) => {
    setLoading(true);
    try {
      const [examRes, startRes] = await Promise.all([
        api.get(`/exams/${exam.id}`),
        api.post(`/exams/${exam.id}/start`)
      ]);
      setActiveExam(examRes.data.data.exam);
      setQuestions(examRes.data.data.questions);
      setAttemptId(startRes.data.data.attempt_id);
      setTimeLeft(startRes.data.data.time_remaining_s);
      setAnswers({});
      setCurrent(0);
      setView('exam');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start exam');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (auto = false) => {
    if (submitting) return;
    const unanswered = questions.length - Object.keys(answers).length;
    if (!auto && unanswered > 0) {
      const ok = window.confirm(
        `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`
      );
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/exams/attempts/${attemptId}/submit`, { answers });
      setResult(res.data.data);
      setView('result');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const loadReview = async () => {
    try {
      const res = await api.get(`/exams/attempts/${attemptId}/review`);
      setReview(res.data.data);
      setView('review');
    } catch {
      toast.error('Failed to load review');
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const q = questions[current];
  const answered = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answered / questions.length) * 100 : 0;

  // ── EXAM VIEW ────────────────────────────────────────────────
  if (view === 'exam' && q) {
    return (
      <AppLayout title={activeExam?.title || 'Exam'}>
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Exam header */}
          <div className="card">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-gray-900">{activeExam?.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Question {current + 1} of {questions.length}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-1.5 font-mono font-bold text-lg
                  ${timeLeft < 300 ? 'text-red-600' : 'text-gray-700'}`}>
                  <Clock className={`w-5 h-5 ${timeLeft < 300 ? 'text-red-500' : 'text-gray-400'}`} />
                  {formatTime(timeLeft)}
                </div>
                <button onClick={() => handleSubmit()}
                        disabled={submitting}
                        className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{answered} answered</span>
                <span>{questions.length - answered} remaining</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all duration-300"
                     style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {/* Question */}
          <div className="card">
            <div className="flex items-start gap-3 mb-6">
              <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center
                               justify-center text-sm font-bold flex-shrink-0">
                {current + 1}
              </span>
              <p className="text-gray-900 font-medium leading-relaxed pt-1">{q.question_text}</p>
            </div>

            {/* MCQ options */}
            {q.question_type === 'mcq' && q.options && (
              <div className="space-y-3">
                {q.options.map(opt => (
                  <button key={opt.label}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.label }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all
                      flex items-center gap-3 text-sm
                      ${answers[q.id] === opt.label
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'}`}>
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center
                                      font-bold text-xs flex-shrink-0
                      ${answers[q.id] === opt.label
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-500'}`}>
                      {opt.label}
                    </span>
                    {opt.text}
                  </button>
                ))}
              </div>
            )}

            {/* True/False */}
            {q.question_type === 'true_false' && (
              <div className="flex gap-4">
                {['True', 'False'].map(opt => (
                  <button key={opt}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                    className={`flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-all
                      ${answers[q.id] === opt
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 hover:border-blue-300 text-gray-700'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrent(c => Math.max(0, c - 1))}
                    disabled={current === 0}
                    className="btn-secondary text-sm disabled:opacity-40">
              ← Previous
            </button>

            {/* Question dots */}
            <div className="flex flex-wrap gap-1.5 max-w-xs justify-center">
              {questions.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors
                          ${i === current ? 'bg-blue-600 text-white' :
                            answers[questions[i]?.id] ? 'bg-green-500 text-white' :
                            'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                  {i + 1}
                </button>
              ))}
            </div>

            {current < questions.length - 1
              ? <button onClick={() => setCurrent(c => c + 1)} className="btn-primary text-sm">
                  Next →
                </button>
              : <button onClick={() => handleSubmit()} disabled={submitting}
                        className="btn-primary text-sm bg-green-600 hover:bg-green-700 flex items-center gap-1">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Finish
                </button>
            }
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── RESULT VIEW ──────────────────────────────────────────────
  if (view === 'result' && result) {
    return (
      <AppLayout title="Exam Result">
        <div className="max-w-lg mx-auto">
          <ResultCard
            result={result}
            onRetry={() => { setView('list'); setResult(null); }}
            onReview={loadReview}
          />
        </div>
      </AppLayout>
    );
  }

  // ── REVIEW VIEW ──────────────────────────────────────────────
  if (view === 'review' && review) {
    return (
      <AppLayout title="Answer Review">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">{review.attempt?.exam_title}</h2>
              <p className="text-sm text-gray-500">
                Score: {review.attempt?.percent_score}% · Pass mark: {review.attempt?.pass_mark}%
              </p>
            </div>
            <button onClick={() => setView('list')}
                    className="btn-secondary text-sm">
              Back to exams
            </button>
          </div>

          {review.answers.map((ans, i) => (
            <div key={i} className={`card border-l-4
              ${ans.is_correct ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                  Q{i + 1}
                </span>
                <p className="text-sm font-medium text-gray-900">{ans.question_text}</p>
              </div>

              {ans.options && (
                <div className="space-y-2 mb-3">
                  {ans.options.map(opt => (
                    <div key={opt.label}
                         className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2
                      ${opt.label === ans.correct_answer ? 'bg-green-100 text-green-800 font-medium' :
                        opt.label === ans.student_answer && !ans.is_correct ? 'bg-red-100 text-red-800' :
                        'bg-gray-50 text-gray-600'}`}>
                      <span className="font-bold w-4">{opt.label}.</span>
                      {opt.text}
                      {opt.label === ans.correct_answer && <CheckCircle className="w-4 h-4 ml-auto" />}
                    </div>
                  ))}
                </div>
              )}

              {ans.explanation && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-800">
                  <strong>Explanation:</strong> {ans.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </AppLayout>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────
  return (
    <AppLayout title="CBT Practice">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">CBT Practice Tests</h2>
          <p className="text-gray-500 text-sm mt-1">
            Timed mock exams with instant grading and explanations
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : exams.length === 0 ? (
          <div className="text-center py-20">
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No practice tests available yet</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon — more tests are being added</p>
          </div>
        ) : (
          <div className="space-y-4">
            {exams.map(exam => (
              <ExamCard key={exam.id} exam={exam} onStart={startExam} />
            ))}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Recent attempts</h3>
            <div className="space-y-2">
              {history.slice(0, 5).map(att => (
                <div key={att.id}
                     className="bg-white border border-gray-100 rounded-xl px-4 py-3
                                flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{att.exam_title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {att.course_code} · {new Date(att.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg
                      ${parseFloat(att.percent_score) >= att.pass_mark
                        ? 'text-green-600' : 'text-red-500'}`}>
                      {att.percent_score}%
                    </p>
                    <p className={`text-xs
                      ${parseFloat(att.percent_score) >= att.pass_mark
                        ? 'text-green-500' : 'text-red-400'}`}>
                      {parseFloat(att.percent_score) >= att.pass_mark ? 'Passed' : 'Failed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

