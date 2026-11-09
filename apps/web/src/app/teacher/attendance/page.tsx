'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Save,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Info,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';

interface TeacherBatchItem {
  id: string;
  name: string;
  code: string | null;
  courseId: string;
  courseTitle: string;
  role: string;
  totalStudents: number;
  status: string;
}

interface StudentRosterItem {
  studentProfileId: string;
  admissionNo: string;
  fullName: string;
  email: string | null;
  enrolmentId: string;
  enrolmentStatus: string;
  enrolledAt: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  isMarked: boolean;
  remarks: string;
  markedAt: string | null;
}

interface AttendanceSummary {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendanceRatePct: number;
  isRecorded: boolean;
}

export default function TeacherAttendancePage() {
  const [batches, setBatches] = useState<TeacherBatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('access_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // 1. Fetch real assigned batches
  const fetchBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    setError(null);
    try {
      const res = await fetch('/api/teachers/attendance/batches', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Failed to load batches (${res.status})`);
      }
      const data = await res.json();
      const loadedBatches: TeacherBatchItem[] = data.batches || [];
      setBatches(loadedBatches);
      if (loadedBatches.length > 0 && !selectedBatchId) {
        setSelectedBatchId(loadedBatches[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching teacher batches:', err);
      setError(err?.message || 'Failed to retrieve your assigned teaching cohorts');
      setBatches([]);
    } finally {
      setIsLoadingBatches(false);
    }
  }, [selectedBatchId]);

  // 2. Fetch real roster for selected batch & date
  const fetchRoster = useCallback(async (batchId: string, date: string) => {
    if (!batchId) return;
    setIsLoadingRoster(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/teachers/attendance/roster?batchId=${batchId}&date=${date}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Failed to load roster (${res.status})`);
      }
      const data = await res.json();
      setRoster(data.roster || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      console.error('Error fetching roster:', err);
      setError(err?.message || 'Failed to retrieve attendance roster');
      setRoster([]);
      setSummary(null);
    } finally {
      setIsLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    if (selectedBatchId) {
      fetchRoster(selectedBatchId, selectedDate);
    }
  }, [selectedBatchId, selectedDate, fetchRoster]);

  // Handle single student status change
  const handleStatusChange = (studentProfileId: string, newStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED') => {
    setRoster((prev) =>
      prev.map((item) =>
        item.studentProfileId === studentProfileId ? { ...item, status: newStatus } : item
      )
    );
  };

  // Handle single student remarks change
  const handleRemarksChange = (studentProfileId: string, remarks: string) => {
    setRoster((prev) =>
      prev.map((item) =>
        item.studentProfileId === studentProfileId ? { ...item, remarks } : item
      )
    );
  };

  // Mark all students present
  const handleMarkAllPresent = () => {
    setRoster((prev) => prev.map((item) => ({ ...item, status: 'PRESENT' })));
  };

  // Save attendance to backend
  const handleSaveAttendance = async () => {
    if (!selectedBatchId || roster.length === 0) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const payload = {
        batchId: selectedBatchId,
        date: selectedDate,
        records: roster.map((r) => ({
          studentProfileId: r.studentProfileId,
          enrolmentId: r.enrolmentId,
          status: r.status,
          remarks: r.remarks,
        })),
      };

      const res = await fetch('/api/teachers/attendance/mark', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Failed to save attendance (${res.status})`);
      }

      const resData = await res.json();
      setSuccessMessage(resData.message || 'Attendance saved successfully to database');
      await fetchRoster(selectedBatchId, selectedDate);
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      setError(err?.message || 'Failed to save attendance records');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  // Calculate live statistics
  const livePresent = roster.filter((r) => r.status === 'PRESENT').length;
  const liveLate = roster.filter((r) => r.status === 'LATE').length;
  const liveAbsent = roster.filter((r) => r.status === 'ABSENT').length;
  const liveExcused = roster.filter((r) => r.status === 'EXCUSED').length;
  const liveRate = roster.length > 0 ? Math.round(((livePresent + liveLate) / roster.length) * 100) : 0;

  return (
    <TeacherShell pageTitle="Attendance Management">
      <div className="space-y-6">

        {/* 1. Header Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-md border border-white/10">
                <CalendarCheck size={13} className="text-indigo-400" />
                <span>Lecture & Cohort Attendance</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Record Cohort Attendance
              </h1>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                Take and record daily attendance for your assigned Bible students. 
                Records are securely verified and stored in the central LMS database.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
                <span className="block text-2xl font-black text-white">{liveRate}%</span>
                <span className="text-[11px] text-indigo-200 font-medium uppercase tracking-wider">
                  Attendance Rate
                </span>
              </div>
              <div className="px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
                <span className="block text-2xl font-black text-white">{roster.length}</span>
                <span className="text-[11px] text-indigo-200 font-medium uppercase tracking-wider">
                  Students in Cohort
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Feedback Banners */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
              <div>
                <p className="text-sm font-bold">Attendance Error</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchRoster(selectedBatchId, selectedDate)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 shadow-xs animate-in fade-in">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold">{successMessage}</p>
          </div>
        )}

        {/* 3. Batch and Date Selection Card */}
        <div className="p-4 md:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Batch Selector */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assigned Teaching Batch
              </label>
              {isLoadingBatches ? (
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ) : batches.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                  No active batches are assigned to your teacher account.
                </div>
              ) : (
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-medium"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.courseTitle}) — {b.totalStudents} enrolled
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Attendance Date
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs md:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-medium"
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics & Actions Bar */}
          {selectedBatch && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Course:</span>
                <span className="text-xs font-bold text-slate-800">{selectedBatch.courseTitle}</span>
                {selectedBatch.code && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                    {selectedBatch.code}
                  </span>
                )}
                {summary?.isRecorded && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 size={11} className="text-emerald-500" />
                    Recorded on Database
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  disabled={roster.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={isSaving || roster.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{isSaving ? 'Saving...' : 'Save Attendance'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Live Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs text-center">
            <span className="block text-xl font-bold text-slate-800">{roster.length}</span>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-2xs text-center">
            <span className="block text-xl font-bold text-emerald-700">{livePresent}</span>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Present</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 shadow-2xs text-center">
            <span className="block text-xl font-bold text-amber-700">{liveLate}</span>
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Late</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 shadow-2xs text-center">
            <span className="block text-xl font-bold text-rose-700">{liveAbsent}</span>
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Absent</span>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 shadow-2xs text-center">
            <span className="block text-xl font-bold text-blue-700">{liveExcused}</span>
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Excused</span>
          </div>
        </div>

        {/* 5. Roster Attendance List Table */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
          {isLoadingRoster ? (
            <div className="p-6 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 bg-slate-200 rounded" />
                      <div className="h-3 w-20 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="h-8 w-48 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : roster.length === 0 ? (
            <div className="py-16 px-6 text-center max-w-md mx-auto space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Users size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900">No students enrolled in this cohort</h3>
              <p className="text-xs text-slate-500">
                This batch does not currently have active student enrolments. Once students are enrolled by an administrator, they will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Student</th>
                    <th className="py-3.5 px-4">Admission No</th>
                    <th className="py-3.5 px-6 text-center">Attendance Status</th>
                    <th className="py-3.5 px-6">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {roster.map((student) => {
                    const initials = student.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={student.studentProfileId} className="hover:bg-slate-50/80 transition-colors">
                        {/* Student Name */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-800 to-indigo-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {initials}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{student.fullName}</p>
                              {student.email && (
                                <p className="text-[11px] text-slate-500">{student.email}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Admission No */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                          {student.admissionNo}
                        </td>

                        {/* Status Toggle Buttons */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.studentProfileId, 'PRESENT')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                student.status === 'PRESENT'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.studentProfileId, 'LATE')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                student.status === 'LATE'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                              }`}
                            >
                              Late
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.studentProfileId, 'ABSENT')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                student.status === 'ABSENT'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.studentProfileId, 'EXCUSED')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                student.status === 'EXCUSED'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                              }`}
                            >
                              Excused
                            </button>
                          </div>
                        </td>

                        {/* Remarks Input */}
                        <td className="py-3.5 px-6">
                          <input
                            type="text"
                            value={student.remarks}
                            onChange={(e) => handleRemarksChange(student.studentProfileId, e.target.value)}
                            placeholder="Optional notes..."
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Save Bar */}
          {roster.length > 0 && (
            <div className="p-4 md:p-5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Ready to submit <span className="font-semibold text-slate-800">{roster.length}</span> attendance records for {selectedDate}.
              </span>
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Save size={14} />
                <span>{isSaving ? 'Saving Changes...' : 'Save Attendance'}</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </TeacherShell>
  );
}
