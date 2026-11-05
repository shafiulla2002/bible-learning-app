'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Radio,
  FileCheck2,
  GraduationCap,
  Award,
  PieChart,
  MessageSquare,
  Calendar,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  User,
  ChevronDown,
  Target,
  PanelLeftClose,
  PanelLeft,
  BookMarked,
  Sparkles,
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
  { label: 'Live Classes', href: '/student/classes', icon: <Radio size={18} />, badge: 'LIVE', badgeColor: 'bg-rose-500' },
  { label: 'Assignments', href: '/student/assignments', icon: <FileCheck2 size={18} /> },
  { label: 'Exams', href: '/student/exams', icon: <GraduationCap size={18} /> },
  { label: 'Certificates', href: '/student/certificates', icon: <Award size={18} /> },
  { label: 'Progress', href: '/student/progress', icon: <PieChart size={18} /> },
  { label: 'Messages', href: '/student/messages', icon: <MessageSquare size={18} /> },
  { label: 'Calendar', href: '/student/calendar', icon: <Calendar size={18} /> },
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
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 font-sans antialiased p-0 md:p-3 lg:p-4">
      {/* Outer rounded container wrapper matching SaaS reference frame */}
      <div className="min-h-[calc(100vh-2rem)] bg-[#F8FAFC] rounded-none md:rounded-[2rem] flex flex-col md:flex-row overflow-hidden shadow-2xl border border-slate-200/80">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#2563EB] text-white sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white text-[#2563EB] flex items-center justify-center font-bold text-sm shadow">
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

        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Royal Blue (#2563EB) Sidebar */}
        <aside
          className={`fixed md:sticky top-0 left-0 h-screen md:h-auto md:min-h-full ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          } bg-[#2563EB] text-white flex flex-col z-50 transition-all duration-300 ease-in-out md:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* Brand Header */}
          <div className="p-5 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-white text-[#2563EB] flex items-center justify-center font-bold text-lg shrink-0 shadow-md">
                ✝
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <h1 className="font-bold text-base leading-tight tracking-tight text-white truncate">
                    Bible Institute
                  </h1>
                  <p className="text-[10px] text-blue-200 font-medium tracking-wider uppercase mt-0.5">
                    Student Portal
                  </p>
                </div>
              )}
            </div>

            {/* Collapse / Toggle Button on Desktop */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>

            {/* Close Button on Mobile */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/student' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition duration-150 ${
                    isActive
                      ? 'bg-white/20 text-white font-semibold backdrop-blur-sm shadow-sm'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <span className={`${isActive ? 'text-white' : 'text-blue-200'} shrink-0`}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white shadow-sm flex items-center gap-1 ${
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

          {/* Promotional / Theological Growth Card (Matching Reference Design) */}
          {!sidebarCollapsed && (
            <div className="px-3 pb-3">
              <div className="bg-white rounded-2xl p-4 text-slate-800 shadow-xl border border-blue-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
                <h4 className="text-xs font-bold text-slate-900 leading-tight">Grow in the Word</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1 mb-3">
                  Explore available Bible courses, theological libraries & cohort recordings.
                </p>
                <Link
                  href="/student/courses"
                  className="block w-full py-2 px-3 text-center bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Explore Courses
                </Link>
              </div>
            </div>
          )}

          {/* Footer Actions (Settings, Help, Logout) */}
          <div className="p-3 border-t border-white/10 space-y-1">
            <Link
              href="/student/profile"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-blue-100 hover:bg-white/10 hover:text-white transition"
              title={sidebarCollapsed ? 'Settings' : undefined}
            >
              <Settings size={16} className="text-blue-200 shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </Link>
            <Link
              href="/student/help"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-blue-100 hover:bg-white/10 hover:text-white transition"
              title={sidebarCollapsed ? 'Help & Support' : undefined}
            >
              <HelpCircle size={16} className="text-blue-200 shrink-0" />
              {!sidebarCollapsed && <span>Help Center</span>}
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-rose-200 hover:bg-rose-500/20 hover:text-white transition text-left"
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut size={16} className="text-rose-300 shrink-0" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
          
          {/* Top Navigation Header matching reference */}
          <header className="px-6 lg:px-8 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between sticky top-0 z-30">
            {/* Search input with rounded pill design */}
            <div className="relative w-80 lg:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search courses, lessons..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-full border border-slate-200/80 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-inner"
              />
            </div>

            {/* Quick Actions & Profile Avatar */}
            <div className="flex items-center gap-3">
              {/* Study Mode Crosshair / Focus Toggle */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 transition border border-slate-200 shadow-sm"
                title="Toggle focus mode"
              >
                <Target size={16} />
              </button>

              {/* Notification Bell with unread dot */}
              <Link
                href="/student/messages"
                className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 transition border border-slate-200 shadow-sm relative"
                title="Notifications & Messages"
              >
                <Bell size={16} />
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2 ring-2 ring-white" />
              </Link>

              {/* Student Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-slate-100 transition border border-slate-200 shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {studentInitials}
                  </div>
                  <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-800">{studentDisplayName}</p>
                      <p className="text-[11px] text-slate-400">{student?.email || 'student@bible-institute.org'}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-100">
                        {admissionNumber}
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
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Dashboard Body */}
          <main className="flex-1 p-4 md:p-6 lg:p-7 max-w-[1400px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
