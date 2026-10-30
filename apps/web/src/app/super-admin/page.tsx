'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Building2,
  Package,
  CreditCard,
  ShieldAlert,
  Server,
  CheckCircle,
  XCircle,
  Plus,
} from 'lucide-react';

const superAdminNav = [
  { label: 'Platform Dashboard', href: '/super-admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Institutes & Tenants', href: '/super-admin/institutes', icon: <Building2 size={18} />, badge: '1 Application' },
  { label: 'Subscription Plans', href: '/super-admin/plans', icon: <Package size={18} /> },
  { label: 'Platform Billing', href: '/super-admin/billing', icon: <CreditCard size={18} /> },
  { label: 'System Audit Logs', href: '/super-admin/logs', icon: <ShieldAlert size={18} /> },
];

export default function SuperAdminDashboardPage() {
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
              Manage Bible Institute tenants, SaaS subscriptions, storage quotas, and platform-wide metrics.
            </p>
          </div>
          <Button variant="primary" size="sm" className="gap-1.5">
            <Plus size={14} />
            Onboard Institute
          </Button>
        </div>

        {/* 4 Platform Stat Cards (eSchool Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Institutes"
            value="18"
            icon={<Building2 size={20} />}
            trend="+2 This Month"
            trendPositive={true}
            colorScheme="blue"
          />
          <StatCard
            title="Active Tenants"
            value="17"
            icon={<Server size={20} />}
            trend="1 In Review"
            trendPositive={true}
            colorScheme="emerald"
          />
          <StatCard
            title="Platform MRR"
            value="₹1,24,000"
            icon={<CreditCard size={20} />}
            trend="+15% Renewal Rate"
            trendPositive={true}
            colorScheme="purple"
          />
          <StatCard
            title="Active Learners"
            value="3,420"
            icon={<ShieldAlert size={20} />}
            trend="Across All Tenants"
            trendPositive={true}
            colorScheme="amber"
          />
        </div>

        {/* Institute Tenants Table */}
        <Card>
          <CardHeader
            title="Registered Bible Institutes"
            subtitle="Tenant isolation status, active subscription plan, and health"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-2">Institute Name</th>
                  <th className="pb-3 px-2">Location</th>
                  <th className="pb-3 px-2">Subscription Plan</th>
                  <th className="pb-3 px-2">Learners</th>
                  <th className="pb-3 px-2">Tenant Status</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                <tr className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-2">
                    <div className="font-semibold text-slate-900">Berean Bible College</div>
                    <div className="text-[10px] text-slate-400">berean-bible.ac.in</div>
                  </td>
                  <td className="py-3 px-2 text-slate-500">Bangalore, India</td>
                  <td className="py-3 px-2">
                    <span className="font-medium text-blue-600">Growth Plan (Annual)</span>
                  </td>
                  <td className="py-3 px-2 font-medium">342</td>
                  <td className="py-3 px-2">
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Button size="sm" variant="outline" className="text-xs">
                      Manage Tenant
                    </Button>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-2">
                    <div className="font-semibold text-slate-900">Bethany Theological Seminary</div>
                    <div className="text-[10px] text-slate-400">bethany-seminary.edu</div>
                  </td>
                  <td className="py-3 px-2 text-slate-500">Hyderabad, India</td>
                  <td className="py-3 px-2">
                    <span className="font-medium text-purple-600">Starter Plan (Monthly)</span>
                  </td>
                  <td className="py-3 px-2 font-medium">120</td>
                  <td className="py-3 px-2">
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Button size="sm" variant="outline" className="text-xs">
                      Manage Tenant
                    </Button>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-2">
                    <div className="font-semibold text-slate-900">Grace Christian Institute</div>
                    <div className="text-[10px] text-slate-400">grace-inst.org (Pending)</div>
                  </td>
                  <td className="py-3 px-2 text-slate-500">Chennai, India</td>
                  <td className="py-3 px-2">
                    <span className="font-medium text-slate-500">14-Day Free Trial</span>
                  </td>
                  <td className="py-3 px-2 font-medium">--</td>
                  <td className="py-3 px-2">
                    <Badge variant="warning">Application Pending</Badge>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Button size="sm" variant="primary" className="text-xs px-2.5 py-1">
                      Approve Application
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PortalShell>
  );
}
