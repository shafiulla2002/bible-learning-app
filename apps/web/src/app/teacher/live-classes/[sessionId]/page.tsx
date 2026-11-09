'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Calendar,
  Clock,
  Video,
  ExternalLink,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Edit,
  Save,
  RefreshCw,
  Copy,
  Check,
  Search,
  Filter,
  UserCheck,
  X,
  Radio,
  FileText,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import {
  useTeacherLiveClassDetail,
  RosterStudentItem,
} from '@/lib/use-teacher-live-class-detail';

export default function TeacherLiveClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  const {
    session,
    roster,
    attendanceSummary,
    isLoading,
    error,
    updateClass,
    cancelClass,
    markAttendance,
    refresh,
  } = useTeacherLiveClassDetail(sessionId);

  // Local editable attendance state: studentProfileId -> { status, remarks }
  const [attendanceEdits, setAttendanceEdits] = useState<
    Record<string, { status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'; remarks: string }>
  >({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceSaveMessage, setAttendanceSaveMessage] = useState<string | null>(null);

  // Search & Filter for Roster
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'UNMARKED'>('ALL');

  // Edit Class Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editJoinUrl, setEditJoinUrl] = useState('');
  const [editRecordingUrl, setEditRecordingUrl] = useState('');
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Cancel Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);

  // Initialize attendance edits when roster loads
  useEffect(() => {
    if (roster && roster.length > 0) {
      const initial: Record<string, { status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'; remarks: string }> = {};
      roster.forEach((r) => {
        if (r.attendanceStatus) {
          initial[r.studentProfileId] = {
            status: r.attendanceStatus,
            remarks: r.remarks || '',
          };
        }
      });
      setAttendanceEdits(initial);
      setHasUnsavedChanges(false);
    }
  }, [roster]);

  const handleOpenEditModal = () => {
    if (!session) return;
    setEditTitle(session.title);
    setEditDescription(session.description || '');
    setEditRoom(session.room || '');
    const start = new Date(session.startsAt);
    const end = new Date(session.endsAt);
    setEditDate(start.toISOString().split('T')[0]);
    setEditStartTime(start.toTimeString().substring(0, 5));
    setEditEndTime(end.toTimeString().substring(0, 5));
    setEditJoinUrl(session.joinUrl || '');
    setEditRecordingUrl(session.recordingUrl || '');
    setEditSubmitError(null);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setEditSubmitError('Class title is required');
      return;
    }

    const startsAt = new Date(`${editDate}T${editStartTime}:00`);
    const endsAt = new Date(`${editDate}T${editEndTime}:00`);

    if (startsAt >= endsAt) {
      setEditSubmitError('End time must be after start time');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      await updateClass({
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        room: editRoom.trim() || undefined,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        joinUrl: editJoinUrl.trim() || undefined,
        recordingUrl: editRecordingUrl.trim() || undefined,
      });

      setEditModalOpen(false);
    } catch (err: any) {
      setEditSubmitError(err.message || 'Failed to update live class');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsSubmittingCancel(true);
    try {
      await cancelClass(cancelReason);
      setCancelModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel session');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleStatusChange = (
    studentProfileId: string,
    newStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
  ) => {
    setAttendanceEdits((prev) => ({
      ...prev,
      [studentProfileId]: {
        status: newStatus,
        remarks: prev[studentProfileId]?.remarks || '',
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleRemarksChange = (studentProfileId: string, remarks: string) => {
    setAttendanceEdits((prev) => ({
      ...prev,
      [studentProfileId]: {
        status: prev[studentProfileId]?.status || 'PRESENT',
        remarks,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'; remarks: string }> = { ...attendanceEdits };
    roster.forEach((student) => {
      updated[student.studentProfileId] = {
        status: 'PRESENT',
        remarks: updated[student.studentProfileId]?.remarks || '',
      };
    });
    setAttendanceEdits(updated);
    setHasUnsavedChanges(true);
  };

  const handleSaveAttendance = async () => {
    const records = Object.entries(attendanceEdits).map(([studentProfileId, data]) => ({
      studentProfileId,
      status: data.status,
      remarks: data.remarks.trim() || undefined,
    }));

    if (records.length === 0) return;

    setIsSavingAttendance(true);
    setAttendanceSaveMessage(null);
    try {
      await markAttendance(records);
      setHasUnsavedChanges(false);
      setAttendanceSaveMessage('Attendance saved successfully');
      setTimeout(() => setAttendanceSaveMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleCopyLink = () => {
    if (!session?.joinUrl) return;
    navigator.clipboard.writeText(session.joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoading && !session) {
    return (
      <TeacherShell pageTitle="Class Details">
        <div className="p-8 space-y-6 max-w-6xl mx-auto">
          <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
          <div className="h-44 bg-slate-100 rounded-3xl animate-pulse" />
          <div className="h-96 bg-slate-100 rounded-3xl animate-pulse" />
        </div>
      </TeacherShell>
    );
  }

  if (error || !session) {
    return (
      <TeacherShell pageTitle="Class Details">
        <div className="p-8 max-w-lg mx-auto text-center space-y-4">
          <AlertCircle size={40} className="text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">Session Not Found</h2>
          <p className="text-xs text-slate-500">{error || 'This live class session could not be found.'}</p>
          <Link
            href="/teacher/live-classes"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
          >
            <ChevronLeft size={16} />
            <span>Back to Live Classes</span>
          </Link>
        </div>
      </TeacherShell>
    );
  }

  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const isLive = session.status === 'LIVE' || (start <= new Date() && end >= new Date() && session.status !== 'CANCELLED');
  const isCancelled = session.status === 'CANCELLED';
  const isCompleted = session.status === 'COMPLETED' || end < new Date();

  // Filter roster
  const filteredRoster = roster.filter((student) => {
    const currentStatus = attendanceEdits[student.studentProfileId]?.status || student.attendanceStatus;
    if (rosterStatusFilter !== 'ALL') {
      if (rosterStatusFilter === 'UNMARKED' && currentStatus) return false;
      if (rosterStatusFilter !== 'UNMARKED' && currentStatus !== rosterStatusFilter) return false;
    }
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      return (
        student.fullName.toLowerCase().includes(q) ||
        (student.admissionNumber && student.admissionNumber.toLowerCase().includes(q)) ||
        (student.email && student.email.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <TeacherShell pageTitle={`Live Class: ${session.title}`}>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher/live-classes"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition shadow-xs"
            >
              <ChevronLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  {session.courseTitle}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-purple-600">
                  {session.batchName}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                {session.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {session.joinUrl && !isCancelled && (
              <a
                href={session.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition"
              >
                <Video size={16} />
                <span>Join Live Meeting</span>
                <ExternalLink size={13} />
              </a>
            )}

            {!isCompleted && !isCancelled && (
              <>
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition"
                  title="Edit Class Details"
                >
                  <Edit size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCancelReason('');
                    setCancelModalOpen(true);
                  }}
                  className="p-2.5 rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-xs font-semibold shadow-xs transition"
                  title="Cancel Class"
                >
                  <XCircle size={16} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={refresh}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-xs"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Info Highlights Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Schedule Details */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
              <Calendar size={16} />
              <span>Schedule & Timetable</span>
            </div>
            <div className="space-y-1">
              <div className="text-base font-bold text-slate-800">
                {start.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                <span>
                  {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  {' - '}
                  {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  {' ('}
                  {Math.round((end.getTime() - start.getTime()) / 60000)} mins
                  {')'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Session Status: </span>
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-extrabold uppercase">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  LIVE NOW
                </span>
              ) : isCancelled ? (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                  CANCELLED
                </span>
              ) : isCompleted ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                  COMPLETED
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">
                  SCHEDULED
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Meeting Venue & Link */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider">
              <Video size={16} />
              <span>Meeting Venue</span>
            </div>
            <div className="space-y-1">
              <div className="text-base font-bold text-slate-800">
                {session.room || 'Google Meet Classroom'}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {session.joinUrl || 'No meeting URL configured'}
              </div>
            </div>
            {session.joinUrl && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
                >
                  {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedLink ? 'Copied Link' : 'Copy Meeting Link'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Card 3: Batch & Roster Stats */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-purple-600 text-xs font-bold uppercase tracking-wider">
              <Users size={16} />
              <span>Roster & Attendance</span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-extrabold text-slate-800">
                  {attendanceSummary.presentCount}
                  <span className="text-sm font-normal text-slate-400">/{attendanceSummary.totalStudents}</span>
                </div>
                <div className="text-xs text-slate-500 font-medium">Students Present</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <div className="text-2xl font-extrabold text-amber-600">
                  {attendanceSummary.unmarkedCount}
                </div>
                <div className="text-xs text-slate-500 font-medium">Unmarked</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Cohort: <span className="text-slate-800 font-semibold">{session.batchName}</span>
            </div>
          </div>
        </div>

        {/* Class Agenda / Description if available */}
        {session.description && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <FileText size={15} className="text-blue-600" />
              <span>Agenda & Additional Instructions</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-normal">
              {session.description}
            </p>
          </div>
        )}

        {/* Student Attendance Roster Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Header Bar */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <UserCheck size={18} className="text-blue-600" />
                <span>Student Attendance Roster</span>
              </h2>
              <p className="text-xs text-slate-500">
                Mark and record interactive live lecture attendance for this session.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {attendanceSaveMessage && (
                <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 animate-fadeIn">
                  <CheckCircle2 size={15} />
                  <span>{attendanceSaveMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
              >
                Mark All Present
              </button>

              <button
                type="button"
                disabled={!hasUnsavedChanges || isSavingAttendance}
                onClick={handleSaveAttendance}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold shadow-md transition cursor-pointer ${
                  hasUnsavedChanges
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isSavingAttendance ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Attendance</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search students by name, admission no..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {(
                [
                  { id: 'ALL', label: 'All Students' },
                  { id: 'PRESENT', label: 'Present' },
                  { id: 'LATE', label: 'Late' },
                  { id: 'ABSENT', label: 'Absent' },
                  { id: 'EXCUSED', label: 'Excused' },
                  { id: 'UNMARKED', label: 'Unmarked' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRosterStatusFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    rosterStatusFilter === f.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Roster Table */}
          {filteredRoster.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No students found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Admission No.</th>
                    <th className="py-3 px-4">Attendance Status</th>
                    <th className="py-3 px-4">Teacher Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoster.map((student) => {
                    const currentStatus =
                      attendanceEdits[student.studentProfileId]?.status || student.attendanceStatus;
                    const currentRemarks =
                      attendanceEdits[student.studentProfileId]?.remarks ?? (student.remarks || '');

                    return (
                      <tr key={student.studentProfileId} className="hover:bg-slate-50/60 transition">
                        {/* Student Name & Avatar */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                              {student.photoUrl ? (
                                <img
                                  src={student.photoUrl}
                                  alt={student.fullName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                student.fullName.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{student.fullName}</div>
                              <div className="text-[11px] text-slate-400">{student.email || 'No email'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Admission Number */}
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {student.admissionNumber || '—'}
                        </td>

                        {/* Status Radio Buttons */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {(
                              [
                                { id: 'PRESENT', label: 'Present', color: 'emerald' },
                                { id: 'LATE', label: 'Late', color: 'amber' },
                                { id: 'ABSENT', label: 'Absent', color: 'rose' },
                                { id: 'EXCUSED', label: 'Excused', color: 'indigo' },
                              ] as const
                            ).map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => handleStatusChange(student.studentProfileId, st.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  currentStatus === st.id
                                    ? st.color === 'emerald'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : st.color === 'amber'
                                      ? 'bg-amber-500 text-white shadow-xs'
                                      : st.color === 'rose'
                                      ? 'bg-rose-600 text-white shadow-xs'
                                      : 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </td>

                        {/* Remarks Input */}
                        <td className="py-3.5 px-4">
                          <input
                            type="text"
                            value={currentRemarks}
                            onChange={(e) => handleRemarksChange(student.studentProfileId, e.target.value)}
                            placeholder="Optional note..."
                            className="w-full max-w-xs px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Class Modal */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 my-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Edit size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">Edit Live Class</h3>
                    <p className="text-xs text-slate-500">Update schedule and classroom links</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {editSubmitError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <span>{editSubmitError}</span>
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Agenda & Notes</label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room / Venue</label>
                  <input
                    type="text"
                    value={editRoom}
                    onChange={(e) => setEditRoom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meeting Link (Google Meet)</label>
                  <input
                    type="url"
                    value={editJoinUrl}
                    onChange={(e) => setEditJoinUrl(e.target.value)}
                    placeholder="https://meet.google.com/xxx-yyyy-zzz"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition disabled:opacity-50"
                  >
                    {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {cancelModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center font-bold">
                  <XCircle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Cancel Live Class</h3>
                  <p className="text-xs text-slate-500">Students will be notified of cancellation</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to cancel{' '}
                <span className="font-bold text-slate-800">"{session.title}"</span>?
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cancellation Reason
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Rescheduled due to faculty retreat"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
                >
                  Keep Class
                </button>
                <button
                  type="button"
                  disabled={isSubmittingCancel}
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherShell>
  );
}

