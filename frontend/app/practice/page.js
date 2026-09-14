'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Flame,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';

function percent(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function EmptyState({ children }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}

export default function PracticePage() {
  const [view, setView] = useState('home');
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [history, setHistory] = useState([]);
  const [weakAreas, setWeakAreas] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('mixed');

  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answering, setAnswering] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState(null);

  const loadHome = async () => {
    setLoading(true);

    try {
      const [coursesRes, historyRes, weakRes] = await Promise.all([
        api.get('/practice/courses'),
        api.get('/practice/history'),
        api.get('/practice/weak-areas'),
      ]);

      setCourses(coursesRes.data.data || []);
      setHistory(historyRes.data.data || []);
      setWeakAreas(weakRes.data.data || []);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Failed to load Practice'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHome();
  }, []);

  const availableCourses = useMemo(
    () => courses.filter(c => Number(c.question_count) > 0),
    [courses]
  );

  const recentCompleted = useMemo(
    () => history.filter(h => h.status === 'completed').slice(0, 5),
    [history]
  );

  const currentWeakArea = weakAreas[0] || null;

  const openCourse = (course, topic = null, mode = 'quick') => {
    setSelectedCourse({
      ...course,
      selected_topic: topic,
      selected_mode: mode,
    });

    const available = Number(
      topic?.question_count ??
      course.question_count ??
      0
    );

    if (available <= 5) {
      setQuestionCount(Math.max(1, available));
    } else if (available < 10) {
      setQuestionCount(5);
    } else {
      setQuestionCount(10);
    }

    setDifficulty('mixed');
    setView('setup');
  };

  const startPractice = async () => {
    if (!selectedCourse) return;

    if (Number(selectedCourse.question_count) < 1) {
      toast.error('No practice questions are available for this course yet');
      return;
    }

    setStarting(true);

    try {
      const available = Number(
        selectedCourse.selected_topic?.question_count ??
        selectedCourse.question_count
      );

      const res = await api.post('/practice/sessions', {
        course_id: selectedCourse.id,
        topic_id: selectedCourse.selected_topic?.id || null,
        question_count: Math.min(
          questionCount,
          available
        ),
        difficulty,
        mode: selectedCourse.selected_mode || 'quick',
      });

      const data = res.data.data;

      setSession(data.session);
      setQuestion(data.question);
      setFeedback(null);
      setSelectedAnswer(null);
      setResult(null);
      setView('question');
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Failed to start practice'
      );
    } finally {
      setStarting(false);
    }
  };

  const submitAnswer = async answer => {
    if (!question || !session || feedback || answering) return;

    setSelectedAnswer(answer);
    setAnswering(true);

    try {
      const res = await api.post(
        `/practice/sessions/${session.id}/answer`,
        {
          question_id: question.question_id,
          answer,
        }
      );

      setFeedback(res.data.data);
      setSession(prev => ({
        ...prev,
        answered_count: res.data.data.progress.answered,
        correct_count: res.data.data.progress.correct,
        wrong_count: res.data.data.progress.wrong,
        accuracy: res.data.data.progress.accuracy,
      }));
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Failed to submit answer'
      );
      setSelectedAnswer(null);
    } finally {
      setAnswering(false);
    }
  };

  const completeSession = async () => {
    try {
      const res = await api.post(
        `/practice/sessions/${session.id}/complete`
      );

      setResult(res.data.data);
      setView('result');

      await loadHome();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Failed to complete practice'
      );
    }
  };

  const nextQuestion = async () => {
    if (!session) return;

    if (
      feedback?.progress?.answered >=
      feedback?.progress?.total
    ) {
      await completeSession();
      return;
    }

    try {
      const res = await api.get(
        `/practice/sessions/${session.id}`
      );

      const data = res.data.data;

      if (!data.question) {
        await completeSession();
        return;
      }

      setSession(data.session);
      setQuestion(data.question);
      setFeedback(null);
      setSelectedAnswer(null);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Failed to load next question'
      );
    }
  };

  const resetToHome = () => {
    setView('home');
    setSelectedCourse(null);
    setSession(null);
    setQuestion(null);
    setFeedback(null);
    setSelectedAnswer(null);
    setResult(null);
  };

  if (loading && view === 'home') {
    return (
      <AppLayout title="Practice">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    );
  }

  // ============================================================
  // SESSION SETUP
  // ============================================================
  if (view === 'setup' && selectedCourse) {
    const maxQuestions = Number(selectedCourse.question_count || 0);

    const countChoices = [5, 10, 20, 30]
      .filter(n => n <= maxQuestions);

    if (
      maxQuestions > 0 &&
      !countChoices.includes(maxQuestions) &&
      maxQuestions < 5
    ) {
      countChoices.unshift(maxQuestions);
    }

    return (
      <AppLayout title="Practice">
        <div className="mx-auto max-w-2xl space-y-6">
          <button
            onClick={() => setView('home')}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Practice
          </button>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-50">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {selectedCourse.selected_mode === 'weak_topics'
                    ? 'Focused Practice'
                    : 'Quick Practice'}
                </p>
                <h1 className="mt-1 text-xl font-bold text-gray-950">
                  {selectedCourse.code}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedCourse.title}
                </p>

                {selectedCourse.selected_topic && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                    <Target className="h-3.5 w-3.5" />
                    {selectedCourse.selected_topic.name}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  {selectedCourse.question_count} approved questions available
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-900">
                  Number of questions
                </p>

                <div className="grid grid-cols-4 gap-2">
                  {countChoices.map(n => (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        questionCount === n
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-gray-900">
                  Difficulty
                </p>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ['mixed', 'Mixed'],
                    ['easy', 'Easy'],
                    ['medium', 'Medium'],
                    ['hard', 'Hard'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setDifficulty(value)}
                      className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                        difficulty === value
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Brain className="h-4 w-4 text-blue-600" />
                  Instant learning mode
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  You’ll see whether each answer is correct immediately,
                  together with the explanation before moving on.
                </p>
              </div>

              <button
                onClick={startPractice}
                disabled={starting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start Practice
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ============================================================
  // QUESTION VIEW
  // ============================================================
  if (view === 'question' && session && question) {
    const answered = feedback?.progress?.answered ??
      session.answered_count ??
      0;

    const total =
      feedback?.progress?.total ??
      session.question_count ??
      1;

    const progress = Math.min(
      100,
      Math.round((answered / total) * 100)
    );

    return (
      <AppLayout title="Quick Practice">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {selectedCourse?.code}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  Question {question.position} of {total}
                </p>
              </div>

              <div className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium capitalize text-gray-600">
                {question.difficulty}
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            {question.topic_name && (
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                <Target className="h-3.5 w-3.5" />
                {question.topic_name}
              </div>
            )}

            <h2 className="text-lg font-semibold leading-8 text-gray-950">
              {question.question_text}
            </h2>

            <div className="mt-6 space-y-3">
              {(question.options || []).map(opt => {
                const chosen = selectedAnswer === opt.label;
                const correct =
                  feedback &&
                  opt.label === feedback.correct_answer;

                const wrongChosen =
                  feedback &&
                  chosen &&
                  !feedback.correct;

                let state =
                  'border-gray-200 bg-white hover:border-blue-300';

                if (chosen && !feedback) {
                  state =
                    'border-blue-500 bg-blue-50';
                }

                if (correct) {
                  state =
                    'border-green-500 bg-green-50';
                }

                if (wrongChosen) {
                  state =
                    'border-red-500 bg-red-50';
                }

                return (
                  <button
                    key={opt.label}
                    disabled={Boolean(feedback) || answering}
                    onClick={() => submitAnswer(opt.label)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${state}`}
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-700">
                      {opt.label}
                    </span>

                    <span className="flex-1 text-sm font-medium text-gray-800">
                      {opt.text}
                    </span>

                    {correct && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}

                    {wrongChosen && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {answering && (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking answer...
              </div>
            )}

            {feedback && (
              <div
                className={`mt-6 rounded-2xl border p-4 ${
                  feedback.correct
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {feedback.correct ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <CircleAlert className="h-5 w-5 text-red-500" />
                  )}

                  <p
                    className={`font-semibold ${
                      feedback.correct
                        ? 'text-green-800'
                        : 'text-red-800'
                    }`}
                  >
                    {feedback.correct
                      ? 'Correct'
                      : `Not quite — the answer is ${feedback.correct_answer}`}
                  </p>
                </div>

                {feedback.explanation && (
                  <p className="mt-3 text-sm leading-6 text-gray-700">
                    {feedback.explanation}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
                  <span className="rounded-full bg-white px-3 py-1">
                    {feedback.progress.correct} correct
                  </span>
                  <span className="rounded-full bg-white px-3 py-1">
                    {feedback.progress.wrong} wrong
                  </span>
                  <span className="rounded-full bg-white px-3 py-1">
                    {feedback.progress.accuracy}% accuracy
                  </span>
                </div>
              </div>
            )}
          </div>

          {feedback && (
            <button
              onClick={nextQuestion}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 px-5 py-3.5 text-sm font-semibold text-white hover:bg-black"
            >
              {feedback.progress.answered >= feedback.progress.total
                ? 'See Results'
                : 'Next Question'}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </AppLayout>
    );
  }

  // ============================================================
  // RESULT VIEW
  // ============================================================
  if (view === 'result' && result) {
    const accuracy = percent(result.accuracy);

    return (
      <AppLayout title="Practice Results">
        <div className="mx-auto max-w-xl space-y-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-7 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
              <Trophy className="h-8 w-8 text-blue-600" />
            </div>

            <p className="mt-5 text-sm font-medium text-gray-500">
              Practice complete
            </p>

            <p className="mt-1 text-5xl font-bold tracking-tight text-gray-950">
              {accuracy}%
            </p>

            <p className="mt-2 text-sm text-gray-500">
              {result.correct_count} correct · {result.wrong_count} wrong
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-lg font-bold text-gray-950">
                  {result.question_count}
                </p>
                <p className="text-xs text-gray-500">Questions</p>
              </div>

              <div className="rounded-2xl bg-green-50 p-3">
                <p className="text-lg font-bold text-green-700">
                  {result.correct_count}
                </p>
                <p className="text-xs text-green-600">Correct</p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-3">
                <p className="text-lg font-bold text-blue-700">
                  {formatDuration(result.duration_seconds)}
                </p>
                <p className="text-xs text-blue-600">Time</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => openCourse(selectedCourse)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800"
            >
              <RotateCcw className="h-4 w-4" />
              Practice Again
            </button>

            <button
              onClick={resetToHome}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
            >
              Back to Practice
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ============================================================
  // PRACTICE HOME
  // ============================================================
  return (
    <AppLayout title="Practice">
      <div className="mx-auto max-w-5xl space-y-8 pb-8">
        <section className="overflow-hidden rounded-3xl bg-gray-950 p-6 text-white sm:p-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
              <Sparkles className="h-3.5 w-3.5" />
              Adaptive Practice
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight !text-white sm:text-3xl">
              Practice what matters most.
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-300">
              Work through your courses one question at a time,
              get instant explanations, and let KampusLearn track
              where you need more practice.
            </p>

            {availableCourses.length > 0 && (
              <button
                onClick={() => openCourse(availableCourses[0])}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold !text-gray-950"
              >
                <Play className="h-4 w-4" />
                Start Quick Practice
              </button>
            )}
          </div>
        </section>

        {currentWeakArea && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-950">
                  Recommended for you
                </h2>
                <p className="text-sm text-gray-500">
                  Based on your recent performance
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                const course = courses.find(
                  c => c.id === currentWeakArea.course_id
                );

                if (!course) {
                  toast.error('Course is not available for your current level');
                  return;
                }

                openCourse(
                  course,
                  {
                    id: currentWeakArea.topic_id,
                    name:
                      currentWeakArea.topic_name ||
                      currentWeakArea.course_title,
                    question_count:
                      currentWeakArea.question_count ||
                      course.question_count,
                  },
                  'weak_topics'
                );
              }}
              className="w-full rounded-3xl border border-orange-100 bg-orange-50 p-5 text-left transition hover:border-orange-200 hover:shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                    Weak area
                  </p>

                  <p className="mt-1 font-semibold text-gray-950">
                    {currentWeakArea.topic_name ||
                      currentWeakArea.course_title}
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    {currentWeakArea.course_code} ·{' '}
                    {currentWeakArea.knowledge_level}% mastery
                  </p>

                  <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-orange-700">
                    Practice this topic
                    <ChevronRight className="h-3.5 w-3.5" />
                  </p>
                </div>
              </div>
            </button>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-950">
                Your Courses
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose a course and start a focused session
              </p>
            </div>
          </div>

          {courses.length === 0 ? (
            <EmptyState>
              No courses are available for your current level.
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map(course => {
                const available =
                  Number(course.question_count) > 0;

                return (
                  <button
                    key={course.id}
                    disabled={!available}
                    onClick={() => openCourse(course)}
                    className={`rounded-3xl border p-5 text-left transition ${
                      available
                        ? 'border-gray-100 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md'
                        : 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-65'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-50">
                          <BookOpen className="h-5 w-5 text-blue-600" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-gray-950">
                            {course.code}
                          </p>
                          <p className="mt-1 truncate text-sm text-gray-500">
                            {course.title}
                          </p>
                          <p className="mt-2 text-xs text-gray-400">
                            {available
                              ? `${course.question_count} questions available`
                              : 'Questions coming soon'}
                          </p>
                        </div>
                      </div>

                      {available && (
                        <ChevronRight className="mt-2 h-5 w-5 flex-shrink-0 text-gray-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-950">
              Practice modes
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Different ways to prepare
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <Brain className="h-6 w-6 text-blue-600" />
              <p className="mt-4 font-bold text-gray-950">
                Quick Practice
              </p>
              <p className="mt-1 text-sm leading-5 text-gray-600">
                Immediate grading and explanations after every question.
              </p>
            </div>

            <a
              href="/exams"
              className="rounded-3xl border border-gray-100 bg-white p-5 transition hover:border-green-200 hover:shadow-md"
            >
              <Clock3 className="h-6 w-6 text-green-600" />
              <p className="mt-4 font-bold text-gray-950">
                Mock CBT
              </p>
              <p className="mt-1 text-sm leading-5 text-gray-600">
                Timed exam simulation with results at the end.
              </p>
            </a>

            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5 opacity-70">
              <Target className="h-6 w-6 text-purple-600" />
              <p className="mt-4 font-bold text-gray-950">
                Past Questions
              </p>
              <p className="mt-1 text-sm leading-5 text-gray-600">
                Structured practice from verified past questions.
              </p>
              <span className="mt-3 inline-block text-xs font-semibold text-gray-400">
                Coming next
              </span>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-950">
                Recent Performance
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Your latest practice sessions
              </p>
            </div>

            <BarChart3 className="h-5 w-5 text-gray-300" />
          </div>

          {recentCompleted.length === 0 ? (
            <EmptyState>
              Complete your first Quick Practice session and your
              progress will appear here.
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {recentCompleted.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {item.course_code} · {item.course_title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {item.answered_count} questions ·{' '}
                      {formatDuration(item.duration_seconds)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-950">
                      {percent(item.accuracy)}%
                    </p>
                    <p className="text-xs text-gray-400">
                      accuracy
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
