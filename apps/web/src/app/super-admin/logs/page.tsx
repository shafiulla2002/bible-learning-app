'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { platformApi } from '@/lib/api';
import { superAdminNav } from '@/lib/super-admin-nav';
import { RefreshCw } from 'lucide-react';

export default function SuperAdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await platformApi.listAuditLogs(100);
      setLogs(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load platform audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

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
            <h2 className="text-2xl font-bold text-slate-900">Platform Audit Logs</h2>
            <p className="text-xs text-slate-500 mt-1">
              Immutable ledger of tenant provisioning, plan updates, and super-admin actions.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadLogs} className="gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{errorMsg}</div>
        )}

        <Card>
          <CardHeader title="Recent Platform Events" subtitle={`Showing ${logs.length} most recent audit records`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-2">Timestamp</th>
                  <th className="py-3 px-2">Action</th>
                  <th className="py-3 px-2">Entity</th>
                  <th className="py-3 px-2">Actor</th>
                  <th className="py-3 px-2">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">No platform audit logs recorded yet.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 px-2 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="py-3 px-2"><Badge variant="neutral">{log.action}</Badge></td>
                      <td className="py-3 px-2 font-mono text-slate-700">{log.entityType}:{log.entityId.slice(0, 8)}</td>
                      <td className="py-3 px-2">{log.actorRole} ({log.actorUserId.slice(0, 8)})</td>
                      <td className="py-3 px-2 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                        {JSON.stringify(log.metadata || {})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PortalShell>
  );
}

