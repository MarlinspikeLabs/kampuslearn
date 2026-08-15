'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Brain, FileText, BarChart3,
  CheckCircle, ArrowRight, Menu, X,
  GraduationCap, Zap, Star, TrendingUp,
  Shield, Clock, Users, ChevronRight,
  MessageSquare, Target, Award, Sparkles
} from 'lucide-react';

// ── Animated counter ──────────────────────────────────────────
function Counter({ end, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const startTime = Date.now();
        const endNum = parseInt(end);
        const timer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * endNum));
          if (progress === 1) clearInterval(timer);
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// ── Floating UI card ──────────────────────────────────────────
function FloatingCard({ children, className = '' }) {
  return (
    <div className={`bg-white/10 backdrop-blur-md border border-white/20
                     rounded-2xl p-4 shadow-2xl ${className}`}>
      {children}
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, color, bg, border, index }) {
  return (
    <div className={`group bg-white rounded-2xl p-6 border ${border}
                     hover:shadow-xl transition-all duration-500
                     hover:-translate-y-2 cursor-default`}
         style={{ animationDelay: `${index * 100}ms` }}>
      <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center mb-5
                       group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-7 h-7 ${color}`} />
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
      <div className={`mt-4 flex items-center gap-1 ${color} text-xs font-semibold
                       opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
        Learn more <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Brain,
    title: 'AI Study Assistant',
    desc: 'Get instant explanations, generate practice questions, and create personalised study plans — all powered by AI trained on Nigerian curricula.',
    color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100'
  },
  {
    icon: FileText,
    title: 'Past Questions Bank',
    desc: 'Access years of past exam papers organised by institution, department, course code, and year. Never be caught off guard in an exam.',
    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100'
  },
  {
    icon: BarChart3,
    title: 'CBT Practice Tests',
    desc: 'Timed mock exams that mirror your actual semester papers. Instant grading, detailed explanations, and performance tracking.',
    color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100'
  },
  {
    icon: BookOpen,
    title: 'Course Materials',
    desc: 'Curated lecture notes, slides, and textbook summaries — organised by your institution, faculty, department, and course code.',
    color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100'
  },
  {
    icon: Target,
    title: 'Weak Topic Detection',
    desc: 'KampusLearn tracks every question you answer and automatically identifies where you need the most work before your exams.',
    color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100'
  },
  {
    icon: Zap,
    title: 'Exam Crash Mode',
    desc: 'Three days to your exam? Select your course and get an AI-generated crash plan with the most likely topics, mock tests, and rapid summaries.',
    color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100'
  },
];

const INSTITUTIONS = [
  { name: 'University of Maiduguri', short: 'UNIMAID', type: 'University',  from: 'from-blue-500',    to: 'to-blue-700',    ring: 'ring-blue-200'    },
  { name: 'Ramat Polytechnic',       short: 'RAMAT',   type: 'Polytechnic', from: 'from-purple-500',  to: 'to-purple-700',  ring: 'ring-purple-200'  },
  { name: 'Borno State University',  short: 'BOSU',    type: 'University',  from: 'from-emerald-500', to: 'to-emerald-700', ring: 'ring-emerald-200' },
];

const TESTIMONIALS = [
  { name: 'Fatima A.',      dept: 'Computer Engineering, 300L', text: 'The AI tutor explained transistor biasing better than three different lecturers. I scored 78 in my exam.',         avatar: 'F' },
  { name: 'Ibrahim M.',     dept: 'Accountancy, ND2',            text: 'Past questions bank is exactly what I needed. I could see the exam patterns immediately.',                          avatar: 'I' },
  { name: 'Aisha K.',       dept: 'Computer Science, 200L',      text: 'I used the CBT practice every night for two weeks. Went from 45% to 71% in my mock tests.',                       avatar: 'A' },
];

const NAV_LINKS = [
  { label: 'Features',     href: '#features'     },
  { label: 'How It Works', href: '#how-it-works'  },
  { label: 'Institutions', href: '#institutions'  },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500
        ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700
                              rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-xl text-gray-900 tracking-tight">KampusLearn</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map(link => (
                <a key={link.href} href={link.href}
                   className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login"
                    className="text-sm font-semibold text-gray-600 hover:text-gray-900
                               transition-colors px-4 py-2 rounded-xl hover:bg-gray-100">
                Log in
              </Link>
              <Link href="/register"
                    className="bg-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl
                               hover:bg-blue-700 transition-all shadow-lg shadow-blue-200
                               hover:shadow-blue-300 hover:-translate-y-0.5">
                Get Started for Free
              </Link>
            </div>

            <button className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
                    onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-100
                          px-4 py-4 space-y-1 shadow-xl">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href}
                 className="block text-gray-700 font-medium py-2.5 px-3 rounded-xl hover:bg-gray-50"
                 onClick={() => setMenuOpen(false)}>{link.label}</a>
            ))}
            <hr className="border-gray-100 my-2" />
            <Link href="/login"    className="block text-gray-600 font-medium py-2.5 px-3 rounded-xl hover:bg-gray-50">Log in</Link>
            <Link href="/register" className="block bg-blue-600 text-white text-center font-bold px-4 py-3 rounded-xl mt-2">
              Get Started for Free
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden
                          bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-4 pt-16">

        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-blue-600/20
                          rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-[400px] h-[400px] bg-purple-600/15
                          rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                          w-[700px] h-[700px] bg-blue-500/5 rounded-full blur-3xl" />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.03]"
               style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="relative max-w-6xl mx-auto w-full py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left — Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/20
                              text-blue-300 text-xs font-semibold px-4 py-2 rounded-full mb-6 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                AI-Powered Learning Platform
              </div>

              <h1 className="text-5xl sm:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
                Study Smarter.
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300
                                 bg-clip-text text-transparent">
                  Pass Every Exam.
                </span>
              </h1>

              <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
                KampusLearn gives Nigerian university and polytechnic students an AI tutor,
                past questions, CBT practice, and course materials — all in one place,
                completely free.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link href="/register"
                      className="inline-flex items-center justify-center gap-2 bg-blue-600
                                 text-white font-bold px-8 py-4 rounded-2xl hover:bg-blue-500
                                 transition-all shadow-2xl shadow-blue-600/40 text-base
                                 hover:-translate-y-0.5 hover:shadow-blue-500/50">
                  Start Learning for Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/login"
                      className="inline-flex items-center justify-center gap-2 bg-white/8
                                 text-white font-semibold px-8 py-4 rounded-2xl border
                                 border-white/15 hover:bg-white/15 transition-all text-base
                                 backdrop-blur-sm">
                  I have an account
                </Link>
              </div>

              <div className="flex flex-wrap gap-5 text-sm text-slate-400">
                {['100% Free', 'No credit card', 'Built for Nigeria'].map(t => (
                  <span key={t} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — Floating UI mockups */}
            <div className="relative hidden lg:block h-[500px]">

              {/* Main chat card */}
              <FloatingCard className="absolute top-0 right-0 w-72">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white text-sm font-semibold">AI Tutor</span>
                  <div className="ml-auto w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="bg-white/10 rounded-xl rounded-tl-sm p-3 text-xs text-slate-300 leading-relaxed">
                    Explain what an operating system is in simple terms
                  </div>
                  <div className="bg-blue-600/40 rounded-xl rounded-tr-sm p-3 text-xs text-blue-100 leading-relaxed">
                    An operating system is the software that manages all other programs on your computer. Think of it as the school principal — it coordinates everything...
                  </div>
                </div>
              </FloatingCard>

              {/* CBT score card */}
              <FloatingCard className="absolute top-48 -left-4 w-56">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-green-400" />
                  <span className="text-white text-xs font-semibold">CBT Result</span>
                </div>
                <div className="text-center py-2">
                  <p className="text-4xl font-black text-green-400">78%</p>
                  <p className="text-slate-400 text-xs mt-1">CPE301 Mock Test</p>
                  <div className="mt-3 bg-white/10 rounded-full h-1.5">
                    <div className="bg-green-400 h-1.5 rounded-full" style={{ width: '78%' }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>31/40 correct</span>
                  <span className="text-green-400 font-semibold">Passed ✓</span>
                </div>
              </FloatingCard>

              {/* Past questions card */}
              <FloatingCard className="absolute bottom-10 right-4 w-64">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-white text-xs font-semibold">Past Questions</span>
                </div>
                {[
                  { code: 'CPE301', year: '2024', type: 'Semester' },
                  { code: 'CSC202', year: '2023', type: 'Mock'     },
                  { code: 'EEE101', year: '2024', type: 'Semester' },
                ].map((pq, i) => (
                  <div key={i} className="flex items-center justify-between py-2
                                          border-b border-white/10 last:border-0">
                    <div>
                      <p className="text-white text-xs font-semibold">{pq.code}</p>
                      <p className="text-slate-400 text-xs">{pq.type} · {pq.year}</p>
                    </div>
                    <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <ArrowRight className="w-3 h-3 text-purple-400" />
                    </div>
                  </div>
                ))}
              </FloatingCard>

              {/* Knowledge badge */}
              <FloatingCard className="absolute top-80 right-8 w-44">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-400" />
                  <span className="text-white text-xs font-semibold">Knowledge</span>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    { label: 'Strong', pct: 60, color: 'bg-green-400'  },
                    { label: 'Medium', pct: 30, color: 'bg-yellow-400' },
                    { label: 'Weak',   pct: 10, color: 'bg-red-400'    },
                  ].map(k => (
                    <div key={k.label}>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>{k.label}</span><span>{k.pct}%</span>
                      </div>
                      <div className="bg-white/10 rounded-full h-1">
                        <div className={`${k.color} h-1 rounded-full`} style={{ width: `${k.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </FloatingCard>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2">
            <div className="w-1 h-3 bg-white/40 rounded-full" />
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────── */}
      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '3',   suffix: '',  label: 'Institutions',   icon: Shield     },
              { value: '63',  suffix: '+', label: 'Courses',        icon: BookOpen   },
              { value: '100', suffix: '%', label: 'Free Forever',   icon: Star       },
              { value: '24',  suffix: '/7', label: 'AI Available',  icon: Brain      },
            ].map(stat => (
              <div key={stat.label} className="group">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center
                                mx-auto mb-3 group-hover:bg-blue-100 transition-colors">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-3xl font-black text-gray-900">
                  <Counter end={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BANNER ────────────────────────────── */}
      <section className="py-10 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <p className="text-lg font-semibold text-blue-100">
            Designed for students at{' '}
            <span className="text-white font-black">UNIMAID</span>,{' '}
            <span className="text-white font-black">RAMAT</span>, and{' '}
            <span className="text-white font-black">BOSU</span>{' '}
            — with more institutions coming soon.
          </p>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 text-blue-600 text-sm font-bold
                             uppercase tracking-wider bg-blue-50 px-4 py-2 rounded-full">
              <Zap className="w-4 h-4" /> Platform Features
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mt-4 mb-4 tracking-tight">
              Everything you need
              <br />
              <span className="text-blue-600">to ace your courses</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Not just another PDF dump. KampusLearn is a complete academic operating system
              built specifically for Nigerian tertiary students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 text-purple-600 text-sm font-bold
                             uppercase tracking-wider bg-purple-50 px-4 py-2 rounded-full">
              <CheckCircle className="w-4 h-4" /> Simple Process
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mt-4 mb-4">
              Up and running
              <br />in 2 minutes
            </h2>
            <p className="text-gray-500 text-lg">
              No setup. No tutorials. Just pick your school and start.
            </p>
          </div>

          <div className="relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-10 left-[10%] right-[10%] h-0.5
                            bg-gradient-to-r from-blue-200 via-purple-200 to-green-200" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { step: '01', icon: Users,          title: 'Create account',   desc: 'Sign up with your institution, department, and level.',                        color: 'bg-blue-600',   ring: 'ring-blue-100'   },
                { step: '02', icon: BookOpen,        title: 'Pick your course', desc: 'Browse courses for your level and semester.',                                 color: 'bg-purple-600', ring: 'ring-purple-100' },
                { step: '03', icon: Brain,           title: 'Study with AI',    desc: 'Ask questions, get explanations, and generate quizzes.',                      color: 'bg-indigo-600', ring: 'ring-indigo-100' },
                { step: '04', icon: Award,           title: 'Track progress',   desc: 'Take CBT tests and watch your knowledge score grow.',                         color: 'bg-green-600',  ring: 'ring-green-100'  },
              ].map((item, i) => (
                <div key={item.step} className="text-center group">
                  <div className={`relative w-20 h-20 ${item.color} rounded-2xl flex items-center
                                   justify-center mx-auto mb-5 shadow-lg ring-8 ${item.ring}
                                   group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className="w-9 h-9 text-white" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900 rounded-full
                                    flex items-center justify-center">
                      <span className="text-white text-xs font-black">{i + 1}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI SPOTLIGHT ───────────────────────────────────── */}
      <section className="py-24 px-4 overflow-hidden
                          bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="text-white">
              <span className="inline-flex items-center gap-2 text-blue-300 text-sm font-bold
                               uppercase tracking-wider bg-blue-500/10 border border-blue-400/20
                               px-4 py-2 rounded-full mb-6">
                <Brain className="w-4 h-4" /> AI Study Assistant
              </span>
              <h2 className="text-4xl sm:text-5xl font-black leading-tight mb-6">
                Your personal tutor,
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400
                                 bg-clip-text text-transparent">
                  available 24/7
                </span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed mb-8">
                Ask any question about your course. The AI explains concepts clearly,
                generates practice questions, creates revision summaries, and builds
                personalised study plans — all tuned to Nigerian university curricula.
              </p>
              <div className="space-y-3">
                {[
                  'Explains difficult concepts in simple language',
                  'Generates exam-style practice questions',
                  'Creates 7-day study crash plans',
                  'Identifies your weak topics automatically',
                ].map(point => (
                  <div key={point} className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center
                                    justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <span className="text-slate-300 text-sm">{point}</span>
                  </div>
                ))}
              </div>
              <Link href="/register"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold
                               px-7 py-3.5 rounded-xl hover:bg-blue-500 transition-all mt-8
                               shadow-xl shadow-blue-600/30 text-sm">
                Try the AI Tutor Free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* AI conversation mockup */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">KampusLearn AI</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-green-400 text-xs">Online</span>
                  </div>
                </div>
                <span className="ml-auto text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">
                  CPE301 · Networks
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center
                                  justify-center text-white text-xs font-bold flex-shrink-0 mt-1">U</div>
                  <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-slate-300 text-sm">
                    What is the difference between TCP and UDP? I keep confusing them in exams.
                  </div>
                </div>

                <div className="flex gap-3 flex-row-reverse">
                  <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center
                                  justify-center flex-shrink-0 mt-1">
                    <Brain className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-blue-600/30 rounded-2xl rounded-tr-sm px-4 py-3 text-blue-100 text-sm leading-relaxed">
                    <p className="font-semibold text-white mb-2">Great question! Here's the key difference:</p>
                    <p><span className="text-blue-300 font-semibold">TCP</span> is like sending a registered letter — it guarantees delivery, checks for errors, and resends if something is lost. Use it when accuracy matters (websites, email).</p>
                    <p className="mt-2"><span className="text-cyan-300 font-semibold">UDP</span> is like shouting across a room — fast but no guarantee. Use it when speed matters more than perfection (video calls, gaming).</p>
                    <p className="mt-2 text-blue-200 text-xs">Want me to generate 5 past exam questions on this topic?</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  {['Generate practice questions', 'Explain TCP handshake', 'Create study summary'].map(s => (
                    <span key={s} className="text-xs bg-white/10 text-slate-400 px-3 py-1.5
                                             rounded-full border border-white/10 cursor-pointer
                                             hover:bg-white/15 hover:text-white transition-colors">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────── */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 text-green-600 text-sm font-bold
                             uppercase tracking-wider bg-green-50 px-4 py-2 rounded-full">
              <Star className="w-4 h-4" /> Student Stories
            </span>
            <h2 className="text-4xl font-black text-gray-900 mt-4 mb-3">
              What students are saying
            </h2>
            <p className="text-gray-500">Real experiences from students using KampusLearn</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100
                                      shadow-sm hover:shadow-md transition-shadow">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5 italic">
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700
                                  rounded-full flex items-center justify-center text-white
                                  font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.dept}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INSTITUTIONS ───────────────────────────────────── */}
      <section id="institutions" className="py-24 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 text-orange-600 text-sm font-bold
                             uppercase tracking-wider bg-orange-50 px-4 py-2 rounded-full">
              <GraduationCap className="w-4 h-4" /> Coverage
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mt-4 mb-4">
              Built for Nigerian students
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Locally built, nationally relevant. Starting in Borno State,
              expanding across Nigeria.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {INSTITUTIONS.map(inst => (
              <div key={inst.short}
                   className="group relative overflow-hidden bg-white rounded-3xl border
                              border-gray-100 shadow-sm hover:shadow-xl transition-all
                              duration-500 hover:-translate-y-2">
                {/* Gradient top */}
                <div className={`h-32 bg-gradient-to-br ${inst.from} ${inst.to}
                                 flex items-center justify-center relative overflow-hidden`}>
                  <div className="absolute inset-0 opacity-10"
                       style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, white 0%, transparent 60%)' }} />
                  <div className="relative text-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl
                                    flex items-center justify-center mx-auto mb-1 border border-white/30">
                      <span className="text-white font-black text-lg">{inst.short}</span>
                    </div>
                  </div>
                </div>
                {/* Card body */}
                <div className="p-5 text-center">
                  <h3 className="font-bold text-gray-900 mb-1 text-sm">{inst.name}</h3>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-gray-500">{inst.type} · Maiduguri, Borno</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-gray-400 text-sm">
              More institutions being added.{' '}
              <Link href="/register" className="text-blue-600 font-semibold hover:underline">
                Request your institution →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────── */}
      <section className="py-24 px-4 relative overflow-hidden
                          bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.02]"
               style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
        </div>

        <div className="relative max-w-3xl mx-auto text-center text-white">
          <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center
                          mx-auto mb-6 border border-blue-400/20">
            <GraduationCap className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
            Let's help you
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400
                             bg-clip-text text-transparent">
              ace your courses.
            </span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto">
            Join students already using KampusLearn to study smarter
            and walk into exams with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600
                             text-white font-bold px-10 py-4 rounded-2xl hover:bg-blue-500
                             transition-all shadow-2xl shadow-blue-600/30 text-base
                             hover:-translate-y-0.5">
              Create Free Account
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-white/8
                             text-white font-semibold px-10 py-4 rounded-2xl border
                             border-white/15 hover:bg-white/15 transition-all text-base">
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="py-12 px-4 bg-gray-950 border-t border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-black text-lg">KampusLearn</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-gray-500">
              {['Features', 'How It Works', 'Institutions'].map(l => (
                <a key={l} href={`#${l.toLowerCase().replace(' ', '-')}`}
                   className="hover:text-white transition-colors">{l}</a>
              ))}
              <Link href="/login"    className="hover:text-white transition-colors">Log in</Link>
              <Link href="/register" className="hover:text-white transition-colors">Register</Link>
              <Link href="/admin"    className="hover:text-white transition-colors">Admin</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row
                          items-center justify-between gap-3 text-xs text-gray-600">
            <p>© 2026 KampusLearn. Your study mate.</p>
            <p>Built with ❤️ for Nigerian students · Maiduguri, Borno State</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
