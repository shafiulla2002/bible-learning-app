'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { platformApi, PlatformAnalyticsDto } from '@/lib/api';
import { superAdminNav } from '@/lib/super-admin-nav';
import { formatINR } from '@/components/dashboard/dashboard-charts';
import {
  Building2,
  CreditCard,
  ShieldAlert,
  Server,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function SuperAdminDashboardPage() {
  const isSuperAdminEnabled = process.env.NEXT_PUBLIC_ENABLE_SUPER_ADMIN === 'true';
  const [data, setData] = useState<PlatformAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(isSuperAdminEnabled);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    adminName: '',
    adminPhoneE164: '+91',
    adminEmail: '',
  });

  const loadAnalytics = useCallback(async () => {
    if (!isSuperAdminEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await platformApi.getAnalytics();
      setData(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load platform overview.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdminEnabled]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (!isSuperAdminEnabled) {
    return (
      <PortalShell
        portalTitle="Super Admin"
        portalRole="SUPER_ADMIN"
        navItems={superAdminNav}
        userName="Platform Super Admin"
        userRoleLabel="On Hold"
      >
        <Card className="max-w-xl mx-auto mt-12 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Super Admin Portal — On Hold</h2>
          <p className="text-sm text-slate-600">
            Multi-tenant platform administration is currently disabled while single-institute operations are active. Set{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs">ENABLE_SUPER_ADMIN=true</code> and{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs">NEXT_PUBLIC_ENABLE_SUPER_ADMIN=true</code>{' '}
            when onboarding multiple institutes.
          </p>
          <div className="pt-2">
            <Link href="/admin">
              <Button variant="primary" size="sm">Return to Institute Admin Portal</Button>
            </Link>
          </div>
        </Card>
      </PortalShell>
    );
  }

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await platformApi.createInstitute(form);
      setSuccessMsg(`Institute "${form.name}" onboarded cleanly.`);
      setShowCreateModal(false);
      setForm({ name: '', slug: '', adminName: '', adminPhoneE164: '+91', adminEmail: '' });
      await loadAnalytics();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to onboard institute.');
    }
  };

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await platformApi.updateInstituteStatus(id, nextStatus, `Toggled via Super Admin overview`);
      setSuccessMsg(`Institute status changed to ${nextStatus}.`);
      await loadAnalytics();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update institute status.');
    }
  };

  const m = data?.metrics;

  return (
    <PortalShell
      portalTitle="Super Admin"
      portalRole="SUPER_ADMIN"
      navItems={superAdminNav}
      userName="Platform Super Admin"
      userRoleLabel="Global Root"
    >
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Platform & Multi-Institute SaaS Overview
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Manage Bible Institute tenants, onboarding applications, subscriptions, and platform-wide audit metrics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAnalytics} className="gap-1.5">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5">
              <Plus size={14} />
              Onboard Institute
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle size={15} /> {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}><X size={14} /></button>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2"><CheckCircle2 size={15} /> {successMsg}</span>
            <button onClick={() => setSuccessMsg(null)}><X size={14} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Institutes"
            value={String(m?.totalInstitutes ?? 0)}
            icon={<Building2 size={20} />}
            trend={`${m?.pendingApplications ?? 0} pending review`}
            trendPositive={true}
            colorScheme="blue"
          />
          <StatCard
            title="Active Tenants"
            value={String(m?.activeInstitutes ?? 0)}
            icon={<Server size={20} />}
            trend={`${m?.suspendedInstitutes ?? 0} suspended`}
            trendPositive={(m?.suspendedInstitutes ?? 0) === 0}
            colorScheme="emerald"
          />
          <StatCard
            title="Platform MRR"
            value={formatINR(m?.platformMrrPaise ?? 0)}
            icon={<CreditCard size={20} />}
            trend={`${m?.activeSubscriptions ?? 0} active plans`}
            trendPositive={true}
            colorScheme="purple"
          />
          <StatCard
            title="Active Learners"
            value={String(m?.totalStudents ?? 0)}
            icon={<ShieldAlert size={20} />}
            trend={`${m?.totalTeachers ?? 0} faculty · ${m?.totalCourses ?? 0} courses`}
            trendPositive={true}
            colorScheme="amber"
          />
        </div>

        <Card>
          <CardHeader
            title="Registered Bible Institutes"
            subtitle="Live tenant directory, student counts, subscription plans, and lifecycle controls"
            action={
              <Link href="/super-admin/institutes" className="text-xs font-semibold text-blue-600 hover:underline">
                View All & Applications →
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-2">Institute Name</th>
                  <th className="pb-3 px-2">Slug</th>
                  <th className="pb-3 px-2">Plan</th>
                  <th className="pb-3 px-2">Students / Faculty</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!data || data.institutes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      {loading ? 'Loading tenant data...' : 'No Bible institutes provisioned yet.'}
                    </td>
                  </tr>
                ) : (
                  data.institutes.map((inst) => (
                    <tr key={inst.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-2 font-semibold text-slate-900">{inst.name}</td>
                      <td className="py-3.5 px-2 font-mono text-slate-500">{inst.slug}</td>
                      <td className="py-3.5 px-2">
                        <Badge variant="neutral">
                          {inst.subscription?.planName || 'Unassigned'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-2 text-slate-700 font-medium">
                        {inst.studentsCount} students · {inst.teachersCount} teachers
                      </td>
                      <td className="py-3.5 px-2">
                        <Badge variant={inst.status === 'ACTIVE' ? 'success' : inst.status === 'SUSPENDED' ? 'danger' : 'warning'}>
                          {inst.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusToggle(inst.id, inst.status)}
                          className="h-7 text-xs"
                        >
                          {inst.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-6 bg-white rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Provision New Bible Institute</h3>
                <button onClick={() => setShowCreateModal(false)}><X size={16} /></button>
              </div>
              <form onSubmit={handleOnboard} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Institute Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Subdomain / Slug</label>
                  <input
                    type="text"
                    required
                    placeholder="berean-bible-college"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Initial Admin Name</label>
                  <input
                    type="text"
                    required
                    value={form.adminName}
                    onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Admin Phone (E.164)</label>
                  <input
                    type="text"
                    required
                    value={form.adminPhoneE164}
                    onChange={(e) => setForm({ ...form, adminPhoneE164: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Create Tenant
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
