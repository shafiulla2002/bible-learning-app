'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  FileCheck2,
  GraduationCap,
  Radio,
  Clock,
  BookOpen,
  Bell,
  User,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  AlertCircle,
  RefreshCw,
  Library,
} from 'lucide-react';
import { useTeacherAuth } from '@/lib/use-teacher-auth';

export interface TeacherNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

const defaultTeacherNavItems: TeacherNavItem[] = [
  { label: 'Dashboard', href: '/teacher', icon: <LayoutDashboard size={18} /> },
  { label: 'My Batches', href: '/teacher/batches', icon: <Library size={18} /> },
  { label: 'My Students', href: '/teacher/students', icon: <Users size={18} /> },
  { label: 'Attendance', href: '/teacher/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'Assignments', href: '/teacher/assignments', icon: <FileCheck2 size={18} /> },
  { label: 'Examinations', href: '/teacher/exams', icon: <GraduationCap size={18} /> },
  { label: 'Live Classes', href: '/teacher/classes', icon: <Radio size={18} />, badge: 'LIVE', badgeColor: 'bg-rose-500' },
  { label: 'Timetable', href: '/teacher/timetable', icon: <Clock size={18} /> },
  { label: 'Study Materials', href: '/teacher/materials', icon: <BookOpen size={18} /> },
  { label: 'Notifications', href: '/teacher/notifications', icon: <Bell size={18} /> },
  { label: 'My Profile', href: '/teacher/profile', icon: <User size={18} /> },
  { label: 'Settings', href: '/teacher/settings', icon: <Settings size={18} /> },
];

export interface TeacherShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  navItems?: TeacherNavItem[];
}

export function TeacherShell({
  children,
  pageTitle,
  navItems = defaultTeacherNavItems,
}: TeacherShellProps) {
  const pathname = usePathname();
  const { teacher, institute, isLoading, error, logout, refresh } = useTeacherAuth({
    requireAuth: true,
    redirectTo: '/login',
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const teacherDisplayName = teacher?.fullName || 'Faculty Instructor';
  const teacherInitials = teacher?.fullName
    ? teacher.fullName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'FI';
  const employeeCode = teacher?.employeeCode || 'FACULTY';
  const instituteName = institute?.name || 'Grace Bible Institute';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased p-0 md:p-3 lg:p-4">
      {/* Outer container wrapper matching premium platform frame */}
      <div className="max-w-[1720px] mx-auto min-h-[calc(100vh-2rem)] bg-white rounded-none md:rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-slate-200/80">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3.5 bg-[#2563EB] text-white sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center font-bold text-sm text-white border border-white/20">
              ✝
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight block leading-tight">
                Bible Institute
              </span>
              <span className="text-[10px] text-blue-100 font-medium tracking-wide uppercase">
                Faculty Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition text-white cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-50 bg-[#2563EB] text-white flex flex-col transition-all duration-300 ease-in-out shrink-0 ${
            sidebarCollapsed ? 'md:w-20' : 'md:w-64'
          } ${
            mobileMenuOpen
              ? 'translate-x-0 w-72 shadow-2xl'
              : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* Brand & Logo Area */}
          <div className="p-4 lg:p-5 flex items-center justify-between border-b border-blue-500/30">
            <Link href="/teacher" className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white text-[#2563EB] flex items-center justify-center font-extrabold text-lg shadow-md shrink-0">
                ✝
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <span className="font-extrabold text-sm lg:text-base tracking-tight block text-white truncate leading-tight">
                    Bible Institute
                  </span>
                  <span className="text-[10px] text-blue-100 font-semibold tracking-wider uppercase block">
                    Faculty Portal
                  </span>
                </div>
              )}
            </Link>

            {/* Desktop Sidebar Collapse Toggle */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const isActive =
                item.href === '/teacher'
                  ? pathname === '/teacher'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-white text-[#2563EB] font-bold shadow-md'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-[#2563EB]' : 'text-blue-200'}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && item.badge && (
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                        item.badgeColor || 'bg-rose-500 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Academic Term Info Box */}
          {!sidebarCollapsed && (
            <div className="p-3 mx-3 mb-3 rounded-2xl bg-white/10 border border-white/15 text-white space-y-1">
              <div className="font-bold text-xs flex items-center justify-between">
                <span>{instituteName}</span>
              </div>
              <p className="text-[11px] text-blue-100 leading-relaxed font-normal">
                Academic Year 2026 • Verified Teaching Portal
              </p>
            </div>
          )}

          {/* Bottom Faculty Profile Pill */}
          <div className="p-3 border-t border-blue-500/30 flex items-center justify-between gap-1">
            <Link
              href="/teacher/profile"
              className={`flex items-center ${
                sidebarCollapsed ? 'justify-center' : 'gap-3'
              } p-2 rounded-xl hover:bg-white/10 transition flex-1 min-w-0`}
            >
              <div className="w-9 h-9 rounded-full bg-white text-[#2563EB] font-bold text-xs flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                {teacher?.photoUrl ? (
                  <img src={teacher.photoUrl} alt={teacherDisplayName} className="w-full h-full object-cover" />
                ) : (
                  teacherInitials
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">
                    {teacherDisplayName}
                  </div>
                  <div className="text-[10px] text-blue-200 truncate font-medium">
                    {employeeCode}
                  </div>
                </div>
              )}
            </Link>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  logout();
                }}
                className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
          {/* Top Bar Header */}
          <header className="h-16 px-4 md:px-6 lg:px-8 bg-white border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-30 shadow-xs">
            {/* Search Input */}
            <div className="flex items-center gap-3 w-full max-w-md">
              <div className="relative w-full">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search batches, students, assignments, classes..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Notifications Link */}
              <Link
                href="/teacher/notifications"
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition relative cursor-pointer"
                title="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
              </Link>

              {/* Institute Badge */}
              <span className="hidden xl:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                {instituteName}
              </span>

              {/* Teacher Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-slate-100 transition border border-slate-200 shadow-xs cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shadow-xs overflow-hidden">
                    {teacher?.photoUrl ? (
                      <img src={teacher.photoUrl} alt={teacherDisplayName} className="w-full h-full object-cover" />
                    ) : (
                      teacherInitials
                    )}
                  </div>
                  <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{teacherDisplayName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{teacher?.email || 'Faculty Member'}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-100">
                          {employeeCode}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                          {teacher?.specialization || 'Theology'}
                        </span>
                      </div>
                    </div>

                    <Link
                      href="/teacher/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition"
                    >
                      <User size={15} />
                      <span>My Profile</span>
                    </Link>
                    <Link
                      href="/teacher/batches"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition"
                    >
                      <Library size={15} />
                      <span>My Batches</span>
                    </Link>
                    <Link
                      href="/teacher/settings"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition"
                    >
                      <Settings size={15} />
                      <span>Account Settings</span>
                    </Link>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition text-left font-medium cursor-pointer"
                    >
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Dashboard Body */}
          <main className="flex-1 p-4 md:p-6 lg:p-7 max-w-[1400px] w-full mx-auto">
            {isLoading ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-28 bg-slate-200/70 rounded-2xl w-full" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="h-28 bg-slate-200/70 rounded-2xl" />
                  <div className="h-28 bg-slate-200/70 rounded-2xl" />
                  <div className="h-28 bg-slate-200/70 rounded-2xl" />
                  <div className="h-28 bg-slate-200/70 rounded-2xl" />
                </div>
                <div className="h-64 bg-slate-200/70 rounded-2xl w-full" />
              </div>
            ) : error ? (
              <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertCircle size={18} className="text-rose-600" />
                  <span>Unable to load teacher profile</span>
                </div>
                <p className="text-xs text-rose-700">{error}</p>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => refresh()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-rose-200 rounded-lg text-rose-700 hover:bg-rose-100/50 transition cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    Try Again
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition cursor-pointer"
                  >
                    <LogOut size={13} />
                    Sign Out & Re-login
                  </button>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

