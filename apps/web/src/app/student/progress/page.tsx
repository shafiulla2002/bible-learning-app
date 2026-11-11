'use client';

import React, { useEffect, useState } from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { Card } from '@/components/ui/card';
import { BookOpen, CalendarCheck2, Award, RefreshCw, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

export default function StudentProgressPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = async () => {
    setLoading(true);
    setError(null);
    try {
      const [coursesRes, attRes] = await Promise.all([
        apiFetch<any>('/students/courses'),
        apiFetch<any>('/students/attendance/summary').catch(() => null),
      ]);
      const list = Array.isArray(coursesRes) ? coursesRes : coursesRes?.courses || [];
      setCourses(list);
      setAttendanceSummary(attRes?.summary || attRes || null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load learning progress.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, []);

  const avgProgress =
    courses.length > 0
      ? Math.round(
          courses.reduce((s, c) => s + Number(c.progressPct ?? c.progressPercent ?? 0), 0) / courses.length,
        )
      : 0;
  const completedCount = courses.filter((c) => c.status === 'COMPLETED' || Number(c.progressPct ?? 0) >= 100).length;

  return (
    <StudentShell pageTitle="Learning Progress">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Learning Progress & Attendance</h1>
            <p className="text-xs text-slate-500 mt-1">
              Real-time lesson completion and cohort attendance calculated from your academic records.
            </p>
          </div>
          <button
            onClick={loadProgress}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <Card className="p-4 bg-rose-50 border-rose-200 text-rose-700 text-xs">{error}</Card>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600"><TrendingUp size={20} /></div>
            <div>
              <div className="text-xs text-slate-500">Overall Course Completion</div>
              <div className="text-2xl font-bold text-slate-900">{avgProgress}%</div>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600"><Award size={20} /></div>
            <div>
              <div className="text-xs text-slate-500">Completed Courses</div>
              <div className="text-2xl font-bold text-slate-900">
                {completedCount} / {courses.length}
              </div>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600"><CalendarCheck2 size={20} /></div>
            <div>
              <div className="text-xs text-slate-500">Attendance Rate</div>
              <div className="text-2xl font-bold text-slate-900">
                {attendanceSummary?.attendanceRate ?? attendanceSummary?.percentage ?? 0}%
              </div>
            </div>
          </Card>
        </div>

        {loading ? (
          <div className="h-40 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : courses.length === 0 ? (
          <Card className="p-10 text-center">
            <BookOpen size={32} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-bold text-slate-800 text-sm">No Enrolled Courses Found</h3>
            <p className="text-xs text-slate-500 mt-1">Once enrolled in a course, per-module completion metrics appear here.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {courses.map((c) => {
              const pct = Number(c.progressPct ?? c.progressPercent ?? 0);
              return (
                <Card key={c.courseId || c.id} className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{c.course?.title || c.title}</h3>
                      <p className="text-xs text-slate-500">
                        Batch: {c.batch?.name || c.batchName || 'Assigned Cohort'} • Status: {c.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-blue-700">{pct}%</span>
                      <Link
                        href={`/student/courses/${c.courseId || c.course?.id}`}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        Resume Course
                      </Link>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
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
