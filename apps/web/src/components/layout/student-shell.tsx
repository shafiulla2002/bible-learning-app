'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Video,
  FileCheck2,
  Award,
  CalendarCheck,
  Calendar,
  CreditCard,
  PieChart,
  HelpCircle,
  Settings,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  User,
  ChevronDown,
  Sparkles,
  BookMarked,
  ShieldAlert,
  GraduationCap,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useStudentAuth } from '@/lib/use-student-auth';

export interface StudentNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

const defaultNavItems: StudentNavItem[] = [
  { label: 'Dashboard', href: '/student', icon: <LayoutDashboard size={19} /> },
  { label: 'My Courses', href: '/student/courses', icon: <BookOpen size={19} /> },
  { label: 'Live Classes', href: '/student/classes', icon: <Video size={19} />, badge: 'LIVE', badgeColor: 'bg-rose-500' },
  { label: 'Assignments', href: '/student/assignments', icon: <FileCheck2 size={19} /> },
  { label: 'Examinations', href: '/student/exams', icon: <GraduationCap size={19} /> },
  { label: 'Attendance', href: '/student/attendance', icon: <CalendarCheck size={19} /> },
  { label: 'Learning Progress', href: '/student/progress', icon: <PieChart size={19} /> },
  { label: 'Certificates', href: '/student/certificates', icon: <Award size={19} /> },
  { label: 'Fee Payments', href: '/student/payments', icon: <CreditCard size={19} /> },
  { label: 'Academic Calendar', href: '/student/calendar', icon: <Calendar size={19} /> },
];

export interface StudentShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  navItems?: StudentNavItem[];
}

export function StudentShell({
  children,
  pageTitle,
  navItems = defaultNavItems,
}: StudentShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { student, profile, institute, isLoading, logout } = useStudentAuth({ requireAuth: false });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
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

  const studentDisplayName = student?.fullName || 'Grace Thomas';
  const studentInitials = studentDisplayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const admissionNumber = profile?.admissionNo || 'ADM-2026-001';
  const instituteName = institute?.name || 'Grace Bible Institute';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans antialiased text-slate-800">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#2563EB] text-white sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-white shadow-inner">
            ✝
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight block leading-none">Bible Institute</span>
            <span className="text-[10px] text-blue-200 uppercase tracking-widest font-medium">Student Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/student/profile"
            className="w-8 h-8 rounded-full bg-white/20 text-white font-bold text-xs flex items-center justify-center border border-white/30"
          >
            {studentInitials}
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-white hover:bg-white/10 transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Backdrop for Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Royal Blue Sidebar (#2563EB) */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-72 bg-[#2563EB] text-white flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 shadow-2xl md:shadow-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${focusMode ? 'md:-translate-x-full md:w-0' : ''}`}
      >
        {/* Brand Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-[#2563EB] flex items-center justify-center shadow-lg shadow-black/10 font-bold text-xl">
              ✝
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight leading-tight text-white">
                Bible Institute
              </h1>
              <p className="text-[11px] text-blue-200 font-medium tracking-wider uppercase mt-0.5">
                Learner Portal
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
          <div className="px-3 pb-2 text-[10px] uppercase font-bold tracking-wider text-blue-200/80">
            Academic Navigation
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/student' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                  isActive
                    ? 'bg-white/20 text-white shadow-inner backdrop-blur-sm font-semibold'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${isActive ? 'text-white' : 'text-blue-200'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm flex items-center gap-1 ${
                      item.badgeColor || 'bg-rose-500'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Promo / Spiritual Growth Card (Reference Design UI) */}
        <div className="px-4 pb-2">
          <div className="bg-white rounded-2xl p-4 text-slate-800 shadow-xl border border-blue-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <BookMarked size={16} />
              </span>
              <span className="text-xs font-bold text-slate-900">Spiritual Growth</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              Explore theological commentaries, lecture notes & study resources.
            </p>
            <Link
              href="/student/courses"
              className="block w-full py-2 px-3 text-center bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              Access Library
            </Link>
          </div>
        </div>

        {/* Sidebar Footer (Settings, Help, Logout) */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link
            href="/student/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-blue-100 hover:bg-white/10 hover:text-white transition"
          >
            <Settings size={16} className="text-blue-200" />
            <span>Account Settings</span>
          </Link>
          <Link
            href="/student/help"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-blue-100 hover:bg-white/10 hover:text-white transition"
          >
            <HelpCircle size={16} className="text-blue-200" />
            <span>Help & Support</span>
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-rose-200 hover:bg-rose-500/20 hover:text-white transition text-left"
          >
            <LogOut size={16} className="text-rose-300" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Navigation Bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
          {/* Search Input Bar */}
          <div className="relative w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search enrolled courses, theological lectures..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white rounded-full border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          {/* Quick Actions & Student Profile Badge */}
          <div className="flex items-center gap-4">
            {/* Focus / Study Mode Toggle */}
            <button
              onClick={() => setFocusMode(!focusMode)}
              className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border border-slate-200/60"
              title={focusMode ? 'Exit Study Mode' : 'Enter Study Mode'}
            >
              {focusMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>

            {/* Notification Bell */}
            <Link
              href="/student"
              className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border border-slate-200/60 relative"
              title="Notifications"
            >
              <Bell size={17} />
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
            </Link>

            <div className="h-6 w-px bg-slate-200" />

            {/* Student Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-3 p-1.5 pr-2.5 rounded-full hover:bg-slate-100/80 transition border border-slate-200/60"
              >
                <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {studentInitials}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {studentDisplayName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {admissionNumber}
                  </div>
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800">{studentDisplayName}</p>
                    <p className="text-[11px] text-slate-400">{student?.email || 'student@bible-institute.org'}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-100">
                      {instituteName}
                    </span>
                  </div>

                  <Link
                    href="/student/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition"
                  >
                    <User size={15} />
                    <span>My Profile</span>
                  </Link>
                  <Link
                    href="/student/courses"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition"
                  >
                    <BookOpen size={15} />
                    <span>My Courses</span>
                  </Link>
                  <Link
                    href="/student/payments"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition"
                  >
                    <CreditCard size={15} />
                    <span>Fee Invoices & Receipts</span>
                  </Link>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition text-left font-medium"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
