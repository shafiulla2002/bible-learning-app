'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { platformApi } from '@/lib/api';
import { superAdminNav } from '@/lib/super-admin-nav';
import { formatINR } from '@/components/dashboard/dashboard-charts';
import { Plus, RefreshCw, X } from 'lucide-react';

export default function SuperAdminPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    priceMonthlyInr: 4999,
    priceYearlyInr: 49990,
    maxStudents: 250,
    maxTeachers: 25,
    maxCourses: 40,
    storageGb: 25,
  });

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await platformApi.listPlans();
      setPlans(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load SaaS plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await platformApi.createPlan({
        code: form.code.toUpperCase(),
        name: form.name,
        priceMonthly: Math.round(form.priceMonthlyInr * 100),
        priceYearly: Math.round(form.priceYearlyInr * 100),
        maxStudents: form.maxStudents,
        maxTeachers: form.maxTeachers,
        maxCourses: form.maxCourses,
        storageGb: form.storageGb,
      });
      setShowModal(false);
      setForm({
        code: '',
        name: '',
        priceMonthlyInr: 4999,
        priceYearlyInr: 49990,
        maxStudents: 250,
        maxTeachers: 25,
        maxCourses: 40,
        storageGb: 25,
      });
      await loadPlans();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create plan.');
    }
  };

  return (
    <PortalShell
      portalTitle="Super Admin"
      portalRole="SUPER_ADMIN"
      navItems={superAdminNav}
      userName="Platform Super Admin"
      userRoleLabel="Global Root"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">SaaS Subscription Plans</h2>
            <p className="text-xs text-slate-500 mt-1">Configure pricing tiers and tenant resource quotas.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadPlans} className="gap-1.5">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
              <Plus size={14} /> New Plan
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{errorMsg}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <Card key={p.id} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-600">{p.code}</span>
                <Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
              <div className="text-xs text-slate-600">
                <div>Monthly: <strong className="text-slate-900">{formatINR(p.priceMonthly)}</strong></div>
                <div>Yearly: <strong className="text-slate-900">{formatINR(p.priceYearly)}</strong></div>
              </div>
              <div className="pt-2 border-t text-xs text-slate-500 space-y-1">
                <div>Max Students: {p.maxStudents}</div>
                <div>Max Teachers: {p.maxTeachers} · Courses: {p.maxCourses}</div>
                <div>Storage: {p.storageGb} GB · Tenants: {p._count?.subscriptions ?? 0}</div>
              </div>
            </Card>
          ))}
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-6 bg-white rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Create SaaS Plan</h3>
                <button onClick={() => setShowModal(false)}><X size={16} /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Code</label>
                    <input type="text" required placeholder="SEMINARY_PRO" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 border rounded-xl font-mono" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Name</label>
                    <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Monthly (INR)</label>
                    <input type="number" required min={0} value={form.priceMonthlyInr} onChange={(e) => setForm({ ...form, priceMonthlyInr: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Yearly (INR)</label>
                    <input type="number" required min={0} value={form.priceYearlyInr} onChange={(e) => setForm({ ...form, priceYearlyInr: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">Students</label>
                    <input type="number" min={1} value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: Number(e.target.value) })} className="w-full px-2 py-2 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Teachers</label>
                    <input type="number" min={1} value={form.maxTeachers} onChange={(e) => setForm({ ...form, maxTeachers: Number(e.target.value) })} className="w-full px-2 py-2 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Storage GB</label>
                    <input type="number" min={1} value={form.storageGb} onChange={(e) => setForm({ ...form, storageGb: Number(e.target.value) })} className="w-full px-2 py-2 border rounded-xl" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" size="sm">Create Plan</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </PortalShell>
  );
}

