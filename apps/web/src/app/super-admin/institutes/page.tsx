'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { platformApi } from '@/lib/api';
import { superAdminNav } from '@/lib/super-admin-nav';
import { RefreshCw, CheckCircle, XCircle, Building2 } from 'lucide-react';

export default function SuperAdminInstitutesPage() {
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [insts, apps] = await Promise.all([
        platformApi.listInstitutes(),
        platformApi.listApplications(),
      ]);
      setInstitutes(insts);
      setApplications(apps);
    } catch (err: any) {
      setNotice(err?.message || 'Unable to load institutes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleApprove = async (id: string) => {
    try {
      await platformApi.approveApplication(id);
      setNotice('Institute application approved and tenant provisioned.');
      await loadAll();
    } catch (err: any) {
      setNotice(err?.message || 'Approval failed.');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await platformApi.rejectApplication(id, 'Rejected by platform review');
      setNotice('Institute application rejected.');
      await loadAll();
    } catch (err: any) {
      setNotice(err?.message || 'Rejection failed.');
    }
  };

  const handleToggle = async (id: string, status: string) => {
    const next = status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await platformApi.updateInstituteStatus(id, next);
      setNotice(`Tenant transitioned to ${next}.`);
      await loadAll();
    } catch (err: any) {
      setNotice(err?.message || 'Status update failed.');
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
            <h2 className="text-2xl font-bold text-slate-900">Institutes & Onboarding Applications</h2>
            <p className="text-xs text-slate-500 mt-1">
              Review incoming institute requests and activate or suspend multi-tenant environments.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {notice && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="font-semibold">Dismiss</button>
          </div>
        )}

        <Card>
          <CardHeader title="Institute Onboarding Applications" subtitle="Approve or decline new Bible institute registrations" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-2">Institute</th>
                  <th className="py-3 px-2">Applicant</th>
                  <th className="py-3 px-2">Plan</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {applications.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">No applications found.</td></tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app.id}>
                      <td className="py-3 px-2 font-semibold">{app.instituteName} ({app.slug})</td>
                      <td className="py-3 px-2">{app.applicantName} · {app.applicantPhone}</td>
                      <td className="py-3 px-2">{app.planCode || 'Default'}</td>
                      <td className="py-3 px-2"><Badge variant="neutral">{app.status}</Badge></td>
                      <td className="py-3 px-2 text-right space-x-2">
                        {app.status === 'PENDING' && (
                          <>
                            <Button size="sm" variant="primary" onClick={() => handleApprove(app.id)} className="h-7 gap-1 text-xs">
                              <CheckCircle size={12} /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReject(app.id)} className="h-7 gap-1 text-xs">
                              <XCircle size={12} /> Reject
                            </Button>
                          </>
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
          <CardHeader title="Provisioned Tenants" subtitle="All isolated Bible Institute environments" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-2">Name</th>
                  <th className="py-3 px-2">Courses</th>
                  <th className="py-3 px-2">Students</th>
                  <th className="py-3 px-2">Teachers</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {institutes.map((inst) => (
                  <tr key={inst.id}>
                    <td className="py-3 px-2 font-semibold flex items-center gap-2">
                      <Building2 size={14} className="text-blue-600" /> {inst.name}
                    </td>
                    <td className="py-3 px-2">{inst.coursesCount}</td>
                    <td className="py-3 px-2">{inst.studentsCount}</td>
                    <td className="py-3 px-2">{inst.teachersCount}</td>
                    <td className="py-3 px-2">
                      <Badge variant={inst.status === 'ACTIVE' ? 'success' : 'danger'}>{inst.status}</Badge>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => handleToggle(inst.id, inst.status)} className="h-7 text-xs">
                        {inst.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                      </Button>
                    </td>
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

