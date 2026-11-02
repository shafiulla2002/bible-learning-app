'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  notificationsApi,
  resolveVerifiedAdminContext,
  NotificationCategory,
  NotificationItemDto,
  NotificationPreferencesDto,
} from '@/lib/api';
import {
  getCategoryMeta,
  formatRelativeTime,
} from '@/components/notifications/notification-bell';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CalendarCheck,
  CreditCard,
  Settings,
  Bell,
  Search,
  Check,
  CheckCheck,
  RefreshCw,
  SlidersHorizontal,
  Inbox,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  {
    label: 'Notifications',
    href: '/admin/notifications',
    icon: <Bell size={18} />,
  },
  {
    label: 'Students & Admissions',
    href: '/admin/students',
    icon: <Users size={18} />,
  },
  {
    label: 'Faculty & Teachers',
    href: '/admin/teachers',
    icon: <GraduationCap size={18} />,
  },
  {
    label: 'Courses & Curriculum',
    href: '/admin/courses',
    icon: <BookOpen size={18} />,
  },
  {
    label: 'Batches & Classes',
    href: '/admin/batches',
    icon: <Calendar size={18} />,
  },
  {
    label: 'Attendance',
    href: '/admin/attendance',
    icon: <CalendarCheck size={18} />,
  },
  {
    label: 'Finance & Payments',
    href: '/admin/finance',
    icon: <CreditCard size={18} />,
  },
  {
    label: 'Institute Settings',
    href: '/admin/settings',
    icon: <Settings size={18} />,
  },
];

const CATEGORY_TABS: Array<{
  key: 'ALL' | NotificationCategory;
  label: string;
}> = [
  { key: 'ALL', label: 'All Alerts' },
  { key: 'STUDENT', label: 'Students & Admissions' },
  { key: 'TEACHER', label: 'Faculty & Teachers' },
  { key: 'ATTENDANCE', label: 'Attendance' },
  { key: 'FEE', label: 'Fees & Invoicing' },
  { key: 'ACADEMIC', label: 'Academic Activities' },
  { key: 'ADMIN', label: 'Administration' },
];

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [instituteId, setInstituteId] = useState<string>('');
  const [instituteName, setInstituteName] = useState<string>('Bible Institute');
  const [viewerName, setViewerName] = useState<string>(
    'Institute Administrator',
  );
  const [viewerRole, setViewerRole] = useState<string>('INSTITUTE_ADMIN');

  const [categoryFilter, setCategoryFilter] = useState<
    'ALL' | NotificationCategory
  >('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>(
    'ALL',
  );
  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const limit = 12;

  const [notifications, setNotifications] = useState<NotificationItemDto[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [byCategory, setByCategory] = useState<
    Record<NotificationCategory, number>
  >({
    STUDENT: 0,
    TEACHER: 0,
    ATTENDANCE: 0,
    FEE: 0,
    ACADEMIC: 0,
    ADMIN: 0,
  });
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Notification preferences panel
  const [showPrefs, setShowPrefs] = useState<boolean>(false);
  const [prefs, setPrefs] = useState<NotificationPreferencesDto>({
    notifyOnStudentRegistration: true,
    notifyOnFeePayment: true,
    notifyOnAttendanceAlert: true,
    notifyOnTeacherManagement: true,
    notifyOnAcademicActivity: true,
    notifyOnAdminSecurity: true,
  });
  const [savingPrefs, setSavingPrefs] = useState<boolean>(false);
  const [prefsBanner, setPrefsBanner] = useState<string | null>(null);

  const canManagePreferences =
    viewerRole === 'SUPER_ADMIN' ||
    viewerRole === 'INSTITUTE_ADMIN' ||
    viewerRole === 'ACADEMIC_COORDINATOR';

  // Resolve verified institute context on mount
  useEffect(() => {
    let active = true;
    resolveVerifiedAdminContext()
      .then((ctx) => {
        if (!active) return;
        setInstituteId(ctx.instituteId);
        setInstituteName(ctx.displayName || ctx.instituteName);
        setViewerName(ctx.user.fullName);
        setViewerRole(ctx.user.role);
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(
          err?.message ||
            'Unable to verify institute session. Please sign in as an Institute Administrator.',
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await notificationsApi.getNotifications(instituteId, {
        page,
        limit,
        category: categoryFilter,
        status: statusFilter,
        search: appliedSearch || undefined,
      });
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);
      setByCategory(res.byCategory);
      setTotalItems(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [instituteId, page, limit, categoryFilter, statusFilter, appliedSearch]);

  useEffect(() => {
    if (instituteId) {
      fetchNotifications();
    }
  }, [instituteId, fetchNotifications]);

  // Load preferences when preferences panel opens
  useEffect(() => {
    if (showPrefs && instituteId && canManagePreferences) {
      notificationsApi
        .getPreferences(instituteId)
        .then((res) => setPrefs(res))
        .catch(() => {});
    }
  }, [showPrefs, instituteId, canManagePreferences]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleMarkAsRead = async (notif: NotificationItemDto) => {
    if (!instituteId || notif.isRead) return;
    try {
      await notificationsApi.markAsRead(instituteId, notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      setByCategory((prev) => ({
        ...prev,
        [notif.category]: Math.max(0, (prev[notif.category] || 0) - 1),
      }));
      window.dispatchEvent(new CustomEvent('bible-lms:notifications-updated'));
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    if (!instituteId || unreadCount === 0) return;
    try {
      await notificationsApi.markAllAsRead(instituteId, categoryFilter);
      await fetchNotifications();
      window.dispatchEvent(new CustomEvent('bible-lms:notifications-updated'));
    } catch {}
  };

  const handleSavePreferences = async () => {
    if (!instituteId || !canManagePreferences) return;
    setSavingPrefs(true);
    setPrefsBanner(null);
    try {
      const updated = await notificationsApi.updatePreferences(
        instituteId,
        prefs,
      );
      setPrefs(updated);
      setPrefsBanner('Notification preferences saved to Institute Settings.');
      setTimeout(() => setPrefsBanner(null), 4000);
    } catch (err: any) {
      setPrefsBanner(
        `Error: ${err?.message || 'Could not update preferences'}`,
      );
    } finally {
      setSavingPrefs(false);
    }
  };

  const roleLabel =
    viewerRole === 'FINANCE_OFFICER'
      ? 'Finance Officer'
      : viewerRole === 'ACADEMIC_COORDINATOR'
        ? 'Academic Coordinator'
        : viewerRole === 'SUPER_ADMIN'
          ? 'Super Administrator'
          : 'Institute Administrator';

  return (
    <PortalShell
      portalTitle="INSTITUTE ADMIN"
      portalRole="ADMIN"
      navItems={adminNav}
      userName={viewerName}
      userRoleLabel={roleLabel}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
              <Bell size={14} />
              <span>{instituteName} • Admin Alert Center</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Notification Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Real-time operational notifications from admissions, fee payments,
              attendance alerts, faculty updates, and institute governance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canManagePreferences && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrefs((prev) => !prev)}
                className="text-xs gap-1.5"
              >
                <SlidersHorizontal size={14} />
                <span>Preferences</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNotifications}
              className="text-xs gap-1.5"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={unreadCount === 0}
              onClick={handleMarkAllAsRead}
              className="text-xs gap-1.5"
            >
              <CheckCheck size={14} />
              <span>
                Mark{' '}
                {categoryFilter === 'ALL'
                  ? 'All'
                  : getCategoryMeta(categoryFilter).label}{' '}
                Read
              </span>
            </Button>
          </div>
        </div>

        {/* Collapsible Notification Preferences Panel (Integrated with Milestone 2.7 Settings) */}
        {showPrefs && canManagePreferences && (
          <Card className="p-5 sm:p-6 border border-blue-200/80 bg-blue-50/20 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Institute Notification Preferences
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure which operational events generate in-app
                  notifications for authorized institute administrators. Synced
                  with{' '}
                  <Link
                    href="/admin/settings"
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Institute Settings
                  </Link>
                  .
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSavePreferences}
                isLoading={savingPrefs}
                className="text-xs shrink-0"
              >
                Save Preferences
              </Button>
            </div>

            {prefsBanner && (
              <div
                className={`mt-3 px-3.5 py-2 rounded-xl text-xs font-medium ${
                  prefsBanner.startsWith('Error:')
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {prefsBanner}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {[
                {
                  key: 'notifyOnStudentRegistration' as const,
                  title: 'Admissions & Student Alerts',
                  desc: 'New student registrations, pending approvals, status updates',
                },
                {
                  key: 'notifyOnTeacherManagement' as const,
                  title: 'Teacher & Faculty Alerts',
                  desc: 'New faculty registrations, status changes, course/batch assignments',
                },
                {
                  key: 'notifyOnAttendanceAlert' as const,
                  title: 'Attendance Threshold Alerts',
                  desc: 'Alerts when batch attendance drops below institute threshold',
                },
                {
                  key: 'notifyOnFeePayment' as const,
                  title: 'Fee & Invoice Notifications',
                  desc: 'Payments received, reversals, invoices, overdue fee alerts',
                },
                {
                  key: 'notifyOnAcademicActivity' as const,
                  title: 'Academic Activity Alerts',
                  desc: 'New courses, batch cohorts, and scheduled live sessions',
                },
                {
                  key: 'notifyOnAdminSecurity' as const,
                  title: 'Administration & Security',
                  desc: 'Institute profile, branding, and user access status updates',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-start justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {item.desc}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[item.key])}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, [item.key]: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
          </Card>
        )}

        {/* Filters Bar: Category Tabs + Read/Unread + Search */}
        <Card className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {CATEGORY_TABS.map((tab) => {
              const isSelected = categoryFilter === tab.key;
              const badgeCount =
                tab.key === 'ALL' ? unreadCount : byCategory[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(tab.key);
                    setPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#1E2235] text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                  }`}
                >
                  <span>{tab.label}</span>
                  {badgeCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Status & Search Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl w-fit">
              {(
                [
                  { key: 'ALL', label: 'All' },
                  { key: 'UNREAD', label: `Unread (${unreadCount})` },
                  { key: 'READ', label: 'Read' },
                ] as const
              ).map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    statusFilter === st.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2 w-full sm:w-80"
            >
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search notifications..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Search
              </Button>
            </form>
          </div>
        </Card>

        {/* Notifications List */}
        <Card className="rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {errorMsg ? (
            <div className="p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={22} />
              </div>
              <p className="text-sm font-bold text-slate-900">
                Could not load notifications
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {errorMsg}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNotifications}
                className="mt-4 text-xs"
              >
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} className="p-5 animate-pulse flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-100 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Inbox size={26} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                No notifications match your current filters
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Notifications are generated automatically from real institute
                events such as student admissions, fee collections, attendance
                alerts, faculty updates, and settings changes.
              </p>
              {(categoryFilter !== 'ALL' ||
                statusFilter !== 'ALL' ||
                appliedSearch) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCategoryFilter('ALL');
                    setStatusFilter('ALL');
                    setSearchInput('');
                    setAppliedSearch('');
                    setPage(1);
                  }}
                  className="mt-4 text-xs"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notif) => {
                const cat = getCategoryMeta(notif.category);
                return (
                  <div
                    key={notif.id}
                    className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:bg-slate-50/80 ${
                      !notif.isRead ? 'bg-blue-50/30' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cat.iconBg}`}
                      >
                        {cat.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${cat.badgeClass}`}
                          >
                            {cat.label}
                          </span>
                          {!notif.isRead && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              Unread
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {formatRelativeTime(notif.createdAt)} •{' '}
                            {new Date(notif.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <h3
                          className={`text-sm mt-1.5 ${
                            !notif.isRead
                              ? 'font-bold text-slate-900'
                              : 'font-semibold text-slate-800'
                          }`}
                        >
                          {notif.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          {notif.body}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {!notif.isRead && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsRead(notif)}
                          className="text-xs gap-1"
                        >
                          <Check size={13} />
                          <span>Mark Read</span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!notif.isRead) {
                            await handleMarkAsRead(notif);
                          }
                          router.push(notif.link || '/admin');
                        }}
                        className="text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <span>View</span>
                        <ArrowUpRight size={13} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && !errorMsg && totalItems > 0 && (
            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <span>
                Showing{' '}
                <strong className="text-slate-900">
                  {(page - 1) * limit + 1}–
                  {Math.min(page * limit, totalItems)}
                </strong>{' '}
                of <strong className="text-slate-900">{totalItems}</strong>{' '}
                notifications
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="text-xs gap-1"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </Button>
                <span className="font-semibold text-slate-700 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="text-xs gap-1"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PortalShell>
  );
}

