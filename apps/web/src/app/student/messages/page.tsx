'use client';

import React, { useEffect, useState } from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { Card } from '@/components/ui/card';
import { Bell, CheckCheck, ExternalLink, MessageSquare, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export default function StudentMessagesPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any>('/students/notifications');
      const list = Array.isArray(res) ? res : res?.items || res?.notifications || [];
      setItems(list);
    } catch (err: any) {
      setError(err?.message || 'Unable to load messages and notices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/students/notifications/${id}/read`, { method: 'PATCH' });
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, readAt: new Date().toISOString() } : it)));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/students/notifications/mark-all-read', { method: 'POST', body: '{}' });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((it) => ({ ...it, readAt: it.readAt || now })));
    } catch {}
  };

  const unreadCount = items.filter((i) => !i.readAt).length;

  return (
    <StudentShell pageTitle="Messages & Announcements">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Messages & Announcements</h1>
            <p className="text-xs text-slate-500 mt-1">
              Official institute notices, admission updates, class reminders, and academic alerts ({unreadCount} unread).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                <CheckCheck size={14} /> Mark All Read
              </button>
            )}
            <button
              onClick={loadNotifications}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <Card className="p-4 bg-rose-50 border-rose-200 text-rose-700 text-xs">{error}</Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="p-10 text-center">
            <MessageSquare size={32} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">No Announcements Yet</h3>
            <p className="text-xs text-slate-500 mt-1">
              Notices from your institute administration and instructors will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card
                key={item.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !item.readAt ? 'border-l-4 border-l-blue-600 bg-blue-50/20' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                    <Bell size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900">{item.title}</h3>
                      {!item.readAt && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{item.body}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(item.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.link && (
                    <Link
                      href={item.link}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800"
                    >
                      View <ExternalLink size={12} />
                    </Link>
                  )}
                  {!item.readAt && (
                    <button
                      onClick={() => markRead(item.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
