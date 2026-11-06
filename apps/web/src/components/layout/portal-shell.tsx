'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  FileCheck2,
  Award,
  CreditCard,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  Building2,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications/notification-bell';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

export interface PortalShellProps {
  portalTitle: string;
  portalRole: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
  navItems: NavItem[];
  userName: string;
  userRoleLabel: string;
  children: React.ReactNode;
  theme?: 'dark' | 'light';
}

export function PortalShell({
  portalTitle,
  portalRole,
  navItems,
  userName,
  userRoleLabel,
  children,
  theme = 'light',
}: PortalShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user_role');
      localStorage.removeItem('current_institute_id');
      localStorage.removeItem('current_student_profile_id');
      sessionStorage.clear();
      document.cookie = 'auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.href = '/login';
    }
  };

  // Background and text theme configuration for sidebar
  const isDarkSidebar = theme === 'dark' || portalRole === 'TEACHER';
  const sidebarBg = isDarkSidebar ? 'bg-[#1E2235] text-slate-300' : 'bg-white text-slate-600 border-r border-slate-200';
  const brandColor = isDarkSidebar ? 'text-white' : 'text-slate-900';
  const itemActive = isDarkSidebar
    ? 'bg-blue-600 text-white font-medium shadow-md shadow-blue-500/20'
    : 'bg-blue-50 text-blue-600 font-medium';
  const itemHover = isDarkSidebar ? 'hover:bg-[#2A3048] hover:text-white' : 'hover:bg-slate-50 hover:text-slate-900';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans antialiased">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            BL
          </div>
          <span className="font-bold text-slate-900 text-sm tracking-tight">{portalTitle}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {portalRole === 'ADMIN' && <NotificationBell />}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 ${sidebarBg} flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Area */}
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 font-bold text-lg">
            ✝
          </div>
          <div>
            <h1 className={`font-bold text-base leading-tight tracking-tight ${brandColor}`}>
              Bible Institute
            </h1>
            <p className="text-[11px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">
              {portalTitle}
            </p>
          </div>
        </div>

        {/* Portal Switcher Test Banner */}
        <div className="px-4 py-3 bg-white/5 mx-3 mt-3 rounded-xl border border-white/10">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1.5">
            Switch Portal (Demo)
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-medium">
            <Link href="/student" prefetch={true}
              className={`px-2 py-1 rounded text-center transition ${
                portalRole === 'STUDENT' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-300'
              }`}
            >
              Student
            </Link>
            <Link href="/teacher" prefetch={true}
              className={`px-2 py-1 rounded text-center transition ${
                portalRole === 'TEACHER' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-300'
              }`}
            >
              Teacher
            </Link>
            <Link href="/admin" prefetch={true}
              className={`px-2 py-1 rounded text-center transition ${
                portalRole === 'ADMIN' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-300'
              }`}
            >
              Admin
            </Link>
            <Link
              href="/super-admin"
              className={`px-2 py-1 rounded text-center transition ${
                portalRole === 'SUPER_ADMIN' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-300'
              }`}
            >
              Super Admin
            </Link>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} prefetch={true}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                  isActive ? itemActive : `${itemHover}`
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-inherit' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Footer Card */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
              {userName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="overflow-hidden">
              <p className={`text-xs font-semibold truncate ${brandColor}`}>{userName}</p>
              <p className="text-[10px] text-slate-400 truncate">{userRoleLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="hidden md:flex items-center justify-between h-16 px-8 bg-white border-b border-slate-200/80 sticky top-0 z-30">
          {/* Global Search Bar */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search courses, lessons, students..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-4">
            {portalRole === 'ADMIN' ? (
              <NotificationBell />
            ) : (
              <button
                className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
              </button>
            )}
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-700">{userName}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
                {userRoleLabel}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Children */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
