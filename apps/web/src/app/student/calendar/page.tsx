'use client';

import React, { useEffect, useState } from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { Card } from '@/components/ui/card';
import { Calendar as CalendarIcon, Video, FileText, GraduationCap, RefreshCw, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface CalendarEventItem {
  id: string;
  title: string;
  date: string;
  kind: 'LIVE_CLASS' | 'ASSIGNMENT' | 'EXAM';
  courseTitle: string;
  subtitle?: string;
  href: string;
}

export default function StudentCalendarPage() {
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [filterKind, setFilterKind] = useState<'ALL' | 'LIVE_CLASS' | 'ASSIGNMENT' | 'EXAM'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsRes, assignmentsRes, examsRes] = await Promise.all([
        apiFetch<any>('/students/live-sessions').catch(() => ({ sessions: [] })),
        apiFetch<any>('/students/assignments').catch(() => ({ assignments: [] })),
        apiFetch<any>('/students/exams').catch(() => ({ exams: [] })),
      ]);

      const merged: CalendarEventItem[] = [];

      for (const s of sessionsRes?.sessions || []) {
        merged.push({
          id: `live-${s.id}`,
          title: s.title,
          date: s.startsAt,
          kind: 'LIVE_CLASS',
          courseTitle: s.courseTitle || 'Live Cohort',
          subtitle: s.teacherName ? `Faculty: ${s.teacherName}` : s.batchName,
          href: '/student/classes',
        });
      }

      for (const a of assignmentsRes?.assignments || []) {
        if (a.dueAt) {
          merged.push({
            id: `asg-${a.id}`,
            title: `${a.title} (Due)`,
            date: a.dueAt,
            kind: 'ASSIGNMENT',
            courseTitle: a.courseTitle || 'Course Assignment',
            subtitle: a.submissionStatus ? `Status: ${a.submissionStatus}` : 'Pending submission',
            href: `/student/assignments/${a.id}`,
          });
        }
      }

      for (const ex of examsRes?.exams || []) {
        const dt = ex.startAt || ex.endAt;
        if (dt) {
          merged.push({
            id: `exam-${ex.id}`,
            title: ex.title,
            date: dt,
            kind: 'EXAM',
            courseTitle: ex.courseTitle || 'Course Exam',
            subtitle: ex.durationMin ? `${ex.durationMin} min assessment` : 'Assessment window',
            href: `/student/exams/${ex.id}`,
          });
        }
      }

      merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(merged);
    } catch (err: any) {
      setError(err?.message || 'Failed to load academic calendar events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const filtered = filterKind === 'ALL' ? events : events.filter((e) => e.kind === filterKind);

  return (
    <StudentShell pageTitle="Academic Calendar">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Academic Calendar & Deadlines</h1>
            <p className="text-xs text-slate-500 mt-1">
              Synchronized live classes, assignment due dates, and examination schedules from your enrolled batches.
            </p>
          </div>
          <button
            onClick={loadSchedule}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Schedule
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['ALL', 'LIVE_CLASS', 'ASSIGNMENT', 'EXAM'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilterKind(k)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                filterKind === k
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {k === 'ALL' ? 'All Events' : k === 'LIVE_CLASS' ? 'Live Classes' : k === 'ASSIGNMENT' ? 'Assignments' : 'Exams'}
            </button>
          ))}
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
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <CalendarIcon size={32} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">No Upcoming Academic Events</h3>
            <p className="text-xs text-slate-500 mt-1">
              Scheduled live lectures, assignments, and exams for your cohorts will appear here automatically.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((ev) => {
              const dt = new Date(ev.date);
              const Icon = ev.kind === 'LIVE_CLASS' ? Video : ev.kind === 'ASSIGNMENT' ? FileText : GraduationCap;
              const badgeClass =
                ev.kind === 'LIVE_CLASS'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : ev.kind === 'ASSIGNMENT'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200';

              return (
                <Card key={ev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl border ${badgeClass}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                          {ev.kind.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-medium text-slate-500">{ev.courseTitle}</span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 mt-1">{ev.title}</h3>
                      {ev.subtitle && <p className="text-xs text-slate-500 mt-0.5">{ev.subtitle}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right text-xs text-slate-600 flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-400" />
                      <span>
                        {dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                        {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <Link
                      href={ev.href}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      Open
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
