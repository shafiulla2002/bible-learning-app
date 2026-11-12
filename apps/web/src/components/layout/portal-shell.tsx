'use client';

import React, { useState, useEffect } from 'react';
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
import { apiFetchResponse, resolveVerifiedAdminContext } from '@/lib/api';

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

  const isInitiallyAuthorized = () => {
    if (typeof window === 'undefined') return true;
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('auth_token');
    const role = (localStorage.getItem('current_user_role') || '').toUpperCase();
    if (!token) return false;
    if (portalRole === 'ADMIN') {
      return (
        !role ||
        ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'ACADEMIC_COORDINATOR', 'FINANCE_OFFICER'].includes(role)
      );
    }
    if (portalRole === 'SUPER_ADMIN') {
      return !role || ['SUPER_ADMIN', 'PLATFORM_SUPPORT'].includes(role);
    }
    if (portalRole === 'TEACHER') {
      return !role || ['TEACHER', 'INSTRUCTOR'].includes(role);
    }
    if (portalRole === 'STUDENT') {
      return !role || role === 'STUDENT';
    }
    return true;
  };

  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'unauthorized'>(() => {
    return isInitiallyAuthorized() ? 'authorized' : 'checking';
  });

  const clearClientSession = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user_role');
      localStorage.removeItem('current_institute_id');
      localStorage.removeItem('current_student_profile_id');
      localStorage.removeItem('current_teacher_profile_id');
      sessionStorage.clear();
    } catch {}
    try {
      const cookieKeys = ['auth_token', 'token', 'access_token'];
      cookieKeys.forEach((key) => {
        document.cookie = `${key}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        document.cookie = `${key}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
        document.cookie = `${key}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
      });
    } catch {}
  };

  // Enforce server-verified session and portal role in background without blocking UI
  useEffect(() => {
    let cancelled = false;

    const verifyPortalAccess = async () => {
      if (typeof window === 'undefined') return;

      const token =
        localStorage.getItem('access_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token');

      if (!token) {
        clearClientSession();
        if (!cancelled) {
          setAuthStatus('unauthorized');
          window.location.href = '/login';
        }
        return;
      }

      try {
        const ctx = await resolveVerifiedAdminContext();
        const verifiedRole = String(ctx?.user?.role || '').toUpperCase();

        if (ctx?.instituteId) {
          localStorage.setItem('current_institute_id', ctx.instituteId);
        }
        if (verifiedRole) {
          localStorage.setItem('current_user_role', verifiedRole);
        }

        const isAllowedForPortal =
          portalRole === 'SUPER_ADMIN'
            ? verifiedRole === 'SUPER_ADMIN' || verifiedRole === 'PLATFORM_SUPPORT'
            : portalRole === 'ADMIN'
              ? ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'ACADEMIC_COORDINATOR', 'FINANCE_OFFICER'].includes(verifiedRole)
              : false;

        if (!isAllowedForPortal) {
          if (!cancelled) {
            setAuthStatus('unauthorized');
            if (['INSTITUTE_ADMIN', 'ACADEMIC_COORDINATOR', 'FINANCE_OFFICER'].includes(verifiedRole)) {
              window.location.href = '/admin';
            } else {
              clearClientSession();
              window.location.href = '/login';
            }
          }
          return;
        }

        if (!cancelled) {
          setAuthStatus('authorized');
        }
      } catch (err: any) {
        if (err?.status === 401 || err?.status === 403) {
          clearClientSession();
          if (!cancelled) {
            setAuthStatus('unauthorized');
            window.location.href = '/login';
          }
        }
      }
    };

    verifyPortalAccess();
    return () => {
      cancelled = true;
    };
  }, [pathname, portalRole]);

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user_role');
        localStorage.removeItem('current_institute_id');
        localStorage.removeItem('current_student_profile_id');
        localStorage.removeItem('current_teacher_profile_id');
        sessionStorage.clear();
      } catch (e) {
        console.warn('localStorage clear note:', e);
      }

      try {
        const cookieKeys = ['auth_token', 'token', 'access_token'];
        cookieKeys.forEach((key) => {
          document.cookie = `${key}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          document.cookie = `${key}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
          document.cookie = `${key}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
        });
      } catch (e) {
        console.warn('cookie clear note:', e);
      }

      try {
        apiFetchResponse('/auth/logout', { method: 'POST' }).catch(() => null);
      } catch {}

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
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {authStatus === 'authorized' ? (
            children
          ) : (
            <div className="flex items-center justify-center min-h-[50vh] text-sm font-medium text-slate-500">
              Verifying portal access...
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
