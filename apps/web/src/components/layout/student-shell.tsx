'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Radio,
  CalendarCheck,
  FileText,
  Award,
  CreditCard,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  User,
  ChevronDown,
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
  { label: 'Dashboard', href: '/student', icon: <LayoutDashboard size={18} /> },
  { label: 'My Courses', href: '/student/courses', icon: <BookOpen size={18} /> },
  { label: 'Live Classes', href: '/student/classes', icon: <Radio size={18} />, badge: 'LIVE', badgeColor: 'bg-rose-500 text-white' },
  { label: 'Attendance', href: '/student/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'Assignments', href: '/student/assignments', icon: <FileText size={18} /> },
  { label: 'Certificates', href: '/student/certificates', icon: <Award size={18} /> },
  { label: 'Payments & Receipts', href: '/student/payments', icon: <CreditCard size={18} /> },
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
  const { student, profile, institute, logout } = useStudentAuth({ requireAuth: false });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const studentDisplayName = student?.fullName || 'Shaik Shafiulla';
  const studentInitials = studentDisplayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const admissionNumber = profile?.admissionNo || 'ADM-2026-038';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans antialiased text-slate-800">
      
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            ✝
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 block leading-tight">Bible Institute</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Learner Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {studentInitials}
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Clean White Sidebar (Learnify Layout) */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200/80 flex flex-col z-50 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm shadow-blue-500/20">
            ✝
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-900 leading-tight">
              Bible Institute
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
              Learner Portal
            </p>
          </div>
        </div>

        {/* Portal Switcher (Demo) */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Switch Portal (Demo)
          </div>
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-semibold text-center">
            <span className="py-1 bg-blue-600 text-white rounded-lg shadow-xs cursor-default">Student</span>
            <Link href="/teacher" className="py-1 text-slate-500 hover:text-slate-900 rounded-lg transition">Teacher</Link>
            <Link href="/admin" className="py-1 text-slate-500 hover:text-slate-900 rounded-lg transition">Admin</Link>
            <Link href="/super-admin" className="py-1 text-slate-500 hover:text-slate-900 rounded-lg transition">Super</Link>
          </div>
        </div>

        {/* Navigation Menu Links */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/student' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-bold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
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

        {/* Bottom User Pill */}
        <div className="p-3 border-t border-slate-100 bg-white">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition">
            <Link href="/student/profile" className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {studentInitials}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {studentDisplayName}
                </div>
                <div className="text-[10px] text-slate-400 truncate font-medium">
                  Enrolled Student
                </div>
              </div>
            </Link>
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header with Search and Profile */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white/70 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-30">
          {/* Search Input */}
          <div className="relative w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search courses, lessons, students..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          {/* Right Header Badges */}
          <div className="flex items-center gap-4">
            <button
              className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            </button>

            <Link
              href="/student/profile"
              className="flex items-center gap-2 pl-2 text-xs font-semibold text-slate-700 hover:text-blue-600 transition"
            >
              <span>{studentDisplayName}</span>
              <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Enrolled Student
              </span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

    </div>
  );
}
