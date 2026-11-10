'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  Search,
  RefreshCw,
  Inbox,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CalendarCheck,
  Users,
  ShieldCheck,
  Sparkles,
  Radio,
  FileCheck2,
  GraduationCap,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { StudentShell } from '@/components/layout/student-shell';
import {
  useStudentNotifications,
  NotificationCategory,
  NotificationItem,
} from '@/lib/use-student-notifications';
import {
  getCategoryMeta,
  formatRelativeTime,
} from '@/components/notifications/notification-bell';

const STUDENT_CATEGORY_FILTERS: Array<{
  key: 'ALL' | NotificationCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: 'ALL', label: 'All Alerts', icon: <Bell size={14} /> },
  { key: 'ACADEMIC', label: 'Studies & Lectures', icon: <BookOpen size={14} /> },
  { key: 'ATTENDANCE', label: 'Attendance', icon: <CalendarCheck size={14} /> },
  { key: 'ADMIN', label: 'Notices', icon: <ShieldCheck size={14} /> },
];

export default function StudentNotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    byCategory,
    total,
    page,
    totalPages,
    category,
    status,
    search,
    loading,
    refreshing,
    error,
    setPage,
    setCategory,
    setStatus,
    setSearch,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useStudentNotifications({ initialLimit: 12 });

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    const targetUrl = (notif.cleanLink || notif.link || '/student').split('#')[0];
    if (targetUrl && targetUrl !== '/') {
      router.push(targetUrl);
    }
  };

  return (
    <StudentShell pageTitle="Notifications">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-100 text-[#2563EB] rounded-xl shadow-xs">
                <Bell size={20} />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Student Notification Center
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live updates for your enrolled courses, upcoming live classes, examinations, and institute announcements.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => refresh()}
              disabled={loading || refreshing}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title="Refresh alerts"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="px-4 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <CheckCheck size={14} />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Metrics Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Alerts</span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Bell size={16} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{total}</span>
              <span className="text-[11px] text-slate-400 font-medium">recorded</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Unread Alerts</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                <Sparkles size={16} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#2563EB]">{unreadCount}</span>
              <span className="text-[11px] text-blue-600 font-medium">pending</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Study Updates</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <BookOpen size={16} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{byCategory.ACADEMIC || 0}</span>
              <span className="text-[11px] text-purple-600 font-medium">unread</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Attendance</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <CalendarCheck size={16} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{byCategory.ATTENDANCE || 0}</span>
              <span className="text-[11px] text-amber-600 font-medium">unread</span>
            </div>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search study alerts and notices..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Read / Unread Status Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start md:self-auto">
              {(['ALL', 'UNREAD', 'READ'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatus(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    status === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? 'All Alerts' : st === 'UNREAD' ? 'Unread Only' : 'Read'}
                </button>
              ))}
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
            {STUDENT_CATEGORY_FILTERS.map((cat) => {
              const isSelected = category === cat.key;
              const unreadForCategory =
                cat.key === 'ALL' ? unreadCount : byCategory[cat.key as NotificationCategory] || 0;

              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    setCategory(cat.key);
                    setPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                    isSelected
                      ? 'bg-[#2563EB] text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  {unreadForCategory > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-white text-[#2563EB]' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {unreadForCategory}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification Feed List */}
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs animate-pulse flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-rose-200">
              <AlertCircle size={32} className="mx-auto text-rose-500 mb-2" />
              <h3 className="text-sm font-bold text-slate-900">Failed to load alerts</h3>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
              <button
                onClick={() => refresh()}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 px-6 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Inbox size={26} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {status === 'UNREAD'
                  ? 'All caught up! No unread notifications'
                  : search
                  ? 'No matching notifications found'
                  : 'No alerts in this category'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {search
                  ? `No alerts matched your search query "${search}". Try searching with different keywords.`
                  : 'When your instructors post new lessons, schedule live classes, publish exam results or send attendance alerts, you will see them here.'}
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="mt-4 px-4 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            notifications.map((notif) => {
              const meta = getCategoryMeta(notif.category);
              const targetUrl = (notif.cleanLink || notif.link || '').split('#')[0];
              const hasActionLink = Boolean(targetUrl && targetUrl !== '/' && targetUrl !== '/student/notifications');

              return (
                <div
                  key={notif.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition group ${
                    !notif.isRead
                      ? 'bg-blue-50/20 border-blue-200/80 shadow-xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Category Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs mt-0.5 ${meta.iconBg}`}
                    >
                      {notif.eventType?.includes('LIVE_CLASS') ? (
                        <Radio size={18} />
                      ) : notif.eventType?.includes('ASSIGNMENT') ? (
                        <FileCheck2 size={18} />
                      ) : notif.eventType?.includes('EXAM') ? (
                        <GraduationCap size={18} />
                      ) : (
                        meta.icon
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>

                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" title="Unread" />
                        )}

                        <span className="text-[11px] text-slate-400 font-medium ml-auto flex items-center gap-1">
                          <Clock size={12} />
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      <h4
                        onClick={() => handleNotificationClick(notif)}
                        className={`text-sm tracking-tight cursor-pointer hover:text-blue-600 transition ${
                          !notif.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                        }`}
                      >
                        {notif.title}
                      </h4>

                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {notif.body}
                      </p>

                      {/* Action Links & Footer Controls */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          {hasActionLink && (
                            <button
                              onClick={() => handleNotificationClick(notif)}
                              className="text-xs font-bold text-[#2563EB] hover:text-blue-800 flex items-center gap-1 transition cursor-pointer"
                            >
                              <span>Open Course Activity</span>
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          {!notif.isRead ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notif.id);
                              }}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition"
                            >
                              <Check size={13} />
                              <span>Mark Read</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                              <CheckCheck size={13} className="text-emerald-500" />
                              <span>Read</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">
              Page {page} of {totalPages} ({total} total alerts)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}

