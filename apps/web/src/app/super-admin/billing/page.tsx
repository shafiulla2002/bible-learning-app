'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { platformApi } from '@/lib/api';
import { superAdminNav } from '@/lib/super-admin-nav';
import { formatINR } from '@/components/dashboard/dashboard-charts';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export default function SuperAdminBillingPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    try {
      const [invs, subs] = await Promise.all([
        platformApi.listInvoices(),
        platformApi.listSubscriptions(),
      ]);
      setInvoices(invs);
      setSubscriptions(subs);
    } catch (err: any) {
      setNotice(err?.message || 'Unable to load platform billing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const handleMarkPaid = async (id: string) => {
    try {
      await platformApi.markInvoicePaid(id);
      setNotice('Subscription invoice marked as PAID and subscription activated.');
      await loadBilling();
    } catch (err: any) {
      setNotice(err?.message || 'Failed to mark invoice paid.');
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
            <h2 className="text-2xl font-bold text-slate-900">Platform Subscriptions & Billing</h2>
            <p className="text-xs text-slate-500 mt-1">Track SaaS subscription cycles and B2B platform invoices.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadBilling} className="gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>

        {notice && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="font-semibold">Dismiss</button>
          </div>
        )}

        <Card>
          <CardHeader title="SaaS Subscription Invoices" subtitle="Manage tenant renewal billing" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-2">Invoice No</th>
                  <th className="py-3 px-2">Institute</th>
                  <th className="py-3 px-2">Plan</th>
                  <th className="py-3 px-2">Total</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-500">No subscription invoices issued.</td></tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 px-2 font-mono font-bold">{inv.number}</td>
                      <td className="py-3 px-2">{inv.institute?.name}</td>
                      <td className="py-3 px-2">{inv.subscription?.plan?.name || '—'}</td>
                      <td className="py-3 px-2 font-bold">{formatINR(inv.total)}</td>
                      <td className="py-3 px-2">
                        <Badge variant={inv.status === 'PAID' ? 'success' : 'warning'}>{inv.status}</Badge>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {inv.status !== 'PAID' && (
                          <Button size="sm" variant="primary" onClick={() => handleMarkPaid(inv.id)} className="h-7 gap-1 text-xs">
                            <CheckCircle2 size={12} /> Mark Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Active Tenant Subscriptions" subtitle={`${subscriptions.length} subscription records`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-2">Institute</th>
                  <th className="py-3 px-2">Plan</th>
                  <th className="py-3 px-2">Cycle</th>
                  <th className="py-3 px-2">Period End</th>
                  <th className="py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="py-3 px-2 font-semibold">{sub.institute?.name}</td>
                    <td className="py-3 px-2">{sub.plan?.name} ({sub.plan?.code})</td>
                    <td className="py-3 px-2">{sub.cycle}</td>
                    <td className="py-3 px-2">{new Date(sub.periodEnd).toLocaleDateString()}</td>
                    <td className="py-3 px-2"><Badge variant="neutral">{sub.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PortalShell>
  );
}

