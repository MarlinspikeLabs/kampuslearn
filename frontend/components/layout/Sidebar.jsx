'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, FileText, Brain,
  BarChart3, Bell, LogOut, GraduationCap, X, Coins
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { href: '/dashboard',        icon: LayoutDashboard, label: 'Dashboard'      },
  { href: '/courses',          icon: BookOpen,        label: 'Courses'        },
  { href: '/materials',        icon: FileText,        label: 'Materials'      },
  { href: '/past-questions',   icon: FileText,        label: 'Past Questions' },
  { href: '/exams',            icon: BarChart3,       label: 'CBT Practice'   },
  { href: '/ai-chat',          icon: Brain,           label: 'AI Tutor'       },
  { href: '/tokens',           icon: Coins,           label: 'Wallet'   },
];

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { user, profile, sub, logout } = useAuth();

  return (
    <>
      {/* Backdrop (mobile) */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden"
             onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-40
        flex flex-col transform transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">KampusLearn</span>
          </Link>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center
                            text-white font-bold text-sm flex-shrink-0">
              {user?.full_name?.charAt(0) || 'S'}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{user?.full_name}</p>
              <p className="text-gray-400 text-xs truncate">
                {profile?.institution_short || ''} · {profile?.level || ''} Level
              </p>
            </div>
          </div>
          {sub && (
            <div className="mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                ${sub.plan === 'premium'
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-gray-700 text-gray-400'}`}>
                {sub.plan === 'premium' ? '⭐ Premium' : 'Free Plan'}
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                      font-medium transition-colors
                      ${active
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 space-y-1">
          <Link href="/notifications"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                           text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
            Notifications
          </Link>
          <button onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                             text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
