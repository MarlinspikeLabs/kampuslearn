'use client';
import { Menu, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function TopBar({ onMenuClick, title }) {
  const { user } = useAuth();
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center
                       justify-between px-4 sm:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-gray-900 text-lg">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <Bell className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center
                        text-white font-bold text-sm">
          {user?.full_name?.charAt(0) || 'S'}
        </div>
      </div>
    </header>
  );
}
