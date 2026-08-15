'use client';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import {
  Bell, CheckCheck, Trash2, Info,
  CheckCircle, AlertTriangle, Clock,
  Loader2, BellOff
} from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_CONFIG = {
  info:             { icon: Info,          color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  success:          { icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100'  },
  warning:          { icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100'  },
  session_reminder: { icon: Clock,         color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  exam_reminder:    { icon: Bell,          color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100'    },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function NotificationItem({ notif, onRead, onDelete }) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div className={`group relative flex gap-4 p-5 rounded-2xl border transition-all duration-200
                     hover:shadow-md cursor-pointer
                     ${notif.is_read
                       ? 'bg-white border-gray-100'
                       : `${cfg.bg} ${cfg.border} shadow-sm`}`}
         onClick={() => !notif.is_read && onRead(notif.id)}>

      {/* Unread dot */}
      {!notif.is_read && (
        <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-blue-600 rounded-full" />
      )}

      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                       ${notif.is_read ? 'bg-gray-100' : cfg.bg}`}>
        <Icon className={`w-5 h-5 ${notif.is_read ? 'text-gray-400' : cfg.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <p className={`text-sm font-semibold mb-0.5
                       ${notif.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
          {notif.title}
        </p>
        <p className={`text-sm leading-relaxed
                       ${notif.is_read ? 'text-gray-400' : 'text-gray-600'}`}>
          {notif.body}
        </p>
        <p className="text-xs text-gray-400 mt-2">{timeAgo(notif.created_at)}</p>
      </div>

      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(notif.id); }}
        className="absolute bottom-4 right-4 p-1.5 text-gray-300 hover:text-red-500
                   hover:bg-red-50 rounded-lg transition-colors opacity-0
                   group-hover:opacity-100">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? '?unread_only=true' : '';
      const res = await api.get(`/notifications${params}`);
      setNotifications(res.data.data.notifications);
      setUnreadCount(res.data.data.unread_count);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed');
    }
  };

  const deleteNotif = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <AppLayout title="Notifications">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
            <p className="text-gray-500 text-sm mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
                    className="flex items-center gap-2 text-sm text-blue-600 font-semibold
                               hover:text-blue-700 bg-blue-50 hover:bg-blue-100
                               px-4 py-2 rounded-xl transition-colors">
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { value: 'all',    label: 'All'    },
            { value: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
          ].map(tab => (
            <button key={tab.value} onClick={() => setFilter(tab.value)}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
                      ${filter === tab.value
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center
                            justify-center mx-auto mb-4">
              <BellOff className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-semibold">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {filter === 'unread'
                ? 'Switch to All to see your notification history'
                : "You're all caught up! We'll notify you of important updates."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <NotificationItem
                key={notif.id}
                notif={notif}
                onRead={markRead}
                onDelete={deleteNotif}
              />
            ))}
          </div>
        )}

        {/* Info footer */}
        {notifications.length > 0 && (
          <p className="text-center text-xs text-gray-400 pb-4">
            Click a notification to mark it as read · Hover to delete
          </p>
        )}
      </div>
    </AppLayout>
  );
}
