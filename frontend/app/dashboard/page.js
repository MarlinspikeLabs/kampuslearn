'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Brain, FileText, BarChart3, BookOpen,
  TrendingUp, Target, Zap, ChevronRight,
  CheckCircle, Trophy, Star, ArrowRight
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-gray-900">{value ?? '—'}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, desc, gradient }) {
  return (
    <Link href={href}
          className="group relative overflow-hidden bg-white rounded-2xl p-5 border border-gray-100
                     shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
      <div className={`absolute top-0 right-0 w-24 h-24 ${gradient} opacity-10 rounded-full
                       -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500`} />
      <div className="relative flex items-center gap-4">
        <div className={`w-12 h-12 ${gradient} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{desc}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600
                                  group-hover:translate-x-1 transition-all flex-shrink-0" />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [stats, setStats]     = useState(null);
  const [knowledge, setKnowledge] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/knowledge/stats'),
      api.get('/ai/usage'),
    ])
      .then(([sRes, aRes]) => {
        setStats(sRes.data.data);
        setKnowledge(sRes.data.data.knowledge);
        setAiUsage(aRes.data.data);
      })
      .catch(() => {});
  }, []);

  const firstName = user?.full_name?.split(' ')[0] || 'Student';
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const readinessScore = stats?.exams?.avg_score ? parseFloat(stats.exams.avg_score) : 0;
  const readinessLabel = readinessScore >= 80 ? 'Exam Ready' :
                         readinessScore >= 60 ? 'Almost Ready' :
                         readinessScore >= 40 ? 'Needs Practice' : 'Just Starting';

  const QUICK_ACTIONS = [
    { href: '/ai-chat',        icon: Brain,     label: 'AI Tutor',         desc: 'Explain a topic or get quizzed',      gradient: 'bg-gradient-to-br from-blue-500 to-blue-600'    },
    { href: '/past-questions', icon: FileText,  label: 'Past Questions',   desc: 'Browse exam papers by course',         gradient: 'bg-gradient-to-br from-purple-500 to-purple-600' },
    { href: '/exams',          icon: BarChart3, label: 'CBT Practice',     desc: 'Take a timed mock exam',               gradient: 'bg-gradient-to-br from-green-500 to-green-600'   },
    { href: '/materials',      icon: BookOpen,  label: 'Course Materials', desc: 'Notes, slides and summaries',          gradient: 'bg-gradient-to-br from-orange-500 to-orange-600' },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="max-w-5xl mx-auto space-y-7">

        {/* Welcome banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700
                        to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-16 translate-x-16" />
          <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-12" />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-blue-200 text-sm font-medium mb-1">{greeting} 👋</p>
              <h2 className="text-2xl sm:text-3xl font-black mb-1">{firstName}!</h2>
              {profile && (
                <p className="text-blue-200 text-sm">
                  {profile.department_name} ({profile.department_code}) ·{' '}
                  <span className="text-white font-semibold">{profile.level} Level</span> ·{' '}
                  {profile.institution_short}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3
                            backdrop-blur-sm border border-white/20">
              <div className="text-right">
                <p className="text-xs text-blue-200">Avg Score</p>
                <p className="text-2xl font-black text-white">
                  {stats?.exams?.avg_score ? `${stats.exams.avg_score}%` : '—'}
                </p>
                <p className="text-xs text-blue-200">{readinessLabel}</p>
              </div>
              <Trophy className="w-8 h-8 text-yellow-300 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={BarChart3} label="Exams taken" color="bg-blue-100 text-blue-600"
            value={stats?.exams?.total_attempts ?? 0}
            sub={stats?.exams?.passed ? `${stats.exams.passed} passed` : 'None yet'}
            trend={stats?.exams?.total_attempts > 0 ? `Best ${stats?.exams?.best_score}%` : null}
          />
          <StatCard
            icon={TrendingUp} label="Avg score" color="bg-green-100 text-green-600"
            value={stats?.exams?.avg_score ? `${stats.exams.avg_score}%` : '—'}
            sub="Across all attempts"
          />
          <StatCard
            icon={Brain} label="AI messages" color="bg-purple-100 text-purple-600"
            value={aiUsage?.messages_today ?? 0}
            sub="Today's conversations"
          />
          <StatCard
            icon={Target} label="Topics tracked" color="bg-orange-100 text-orange-600"
            value={knowledge?.total_tracked ?? 0}
            sub={knowledge?.weak > 0 ? `${knowledge.weak} need work` : 'Keep practicing!'}
          />
        </div>

        {/* AI usage */}
        {aiUsage && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Brain className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">AI Tutor Usage</p>
                  <p className="text-xs text-gray-400">Resets every 24 hours</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{aiUsage.messages_today} messages</p>
                <p className="text-xs text-green-600 font-medium">Unlimited ✓</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK_ACTIONS.map(action => (
              <QuickAction key={action.href} {...action} />
            ))}
          </div>
        </div>

        {/* Knowledge overview */}
        {knowledge && parseInt(knowledge.total_tracked) > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Target className="w-4 h-4 text-orange-600" />
                </div>
                <p className="font-bold text-gray-900 text-sm">Knowledge Overview</p>
              </div>
              <Link href="/ai-chat"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Get help <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
                <p className="text-3xl font-black text-red-600">{knowledge.weak}</p>
                <p className="text-xs text-red-500 font-medium mt-1">Weak</p>
                <p className="text-xs text-red-400 mt-0.5">Need work</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 text-center border border-yellow-100">
                <p className="text-3xl font-black text-yellow-600">{knowledge.medium}</p>
                <p className="text-xs text-yellow-600 font-medium mt-1">Medium</p>
                <p className="text-xs text-yellow-500 mt-0.5">Getting there</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
                <p className="text-3xl font-black text-green-600">{knowledge.strong}</p>
                <p className="text-xs text-green-600 font-medium mt-1">Strong</p>
                <p className="text-xs text-green-500 mt-0.5">Well done</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
