'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  notificationsApi,
  resolveVerifiedAdminContext,
  NotificationItemDto,
  NotificationCategory,
} from '@/lib/api';
import {
  Bell,
  Check,
  CheckCheck,
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  BookOpen,
  ShieldCheck,
  ExternalLink,
  Inbox,
  Settings,
} from 'lucide-react';

export function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export function getCategoryMeta(category: NotificationCategory) {
  switch (category) {
    case 'STUDENT':
      return {
        label: 'Students',
        icon: <Users size={14} />,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        iconBg: 'bg-blue-50 text-blue-600',
      };
    case 'TEACHER':
      return {
        label: 'Faculty',
        icon: <GraduationCap size={14} />,
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        iconBg: 'bg-indigo-50 text-indigo-600',
      };
    case 'ATTENDANCE':
      return {
        label: 'Attendance',
        icon: <CalendarCheck size={14} />,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        iconBg: 'bg-amber-50 text-amber-600',
      };
    case 'FEE':
      return {
        label: 'Finance',
        icon: <CreditCard size={14} />,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconBg: 'bg-emerald-50 text-emerald-600',
      };
    case 'ACADEMIC':
      return {
        label: 'Academic',
        icon: <BookOpen size={14} />,
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        iconBg: 'bg-purple-50 text-purple-600',
      };
    case 'ADMIN':
    default:
      return {
        label: 'Admin',
        icon: <ShieldCheck size={14} />,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        iconBg: 'bg-slate-100 text-slate-600',
      };
  }
}

export interface NotificationBellProps {
  role?: 'ADMIN' | 'TEACHER' | 'STUDENT';
  notificationsUrl?: string;
  preferencesUrl?: string;
  apiPrefix?: string;
}

export function NotificationBell({
  role = 'ADMIN',
  notificationsUrl,
  preferencesUrl,
  apiPrefix,
}: NotificationBellProps = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [items, setItems] = useState<NotificationItemDto[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveNotificationsUrl =
    notificationsUrl ||
    (role === 'TEACHER'
      ? '/teacher/notifications'
      : role === 'STUDENT'
      ? '/student/notifications'
      : '/admin/notifications');

  const effectivePreferencesUrl =
    preferencesUrl ||
    (role === 'TEACHER'
      ? '/teacher/settings'
      : role === 'STUDENT'
      ? '/student/settings'
      : '/admin/settings');

  const effectiveApiPrefix =
    apiPrefix ||
    (role === 'TEACHER'
      ? '/api/teachers/notifications'
      : role === 'STUDENT'
      ? '/api/students/notifications'
      : '');

  const loadUnreadCount = useCallback(async (instId?: string) => {
    try {
      if (role === 'TEACHER' || role === 'STUDENT') {
        const res = await fetch(`${effectiveApiPrefix}/unread-count`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
        }
        return;
      }

      // Admin role handling
      let targetId = instId;
      if (!targetId) {
        const ctx = await resolveVerifiedAdminContext();
        targetId = ctx.instituteId;
        setInstituteId(targetId);
      }
      if (!targetId) return;
      const res = await notificationsApi.getUnreadCount(targetId);
      setUnreadCount(res.unreadCount);
    } catch {
      // Silently show 0 unread if API is unreachable or user unauthorized
    }
  }, [role, effectiveApiPrefix]);

  const loadDropdownItems = useCallback(
    async (instId: string | null, unreadOnly: boolean) => {
      setLoadingList(true);
      try {
        if (role === 'TEACHER' || role === 'STUDENT') {
          const res = await fetch(
            `${effectiveApiPrefix}?page=1&limit=8&status=${unreadOnly ? 'UNREAD' : 'ALL'}`,
            { headers: { Accept: 'application/json' } },
          );
          if (res.ok) {
            const data = await res.json();
            setItems(data.data || []);
            setUnreadCount(data.unreadCount ?? 0);
          } else {
            setItems([]);
          }
          return;
        }

        // Admin
        if (!instId) return;
        const res = await notificationsApi.getNotifications(instId, {
          page: 1,
          limit: 8,
          status: unreadOnly ? 'UNREAD' : 'ALL',
        });
        setItems(res.data);
        setUnreadCount(res.unreadCount);
      } catch {
        setItems([]);
      } finally {
        setLoadingList(false);
      }
    },
    [role, effectiveApiPrefix],
  );

  useEffect(() => {
    loadUnreadCount();

    const handleSync = () => {
      loadUnreadCount(instituteId || undefined);
    };
    window.addEventListener('bible-lms:notifications-updated', handleSync);
    return () => {
      window.removeEventListener('bible-lms:notifications-updated', handleSync);
    };
  }, [loadUnreadCount, instituteId]);

  useEffect(() => {
    if (open) {
      loadDropdownItems(instituteId, filterUnreadOnly);
    }
  }, [open, instituteId, filterUnreadOnly, loadDropdownItems]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleMarkOneRead = async (
    e: React.MouseEvent,
    notif: NotificationItemDto,
  ) => {
    e.stopPropagation();
    if (notif.isRead) return;
    try {
      if (role === 'TEACHER' || role === 'STUDENT') {
        await fetch(`${effectiveApiPrefix}/${notif.id}/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (instituteId) {
        await notificationsApi.markAsRead(instituteId, notif.id);
      }
      setItems((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      window.dispatchEvent(new CustomEvent('bible-lms:notifications-updated'));
    } catch {
      // Ignore transient failure
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      if (role === 'TEACHER' || role === 'STUDENT') {
        const res = await fetch(effectiveApiPrefix, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'ALL' }),
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
        }
      } else if (instituteId) {
        const res = await notificationsApi.markAllAsRead(instituteId);
        setUnreadCount(res.unreadCount);
      }
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent('bible-lms:notifications-updated'));
    } catch {
      // Ignore transient failure
    }
  };

  const handleNotificationNavigate = async (notif: NotificationItemDto) => {
    if (!notif.isRead) {
      try {
        if (role === 'TEACHER' || role === 'STUDENT') {
          await fetch(`${effectiveApiPrefix}/${notif.id}/read`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
          });
        } else if (instituteId) {
          await notificationsApi.markAsRead(instituteId, notif.id);
        }
        setUnreadCount((c) => Math.max(0, c - 1));
        window.dispatchEvent(new CustomEvent('bible-lms:notifications-updated'));
      } catch {}
    }
    setOpen(false);
    const destination = (notif.link || effectiveNotificationsUrl).split('#')[0];
    router.push(destination);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
        aria-label={`Notifications${
          unreadCount > 0 ? ` (${unreadCount} unread)` : ''
        }`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] sm:w-[400px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterUnreadOnly((prev) => !prev)}
                className={`text-[11px] font-medium px-2 py-1 rounded-lg border transition cursor-pointer ${
                  filterUnreadOnly
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Unread only
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <CheckCheck size={13} />
                  <span>Mark all</span>
                </button>
              )}
            </div>
          </div>

          {/* Notification Items List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loadingList ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((k) => (
                  <div key={k} className="animate-pulse flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                  <Inbox size={20} />
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {filterUnreadOnly
                    ? 'You have no unread notifications'
                    : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Real-time alerts from admissions, fees, attendance, and
                  faculty updates will appear here.
                </p>
              </div>
            ) : (
              items.map((notif) => {
                const cat = getCategoryMeta(notif.category);
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationNavigate(notif)}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition cursor-pointer ${
                      !notif.isRead ? 'bg-blue-50/35' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cat.iconBg}`}
                    >
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cat.badgeClass}`}
                        >
                          {cat.label}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-1 truncate ${
                          !notif.isRead
                            ? 'font-bold text-slate-900'
                            : 'font-semibold text-slate-700'
                        }`}
                      >
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                        {notif.body}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkOneRead(e, notif)}
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition shrink-0 cursor-pointer"
                        title="Mark as read"
                      >
                        <Check size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href={effectivePreferencesUrl}
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition"
            >
              <Settings size={13} />
              <span>Preferences</span>
            </Link>
            <Link
              href={effectiveNotificationsUrl}
              onClick={() => setOpen(false)}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition"
            >
              <span>Open Notification Center</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

