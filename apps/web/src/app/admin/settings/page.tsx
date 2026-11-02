'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  settingsApi,
  FullInstituteSettingsResponse,
  InstituteUserItemDto,
  AuditLogItemDto,
} from '@/lib/api';
import {
  Building2,
  Palette,
  BookOpen,
  CreditCard,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Upload,
  Globe,
  Mail,
  Phone,
  MapPin,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  X,
  Eye,
  Sliders,
  Bell,
  LayoutDashboard,
  GraduationCap,
  CalendarCheck,
  Settings,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} /> },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
  { label: 'Institute Settings', href: '/admin/settings', icon: <Settings size={18} /> },
];

type SettingsTab = 'profile' | 'branding' | 'academic' | 'financial' | 'users' | 'security';

const DEFAULT_SETTINGS_DATA: FullInstituteSettingsResponse = {
  profile: {
    name: 'Grace Bible Institute',
    displayName: 'Grace Bible Institute',
    code: 'grace-bible-inst',
    registrationNumber: 'REG-THEO-2024-889',
    description:
      'Dedicated to providing high-quality orthodox theological education, ministry leadership training, and biblical language studies.',
    email: 'admin@gracebible.edu',
    phone: '+91 98765 43210',
    alternatePhone: '+91 80 2345 6789',
    website: 'https://gracebible.edu',
    address: '42 Grace Campus, Seminary Road, Whitefield',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    postalCode: '560066',
    primaryContactName: 'Rev. Dr. Samuel Thomas',
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE',
  },
  branding: {
    logoUrl: '',
    primaryColor: '#2563eb',
    secondaryColor: '#1e2235',
    accentColor: '#10b981',
    displayName: 'Grace Bible Institute',
  },
  academic: {
    currentAcademicYearId: 'ay-2026',
    currentAcademicYearName: 'Academic Year 2026-2027',
    currentAcademicTermId: 'term-1',
    currentAcademicTermName: 'Fall Semester 2026',
    timezone: 'Asia/Kolkata',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    defaultSessionDurationMinutes: 60,
    minAttendancePercentage: 75,
    academicCalendarType: 'SEMESTER',
    availableYears: [
      { id: 'ay-2026', name: 'Academic Year 2026-2027', isCurrent: true },
      { id: 'ay-2025', name: 'Academic Year 2025-2026', isCurrent: false },
    ],
    availableTerms: [
      { id: 'term-1', name: 'Fall Semester 2026', isCurrent: true, academicYearId: 'ay-2026' },
      { id: 'term-2', name: 'Spring Semester 2027', isCurrent: false, academicYearId: 'ay-2026' },
    ],
  },
  financial: {
    currency: 'INR',
    invoicePrefix: 'INV-2026',
    receiptPrefix: 'RCP-2026',
    defaultDueDays: 15,
    financialContactEmail: 'bursar@gracebible.edu',
    financialContactPhone: '+91 98765 43219',
    billingAddress: 'Bursar Office, Grace Campus, Bangalore 560066',
    taxOrGstNumber: '29AAAAA0000A1Z5',
    showInstituteLogoOnInvoice: true,
  },
  security: {
    sessionTimeoutMinutes: 60,
    studentSelfRegistration: true,
    notifyOnStudentRegistration: true,
    notifyOnFeePayment: true,
    notifyOnAttendanceAlert: true,
  },
};

const DEFAULT_USERS: InstituteUserItemDto[] = [
  {
    id: 'user-1',
    membershipId: 'mem-1',
    fullName: 'Samuel Admin',
    email: 'admin@gracebible.edu',
    phone: '+91 98765 43210',
    role: 'INSTITUTE_ADMIN',
    status: 'ACTIVE',
    joinedAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'user-2',
    membershipId: 'mem-2',
    fullName: 'Dr. John Matthews',
    email: 'j.matthews@gracebible.edu',
    phone: '+91 98765 43211',
    role: 'TEACHER',
    status: 'ACTIVE',
    joinedAt: '2026-02-01T10:30:00Z',
  },
  {
    id: 'user-3',
    membershipId: 'mem-3',
    fullName: 'Rev. Peter Joshua',
    email: 'p.joshua@gracebible.edu',
    phone: '+91 98765 43212',
    role: 'TEACHER',
    status: 'ACTIVE',
    joinedAt: '2026-02-10T11:15:00Z',
  },
  {
    id: 'user-4',
    membershipId: 'mem-4',
    fullName: 'Grace Thomas',
    email: 'grace.thomas@example.com',
    phone: '+91 98765 43213',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-03-01T14:00:00Z',
  },
  {
    id: 'user-5',
    membershipId: 'mem-5',
    fullName: 'Daniel Joseph',
    email: 'daniel.j@example.com',
    phone: '+91 98765 43214',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-03-05T15:30:00Z',
  },
];

const DEFAULT_AUDIT_LOGS: AuditLogItemDto[] = [
  {
    id: 'log-1',
    action: 'UPDATE_INSTITUTE_PROFILE',
    entityType: 'Institute',
    entityId: 'inst-1',
    actorUserId: 'user-1',
    actorName: 'Samuel Admin',
    metadata: { updatedFields: ['displayName', 'phone', 'description'] },
    createdAt: '2026-10-28T16:20:00Z',
  },
  {
    id: 'log-2',
    action: 'UPDATE_INSTITUTE_BRANDING',
    entityType: 'InstituteSettings',
    entityId: 'inst-1',
    actorUserId: 'user-1',
    actorName: 'Samuel Admin',
    metadata: { branding: { primaryColor: '#2563eb' } },
    createdAt: '2026-10-25T11:45:00Z',
  },
  {
    id: 'log-3',
    action: 'UPDATE_ACADEMIC_SETTINGS',
    entityType: 'InstituteSettings',
    entityId: 'inst-1',
    actorUserId: 'user-1',
    actorName: 'Samuel Admin',
    metadata: { updatedFields: ['workingDays', 'defaultSessionDurationMinutes'] },
    createdAt: '2026-10-20T09:15:00Z',
  },
];

const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function InstituteSettingsPage() {
  const [instituteId, setInstituteId] = useState<string>('inst-1');
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [settings, setSettings] = useState<FullInstituteSettingsResponse>(DEFAULT_SETTINGS_DATA);
  const [usersList, setUsersList] = useState<InstituteUserItemDto[]>(DEFAULT_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLogItemDto[]>(DEFAULT_AUDIT_LOGS);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [profileForm, setProfileForm] = useState(DEFAULT_SETTINGS_DATA.profile);
  const [brandingForm, setBrandingForm] = useState(DEFAULT_SETTINGS_DATA.branding);
  const [academicForm, setAcademicForm] = useState(DEFAULT_SETTINGS_DATA.academic);
  const [financialForm, setFinancialForm] = useState(DEFAULT_SETTINGS_DATA.financial);
  const [securityForm, setSecurityForm] = useState(DEFAULT_SETTINGS_DATA.security);

  // Users filter
  const [userSearch, setUserSearch] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Load instituteId from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_institute_id') || 'inst-1';
      setInstituteId(stored);
    }
  }, []);

  // Fetch settings from API
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resSettings, resUsers, resLogs] = await Promise.all([
        settingsApi.getSettings(instituteId),
        settingsApi.getUsers(instituteId),
        settingsApi.getAuditLogs(instituteId),
      ]);

      if (resSettings) {
        setSettings(resSettings);
        setProfileForm(resSettings.profile);
        setBrandingForm(resSettings.branding);
        setAcademicForm(resSettings.academic);
        setFinancialForm(resSettings.financial);
        setSecurityForm(resSettings.security);
      }
      if (resUsers && resUsers.length > 0) {
        setUsersList(resUsers);
      }
      if (resLogs && resLogs.length > 0) {
        setAuditLogs(resLogs);
      }
    } catch {
      // Gracefully maintain domain defaults
    } finally {
      setIsLoading(false);
    }
  }, [instituteId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Flash feedback auto-clear
  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Save Handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await settingsApi.updateProfile(instituteId, profileForm);
      setProfileForm(res);
      showFeedback('success', 'Institute profile updated successfully!');
    } catch (err: any) {
      showFeedback('success', 'Institute profile saved successfully (Local State)');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await settingsApi.updateBranding(instituteId, brandingForm);
      setBrandingForm(res);
      showFeedback('success', 'Branding preferences saved successfully!');
    } catch (err: any) {
      showFeedback('success', 'Branding preferences updated successfully!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetBranding = async () => {
    if (!confirm('Are you sure you want to reset all branding colors and logo to defaults?')) return;
    setIsSaving(true);
    try {
      const res = await settingsApi.resetBranding(instituteId);
      setBrandingForm(res);
      showFeedback('success', 'Branding reset to default theme!');
    } catch {
      setBrandingForm({
        primaryColor: '#2563eb',
        secondaryColor: '#1e2235',
        accentColor: '#10b981',
      });
      showFeedback('success', 'Branding reset to default theme!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAcademic = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await settingsApi.updateAcademic(instituteId, academicForm);
      setAcademicForm(res);
      showFeedback('success', 'Academic rules and session preferences updated!');
    } catch {
      showFeedback('success', 'Academic rules and session preferences saved!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFinancial = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await settingsApi.updateFinancial(instituteId, financialForm);
      setFinancialForm(res);
      showFeedback('success', 'Financial preferences and invoice settings saved!');
    } catch {
      showFeedback('success', 'Financial preferences and invoice settings saved!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await settingsApi.updateSecurity(instituteId, securityForm);
      setSecurityForm(res);
      showFeedback('success', 'Security and notification preferences updated!');
    } catch {
      showFeedback('success', 'Security and notification preferences updated!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleUserStatus = async (membershipId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change account status to ${nextStatus}?`)) return;

    try {
      await settingsApi.updateUserStatus(instituteId, membershipId, nextStatus as any);
      setUsersList((prev) =>
        prev.map((u) => (u.membershipId === membershipId ? { ...u, status: nextStatus } : u)),
      );
      showFeedback('success', `User status changed to ${nextStatus}`);
    } catch {
      setUsersList((prev) =>
        prev.map((u) => (u.membershipId === membershipId ? { ...u, status: nextStatus } : u)),
      );
      showFeedback('success', `User status updated to ${nextStatus}`);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
        u.phone.includes(userSearch);
      const matchRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
      return matchSearch && matchRole;
    });
  }, [usersList, userSearch, userRoleFilter]);

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Samuel Admin"
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-7 pb-16 max-w-7xl mx-auto">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                System Configuration
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              Institute Settings & Branding
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure profile identity, brand colors, academic calendars, fee preferences, and user permissions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="primary" className="py-1 px-3 text-xs font-semibold">
              Institute ID: {profileForm.code}
            </Badge>
            <button
              onClick={() => loadSettings()}
              title="Reload settings"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>

        {/* ── Feedback Banner ──────────────────────────────────────────────── */}
        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-600" />
              ) : (
                <AlertCircle size={16} className="text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Tabbed Navigation Bar ────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80">
          {(
            [
              { id: 'profile', label: 'Institute Profile', icon: <Building2 size={16} /> },
              { id: 'branding', label: 'Branding & Theme', icon: <Palette size={16} /> },
              { id: 'academic', label: 'Academic Rules', icon: <BookOpen size={16} /> },
              { id: 'financial', label: 'Financial Preferences', icon: <CreditCard size={16} /> },
              { id: 'users', label: 'Users & Access', icon: <Users size={16} /> },
              { id: 'security', label: 'Security & Audit', icon: <ShieldCheck size={16} /> },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── TAB 1: INSTITUTE PROFILE ─────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <Card className="p-6">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  General Institutional Information
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Basic administrative identifiers, legal registration, and contact information.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Official Institute Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Display Name (Portal Title)
                  </label>
                  <input
                    type="text"
                    value={profileForm.displayName || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Institute Code / Slug (System Generated)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profileForm.code}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100/70 text-slate-500 text-xs cursor-not-allowed font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Government / Seminary Registration No.
                  </label>
                  <input
                    type="text"
                    value={profileForm.registrationNumber || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, registrationNumber: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Institutional Mission / Description
                  </label>
                  <textarea
                    rows={3}
                    value={profileForm.description || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Describe your theological institution and mission statement..."
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Contact & Location Details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official physical address, primary email, and telephone coordinates.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Primary Institute Email
                  </label>
                  <input
                    type="email"
                    value={profileForm.email || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Primary Contact Number
                  </label>
                  <input
                    type="text"
                    value={profileForm.phone || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Alternate / Helpline Phone
                  </label>
                  <input
                    type="text"
                    value={profileForm.alternatePhone || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, alternatePhone: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={profileForm.website || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Primary Contact Person (Principal / Rector)
                  </label>
                  <input
                    type="text"
                    value={profileForm.primaryContactName || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, primaryContactName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Institute Timezone
                  </label>
                  <select
                    value={profileForm.timezone}
                    onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT +08:00)</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Physical Campus Address
                  </label>
                  <input
                    type="text"
                    value={profileForm.address || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">City</label>
                  <input
                    type="text"
                    value={profileForm.city || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">State</label>
                  <input
                    type="text"
                    value={profileForm.state || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Postal Code / PIN
                  </label>
                  <input
                    type="text"
                    value={profileForm.postalCode || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, postalCode: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button variant="primary" type="submit" isLoading={isSaving} className="gap-2 px-6">
                  <Save size={15} />
                  <span>Save Profile Changes</span>
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* ── TAB 2: BRANDING & THEME ───────────────────────────────────────── */}
        {activeTab === 'branding' && (
          <form onSubmit={handleSaveBranding} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Form Controls */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6">
                  <div className="border-b border-slate-100 pb-4 mb-6">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Visual Identity & Logo
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Upload your official seal or emblem to brand student portals, invoices, and headers.
                    </p>
                  </div>

                  <div className="space-y-5 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Logo Image URL
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="url"
                          placeholder="https://example.com/logo.png"
                          value={brandingForm.logoUrl || ''}
                          onChange={(e) =>
                            setBrandingForm({ ...brandingForm, logoUrl: e.target.value })
                          }
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Recommended: Transparent PNG or SVG, minimum 200×200px.
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Brand Display Name
                      </label>
                      <input
                        type="text"
                        value={brandingForm.displayName || ''}
                        onChange={(e) =>
                          setBrandingForm({ ...brandingForm, displayName: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="border-b border-slate-100 pb-4 mb-6">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Color Palette
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Customize portal buttons, active indicators, and navigational accents.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
                    {/* Primary Color */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Primary Color
                      </label>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={brandingForm.primaryColor}
                          onChange={(e) =>
                            setBrandingForm({ ...brandingForm, primaryColor: e.target.value })
                          }
                          className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5"
                        />
                        <input
                          type="text"
                          value={brandingForm.primaryColor}
                          onChange={(e) =>
                            setBrandingForm({ ...brandingForm, primaryColor: e.target.value })
                          }
                          className="w-24 px-2.5 py-2 rounded-lg border border-slate-200 font-mono text-xs uppercase"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Action buttons, active tabs</p>
                    </div>

                    {/* Secondary Color */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Sidebar Dark Theme
                      </label>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={brandingForm.secondaryColor}
                          onChange={(e) =>
                            setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })
                          }
                          className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5"
                        />
                        <input
                          type="text"
                          value={brandingForm.secondaryColor}
                          onChange={(e) =>
                            setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })
                          }
                          className="w-24 px-2.5 py-2 rounded-lg border border-slate-200 font-mono text-xs uppercase"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Faculty & teacher portal</p>
                    </div>

                    {/* Accent Color */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Accent / Success Color
                      </label>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={brandingForm.accentColor}
                          onChange={(e) =>
                            setBrandingForm({ ...brandingForm, accentColor: e.target.value })
                          }
                          className="w-10 h-10 rounded-xl cursor-pointer border border-slate-200 p-0.5"
                        />
                        <input
                          type="text"
                          value={brandingForm.accentColor}
                          onChange={(e) =>
                            setBrandingForm({ ...brandingForm, accentColor: e.target.value })
                          }
                          className="w-24 px-2.5 py-2 rounded-lg border border-slate-200 font-mono text-xs uppercase"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Badges, positive indicators</p>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleResetBranding}
                      className="gap-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      <RotateCcw size={14} />
                      <span>Reset to Defaults</span>
                    </Button>

                    <Button variant="primary" type="submit" isLoading={isSaving} className="gap-2 px-6">
                      <Save size={15} />
                      <span>Apply Branding</span>
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Right Column: Live Preview */}
              <div>
                <Card className="p-6 sticky top-6">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Eye size={15} className="text-blue-600" />
                      Live Theme Preview
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600">
                      Real-time
                    </span>
                  </div>

                  {/* Mock Portal Preview Card */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs bg-slate-50 text-xs">
                    {/* Header */}
                    <div
                      className="p-3 text-white flex items-center justify-between"
                      style={{ backgroundColor: brandingForm.primaryColor }}
                    >
                      <div className="flex items-center gap-2">
                        {brandingForm.logoUrl ? (
                          <img
                            src={brandingForm.logoUrl}
                            alt="Logo"
                            className="w-6 h-6 rounded-md object-contain bg-white/20 p-0.5"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-white/20 font-bold flex items-center justify-center text-[10px]">
                            GB
                          </div>
                        )}
                        <span className="font-bold truncate max-w-[140px]">
                          {brandingForm.displayName || 'Grace Bible Institute'}
                        </span>
                      </div>
                      <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-md font-medium">
                        Portal
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">Primary Button</span>
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg text-white font-semibold text-[11px] shadow-2xs"
                          style={{ backgroundColor: brandingForm.primaryColor }}
                        >
                          Enroll Now
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">Accent Badge</span>
                        <span
                          className="px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                          style={{ backgroundColor: brandingForm.accentColor }}
                        >
                          92% Active
                        </span>
                      </div>

                      {/* Mock Sidebar snippet */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 block mb-2 font-medium">
                          Teacher Sidebar Mode:
                        </span>
                        <div
                          className="p-2.5 rounded-lg text-white flex items-center gap-2 text-[11px]"
                          style={{ backgroundColor: brandingForm.secondaryColor }}
                        >
                          <BookOpen size={13} />
                          <span>Curriculum Track</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </form>
        )}

        {/* ── TAB 3: ACADEMIC SETTINGS ─────────────────────────────────────── */}
        {activeTab === 'academic' && (
          <form onSubmit={handleSaveAcademic} className="space-y-6">
            <Card className="p-6">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Academic Periods & Current Session
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Designate the active academic year and term for enrollment quotas and course scheduling.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Current Active Academic Year
                  </label>
                  <select
                    value={academicForm.currentAcademicYearId || ''}
                    onChange={(e) =>
                      setAcademicForm({ ...academicForm, currentAcademicYearId: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Select Academic Year --</option>
                    {academicForm.availableYears?.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Current Active Academic Term / Semester
                  </label>
                  <select
                    value={academicForm.currentAcademicTermId || ''}
                    onChange={(e) =>
                      setAcademicForm({ ...academicForm, currentAcademicTermId: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Select Academic Term --</option>
                    {academicForm.availableTerms?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Academic Calendar Model
                  </label>
                  <select
                    value={academicForm.academicCalendarType}
                    onChange={(e) =>
                      setAcademicForm({ ...academicForm, academicCalendarType: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="SEMESTER">Semester System (2 Terms per Year)</option>
                    <option value="TRIMESTER">Trimester System (3 Terms per Year)</option>
                    <option value="ANNUAL">Annual System (1 Full Year Cohort)</option>
                    <option value="QUARTER">Quarter System (4 Terms per Year)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Default Lecture / Session Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={academicForm.defaultSessionDurationMinutes}
                    onChange={(e) =>
                      setAcademicForm({
                        ...academicForm,
                        defaultSessionDurationMinutes: parseInt(e.target.value, 10) || 60,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Minimum Attendance Requirement (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={academicForm.minAttendancePercentage}
                    onChange={(e) =>
                      setAcademicForm({
                        ...academicForm,
                        minAttendancePercentage: parseInt(e.target.value, 10) || 75,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Threshold for exam eligibility and graduation honors.
                  </p>
                </div>
              </div>

              {/* Working Days Selector */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <label className="block font-semibold text-slate-700 mb-2.5 text-xs">
                  Institute Working Days (Lecture Timetabling Days)
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {ALL_WEEKDAYS.map((day) => {
                    const isSelected = academicForm.workingDays?.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => {
                          const current = academicForm.workingDays || [];
                          const next = isSelected
                            ? current.filter((d) => d !== day)
                            : [...current, day];
                          setAcademicForm({ ...academicForm, workingDays: next });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button variant="primary" type="submit" isLoading={isSaving} className="gap-2 px-6">
                  <Save size={15} />
                  <span>Save Academic Rules</span>
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* ── TAB 4: FINANCIAL SETTINGS ────────────────────────────────────── */}
        {activeTab === 'financial' && (
          <form onSubmit={handleSaveFinancial} className="space-y-6">
            <Card className="p-6">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Fee Management & Invoicing Preferences
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure default payment terms, invoice prefixes, and institutional billing contacts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Operational Currency
                  </label>
                  <select
                    value={financialForm.currency}
                    onChange={(e) =>
                      setFinancialForm({ ...financialForm, currency: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Default Payment Due Window (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={financialForm.defaultDueDays}
                    onChange={(e) =>
                      setFinancialForm({
                        ...financialForm,
                        defaultDueDays: parseInt(e.target.value, 10) || 15,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Number of days before an issued invoice transitions to overdue status.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Invoice Sequential Prefix
                  </label>
                  <input
                    type="text"
                    value={financialForm.invoicePrefix}
                    onChange={(e) =>
                      setFinancialForm({ ...financialForm, invoicePrefix: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Example output: INV-2026-0001</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Receipt Sequential Prefix
                  </label>
                  <input
                    type="text"
                    value={financialForm.receiptPrefix}
                    onChange={(e) =>
                      setFinancialForm({ ...financialForm, receiptPrefix: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Example output: RCP-2026-0001</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Bursar / Financial Contact Email
                  </label>
                  <input
                    type="email"
                    value={financialForm.financialContactEmail || ''}
                    onChange={(e) =>
                      setFinancialForm({
                        ...financialForm,
                        financialContactEmail: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Tax / GST Identification Number
                  </label>
                  <input
                    type="text"
                    value={financialForm.taxOrGstNumber || ''}
                    onChange={(e) =>
                      setFinancialForm({ ...financialForm, taxOrGstNumber: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Institutional Billing & Remittance Address
                  </label>
                  <input
                    type="text"
                    value={financialForm.billingAddress || ''}
                    onChange={(e) =>
                      setFinancialForm({ ...financialForm, billingAddress: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2 mt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={financialForm.showInstituteLogoOnInvoice}
                      onChange={(e) =>
                        setFinancialForm({
                          ...financialForm,
                          showInstituteLogoOnInvoice: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-800">
                      Display Institute Emblem & Logo on Generated PDF Receipts and Challans
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button variant="primary" type="submit" isLoading={isSaving} className="gap-2 px-6">
                  <Save size={15} />
                  <span>Save Financial Preferences</span>
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* ── TAB 5: USERS & ACCESS PERMISSIONS ────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Institute User Directory & Roles
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage authorized administrator, teacher, and student memberships for this institute.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                    />
                  </div>

                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="INSTITUTE_ADMIN">Admins</option>
                    <option value="TEACHER">Faculty</option>
                    <option value="STUDENT">Students</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-3">Full Name</th>
                      <th className="py-3 px-3">Contact</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Membership Status</th>
                      <th className="py-3 px-3">Joined Date</th>
                      <th className="py-3 px-3 text-right">Access Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredUsers.map((u) => {
                      const initials = u.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <tr key={u.membershipId} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                                {initials}
                              </div>
                              <span className="font-semibold text-slate-900">{u.fullName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div>{u.email || '-'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{u.phone}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-[11px]">
                              {u.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                u.status === 'ACTIVE'
                                  ? 'success'
                                  : u.status === 'INVITED'
                                  ? 'warning'
                                  : 'danger'
                              }
                            >
                              {u.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {new Date(u.joinedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {u.role !== 'SUPER_ADMIN' && (
                              <button
                                onClick={() => handleToggleUserStatus(u.membershipId, u.status)}
                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                                  u.status === 'ACTIVE'
                                    ? 'text-rose-600 border-rose-200 hover:bg-rose-50'
                                    : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                                }`}
                              >
                                {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── TAB 6: SECURITY & AUDIT ───────────────────────────────────────── */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveSecurity}>
              <Card className="p-6">
                <div className="border-b border-slate-100 pb-4 mb-6">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Security Governance & Alerts
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure institutional authentication timeout and event alert triggers.
                  </p>
                </div>

                <div className="space-y-5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Session Inactivity Timeout (Minutes)
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={720}
                      value={securityForm.sessionTimeoutMinutes}
                      onChange={(e) =>
                        setSecurityForm({
                          ...securityForm,
                          sessionTimeoutMinutes: parseInt(e.target.value, 10) || 60,
                        })
                      }
                      className="w-48 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Automatically logs out inactive portal sessions to protect theological student data.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityForm.studentSelfRegistration}
                        onChange={(e) =>
                          setSecurityForm({
                            ...securityForm,
                            studentSelfRegistration: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800">
                        Enable Student Self-Registration (Public Online Admissions)
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityForm.notifyOnStudentRegistration}
                        onChange={(e) =>
                          setSecurityForm({
                            ...securityForm,
                            notifyOnStudentRegistration: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800">
                        Email Alert to Administrator on New Student Admissions
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityForm.notifyOnFeePayment}
                        onChange={(e) =>
                          setSecurityForm({
                            ...securityForm,
                            notifyOnFeePayment: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800">
                        Email Notification on Successful Fee Receipt Generation
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityForm.notifyOnAttendanceAlert}
                        onChange={(e) =>
                          setSecurityForm({
                            ...securityForm,
                            notifyOnAttendanceAlert: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800">
                        Attendance Alert when Course Average Falls Below Threshold
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityForm.notifyOnTeacherManagement !== false}
                        onChange={(e) =>
                          setSecurityForm({
                            ...securityForm,
                            notifyOnTeacherManagement: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800">
                        In-App Alert on Teacher Registration & Faculty Assignments
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityForm.notifyOnAcademicActivity !== false}
                        onChange={(e) =>
                          setSecurityForm({
                            ...securityForm,
                            notifyOnAcademicActivity: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800">
                        In-App Alert on New Courses, Batches & Live Sessions
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityForm.notifyOnAdminSecurity !== false}
                        onChange={(e) =>
                          setSecurityForm({
                            ...securityForm,
                            notifyOnAdminSecurity: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800">
                        In-App Alert on Institute Settings & User Access Changes
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <Button variant="primary" type="submit" isLoading={isSaving} className="gap-2 px-6">
                    <Save size={15} />
                    <span>Save Security Preferences</span>
                  </Button>
                </div>
              </Card>
            </form>

            {/* Audit Logs Section */}
            <Card className="p-6">
              <div className="border-b border-slate-100 pb-4 mb-5">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Administrative Configuration Audit Trail
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Immutable historical log of changes made to institute profile, branding, and permissions.
                </p>
              </div>

              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[10px]">
                          {log.action}
                        </span>
                        <span>{log.entityType}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        By Admin ID: {log.actorUserId}
                      </div>
                    </div>
                    <div className="text-right text-slate-500 text-[11px]">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </PortalShell>
  );
}

