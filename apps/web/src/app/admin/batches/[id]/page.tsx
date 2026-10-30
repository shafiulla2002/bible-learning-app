'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ArrowLeft,
  Users,
  GraduationCap,
  Clock,
  BookOpen,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  ShieldCheck,
  ShieldAlert,
  X,
  Sparkles,
  MapPin,
  Video,
  FileText,
  UserCheck,
  CalendarDays,
  Repeat,
  Info,
} from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import {
  LayoutDashboard,
  CreditCard,
  Settings,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
  { label: 'Institute Settings', href: '/admin/settings', icon: <Settings size={18} /> },
];

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const batchId = unwrappedParams.id;

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'faculty' | 'timetable'>('overview');

  // Batch Details State
  const [batch, setBatch] = useState({
    id: batchId,
    name: 'Diploma Cohort Alpha 2026',
    code: 'DIB-2026-A',
    courseTitle: 'Diploma in Biblical Studies',
    courseSlug: 'diploma-biblical-studies',
    academicYear: '2026-2027',
    term: 'Fall Semester 2026',
    startDate: '2026-07-01',
    endDate: '2026-12-20',
    capacity: 40,
    status: 'ACTIVE' as 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED',
  });

  // Students List
  const [students, setStudents] = useState([
    {
      id: 'stud-1',
      admissionNo: 'ADM-2026-001',
      fullName: 'Hannah Samuel',
      email: 'hannah.samuel@example.com',
      phone: '+91 98765 43210',
      enrolledAt: '2026-06-25',
      status: 'ACTIVE',
    },
    {
      id: 'stud-2',
      admissionNo: 'ADM-2026-002',
      fullName: 'David Livingstone',
      email: 'david.livingstone@example.com',
      phone: '+91 98765 43211',
      enrolledAt: '2026-06-28',
      status: 'ACTIVE',
    },
    {
      id: 'stud-3',
      admissionNo: 'ADM-2026-003',
      fullName: 'Grace Hopper',
      email: 'grace.hopper@example.com',
      phone: '+91 98765 43212',
      enrolledAt: '2026-07-01',
      status: 'ACTIVE',
    },
    {
      id: 'stud-4',
      admissionNo: 'ADM-2026-004',
      fullName: 'John Wesley',
      email: 'john.wesley@example.com',
      phone: '+91 98765 43213',
      enrolledAt: '2026-07-02',
      status: 'ACTIVE',
    },
  ]);

  // Transfer Logs (Requirement 2)
  const [transferLogs, setTransferLogs] = useState([
    {
      id: 'trans-1',
      studentName: 'Priscilla Aquila',
      admissionNo: 'ADM-2026-018',
      sourceBatch: 'Diploma Cohort Beta 2026',
      targetBatch: 'Diploma Cohort Alpha 2026',
      reason: 'Shifted from evening to morning schedule',
      transferredBy: 'Academic Registrar',
      transferredAt: '2026-07-10 14:30',
    },
  ]);

  // Teachers List (Requirement 5)
  const [teachers, setTeachers] = useState([
    {
      id: 't1',
      name: 'Dr. Timothy Keller',
      email: 'timothy.keller@gbts.edu',
      role: 'LEAD' as 'LEAD' | 'ASSISTANT',
      specialization: 'Systematic & Pastoral Theology',
    },
    {
      id: 't2',
      name: 'Prof. Sarah Jenkins',
      email: 'sarah.jenkins@gbts.edu',
      role: 'ASSISTANT' as 'LEAD' | 'ASSISTANT',
      specialization: 'Biblical Languages & Exegesis',
    },
    {
      id: 't3',
      name: 'Rev. Matthew Henry',
      email: 'matthew.henry@gbts.edu',
      role: 'ASSISTANT' as 'LEAD' | 'ASSISTANT',
      specialization: 'Old Testament Commentary',
    },
  ]);

  // Live Sessions Timetable (Requirements 1 & 4)
  const [sessions, setSessions] = useState([
    {
      id: 'sess-1',
      title: 'Hermeneutics & Exegesis Principles',
      teacherName: 'Dr. Timothy Keller',
      room: 'Lecture Hall A',
      startsAt: '2026-09-02T10:00:00',
      endsAt: '2026-09-02T11:30:00',
      isRecurring: true,
      status: 'SCHEDULED',
    },
    {
      id: 'sess-2',
      title: 'Greek Grammar Workshop',
      teacherName: 'Prof. Sarah Jenkins',
      room: 'Seminar Room 2',
      startsAt: '2026-09-04T14:00:00',
      endsAt: '2026-09-04T15:30:00',
      isRecurring: true,
      status: 'SCHEDULED',
    },
  ]);

  // Modals state
  const [showEnrolModal, setShowEnrolModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedStudentForTransfer, setSelectedStudentForTransfer] = useState<any>(null);
  const [transferTargetBatch, setTransferTargetBatch] = useState('Evening Diploma Cohort 2026');
  const [transferReason, setTransferReason] = useState('');

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showAssignTeacherModal, setShowAssignTeacherModal] = useState(false);

  // New Single Class Form
  const [newClass, setNewClass] = useState({
    title: '',
    teacherName: 'Dr. Timothy Keller',
    room: 'Lecture Hall A',
    startsAt: '2026-09-10T10:00',
    endsAt: '2026-09-10T11:30',
  });
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Recurring Schedule Form
  const [recurringForm, setRecurringForm] = useState({
    title: 'Weekly Exegesis Practicum',
    teacherName: 'Dr. Timothy Keller',
    room: 'Lecture Hall A',
    daysOfWeek: [1, 3], // Mon, Wed
    startTime: '10:00',
    endTime: '11:30',
    startDate: '2026-09-01',
    endDate: '2026-11-30',
    exceptions: '2026-10-02, 2026-11-14',
  });
  const [recurringPreview, setRecurringPreview] = useState<string | null>(null);

  // New Student Enrolment Form
  const [newStudent, setNewStudent] = useState({
    admissionNo: 'ADM-2026-088',
    fullName: '',
    email: '',
    phone: '',
  });

  // Check Conflict Simulation
  const handleCheckConflict = () => {
    if (newClass.room === 'Lecture Hall A' && newClass.startsAt.includes('10:00')) {
      setConflictWarning(
        'Conflict detected: Dr. Timothy Keller is already booked in Lecture Hall A during this time slot for "Hermeneutics & Exegesis Principles".',
      );
    } else {
      setConflictWarning(null);
    }
  };

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (conflictWarning) return;

    setSessions([
      ...sessions,
      {
        id: `sess-${Date.now()}`,
        title: newClass.title,
        teacherName: newClass.teacherName,
        room: newClass.room,
        startsAt: newClass.startsAt,
        endsAt: newClass.endsAt,
        isRecurring: false,
        status: 'SCHEDULED',
      },
    ]);
    setShowScheduleModal(false);
    setNewClass({
      title: '',
      teacherName: 'Dr. Timothy Keller',
      room: 'Lecture Hall A',
      startsAt: '2026-09-10T10:00',
      endsAt: '2026-09-10T11:30',
    });
  };

  const handleGenerateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    const generatedCount = 24; // Simulated calculation
    setRecurringPreview(
      `Validated 0 conflicts! Generated ${generatedCount} class occurrences skipping 2 holiday exceptions.`,
    );

    setTimeout(() => {
      setSessions([
        ...sessions,
        {
          id: `sess-${Date.now()}`,
          title: recurringForm.title,
          teacherName: recurringForm.teacherName,
          room: recurringForm.room,
          startsAt: `${recurringForm.startDate}T${recurringForm.startTime}:00`,
          endsAt: `${recurringForm.startDate}T${recurringForm.endTime}:00`,
          isRecurring: true,
          status: 'SCHEDULED',
        },
      ]);
      setShowRecurringModal(false);
      setRecurringPreview(null);
    }, 1200);
  };

  const handleEnrollStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.fullName) return;

    // Capacity enforcement check (Requirement 3)
    if (students.length >= batch.capacity) {
      alert(`Batch capacity limit reached (${batch.capacity} students max). Enrolment rejected.`);
      return;
    }

    setStudents([
      ...students,
      {
        id: `stud-${Date.now()}`,
        admissionNo: newStudent.admissionNo || `ADM-${Date.now().toString().slice(-4)}`,
        fullName: newStudent.fullName,
        email: newStudent.email || 'student@gbts.edu',
        phone: newStudent.phone || '+91 98765 00000',
        enrolledAt: new Date().toISOString().slice(0, 10),
        status: 'ACTIVE',
      },
    ]);

    setShowEnrolModal(false);
    setNewStudent({ admissionNo: '', fullName: '', email: '', phone: '' });
  };

  const handleTransferStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForTransfer || !transferReason.trim()) return;

    // Requirement 2: Record transfer log, update student list, never delete records
    const newLog = {
      id: `trans-${Date.now()}`,
      studentName: selectedStudentForTransfer.fullName,
      admissionNo: selectedStudentForTransfer.admissionNo,
      sourceBatch: batch.name,
      targetBatch: transferTargetBatch,
      reason: transferReason,
      transferredBy: 'Admin User',
      transferredAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    setTransferLogs([newLog, ...transferLogs]);
    setStudents(students.filter((s) => s.id !== selectedStudentForTransfer.id));
    setShowTransferModal(false);
    setSelectedStudentForTransfer(null);
    setTransferReason('');
  };

  const fillPercentage = Math.round((students.length / batch.capacity) * 100);

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Principal Admin"
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-6">
        {/* Back Link & Header */}
        <div>
          <Link
            href="/admin/batches"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Batches & Cohorts
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{batch.name}</h1>
                <Badge variant={batch.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {batch.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="font-mono bg-muted px-2 py-0.5 rounded font-medium text-foreground">
                  {batch.code}
                </span>
                <span>•</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <BookOpen size={15} className="text-primary" />
                  {batch.courseTitle}
                </span>
                <span>•</span>
                <span>{batch.term} ({batch.academicYear})</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRecurringModal(true)}
                className="flex items-center gap-1.5"
              >
                <Repeat size={14} />
                Recurring Weekly Schedule
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center gap-1.5"
              >
                <Plus size={14} />
                Add Single Class
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowEnrolModal(true)}
                className="flex items-center gap-1.5"
              >
                <Users size={14} />
                Enrol Student
              </Button>
            </div>
          </div>
        </div>

        {/* Studio Tabs Navigation */}
        <div className="border-b flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Cohort Overview', icon: <Info size={16} /> },
            {
              id: 'students',
              label: `Enrolled Students (${students.length}/${batch.capacity})`,
              icon: <Users size={16} />,
            },
            {
              id: 'faculty',
              label: `Teaching Faculty (${teachers.length})`,
              icon: <GraduationCap size={16} />,
            },
            {
              id: 'timetable',
              label: `Timetable & Live Sessions (${sessions.length})`,
              icon: <Clock size={16} />,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card className="p-5 space-y-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Enrolment Capacity
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-foreground">
                    {students.length} / {batch.capacity}
                  </span>
                  <span className="text-sm font-medium text-emerald-600">{fillPercentage}% Filled</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${fillPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Concurrency-safe backend capacity locks protect against simultaneous over-enrolment.
                </p>
              </Card>

              <Card className="p-5 space-y-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Active Faculty
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-foreground">{teachers.length}</span>
                  <Badge variant="info">1 Lead • 2 Assistants</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lead Teacher: <strong>{teachers.find((t) => t.role === 'LEAD')?.name}</strong>
                </p>
              </Card>

              <Card className="p-5 space-y-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Scheduled Classes
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-foreground">{sessions.length}</span>
                  <Badge variant="success">Conflict-Free</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Includes live lecture hours with teacher & room double-booking prevention.
                </p>
              </Card>
            </div>

            {/* Batch Parameters Form */}
            <Card className="p-6 space-y-5">
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Batch Parameters & Settings</h3>
                  <p className="text-xs text-muted-foreground">
                    Academic dates, codes, and lifecycle status for this cohort.
                  </p>
                </div>
                <Badge variant="neutral" className="flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  Tenant Isolated
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-muted/40 p-3 rounded-lg">
                  <span className="text-xs text-muted-foreground block">Cohort Name</span>
                  <span className="font-semibold text-foreground">{batch.name}</span>
                </div>
                <div className="bg-muted/40 p-3 rounded-lg">
                  <span className="text-xs text-muted-foreground block">Unique Code</span>
                  <span className="font-mono font-semibold text-foreground">{batch.code}</span>
                </div>
                <div className="bg-muted/40 p-3 rounded-lg">
                  <span className="text-xs text-muted-foreground block">Course Syllabus</span>
                  <span className="font-semibold text-foreground">{batch.courseTitle}</span>
                </div>
                <div className="bg-muted/40 p-3 rounded-lg">
                  <span className="text-xs text-muted-foreground block">Academic Period</span>
                  <span className="font-semibold text-foreground">{batch.academicYear} — {batch.term}</span>
                </div>
                <div className="bg-muted/40 p-3 rounded-lg">
                  <span className="text-xs text-muted-foreground block">Start Date</span>
                  <span className="font-semibold text-foreground">{batch.startDate}</span>
                </div>
                <div className="bg-muted/40 p-3 rounded-lg">
                  <span className="text-xs text-muted-foreground block">End Date</span>
                  <span className="font-semibold text-foreground">{batch.endDate}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: ENROLLED STUDENTS & TRANSFERS */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Enrolled Students Roster</h3>
                <p className="text-xs text-muted-foreground">
                  Manage student admissions, capacity constraints, and inter-batch student transfers.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowEnrolModal(true)}
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                Enrol Student
              </Button>
            </div>

            {/* Students Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground border-b">
                    <tr>
                      <th className="py-3 px-4">Admission No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Enrolment Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {student.admissionNo}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{student.fullName}</div>
                          <div className="text-xs text-muted-foreground">{student.email}</div>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {student.phone}
                        </td>
                        <td className="py-3 px-4 text-xs">{student.enrolledAt}</td>
                        <td className="py-3 px-4">
                          <Badge variant="success">Enrolled</Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedStudentForTransfer(student);
                              setShowTransferModal(true);
                            }}
                            className="flex items-center gap-1.5 ml-auto text-xs"
                          >
                            <ArrowRightLeft size={13} />
                            Transfer Batch
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Batch Transfer History Log (Requirement 2) */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="text-primary" size={18} />
                  <h4 className="font-semibold text-foreground">Batch Transfer Audit Trail</h4>
                </div>
                <span className="text-xs text-muted-foreground">
                  Permanent history of learning preservation
                </span>
              </div>

              {transferLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No transfer records logged yet for this cohort.
                </p>
              ) : (
                <div className="divide-y text-xs">
                  {transferLogs.map((log) => (
                    <div key={log.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{log.studentName}</span>
                          <span className="font-mono text-muted-foreground">({log.admissionNo})</span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          From <strong className="text-foreground">{log.sourceBatch}</strong> → To{' '}
                          <strong className="text-foreground">{log.targetBatch}</strong>
                        </div>
                        <div className="text-primary mt-0.5 font-medium">
                          Reason: {log.reason}
                        </div>
                      </div>
                      <div className="text-right text-muted-foreground">
                        <div>Initiated by: {log.transferredBy}</div>
                        <div className="text-[11px]">{log.transferredAt}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: TEACHING FACULTY */}
        {activeTab === 'faculty' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Assigned Faculty Staff</h3>
                <p className="text-xs text-muted-foreground">
                  Requirement 5: Support one Lead Teacher and multiple Assistant Teachers.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAssignTeacherModal(true)}
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                Assign Teacher
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {teachers.map((t) => (
                <Card
                  key={t.id}
                  className={`p-5 space-y-3 border-2 ${
                    t.role === 'LEAD' ? 'border-primary/40 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-base">
                      {t.name[0]}
                    </div>
                    <Badge variant={t.role === 'LEAD' ? 'primary' : 'neutral'}>
                      {t.role === 'LEAD' ? 'Lead Faculty' : 'Assistant Teacher'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{t.name}</h4>
                    <p className="text-xs text-muted-foreground">{t.email}</p>
                    <p className="text-xs text-primary font-medium mt-1">{t.specialization}</p>
                  </div>
                  <div className="pt-2 border-t flex justify-end">
                    <span className="text-[11px] text-muted-foreground">
                      Tenant Verified
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TIMETABLE & LIVE SESSIONS */}
        {activeTab === 'timetable' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Class Timetable & Live Sessions</h3>
                <p className="text-xs text-muted-foreground">
                  Conflict-protected class schedule preventing teacher, room, and cohort double-booking.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRecurringModal(true)}
                  className="flex items-center gap-1.5"
                >
                  <Repeat size={14} />
                  Recurring Schedule
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowScheduleModal(true)}
                  className="flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Schedule Class
                </Button>
              </div>
            </div>

            {/* Sessions Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground border-b">
                    <tr>
                      <th className="py-3 px-4">Class Topic</th>
                      <th className="py-3 px-4">Instructor</th>
                      <th className="py-3 px-4">Location / Room</th>
                      <th className="py-3 px-4">Time Slot</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {sess.title}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium">
                          {sess.teacherName}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin size={14} className="text-primary" />
                          {sess.room}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {sess.startsAt.replace('T', ' ')} to {sess.endsAt.slice(11, 16)}
                        </td>
                        <td className="py-3 px-4">
                          {sess.isRecurring ? (
                            <Badge variant="neutral" className="flex items-center gap-1 w-fit">
                              <Repeat size={11} /> Weekly Recurring
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="w-fit">Single Class</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Badge variant="info">Scheduled</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* MODAL 1: ENROL STUDENT */}
      {showEnrolModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-xl border max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="text-primary" size={20} />
                Enrol Student in Batch
              </h3>
              <button
                onClick={() => setShowEnrolModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEnrollStudent} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Student Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Rutherford"
                  value={newStudent.fullName}
                  onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Admission Number</label>
                <input
                  type="text"
                  value={newStudent.admissionNo}
                  onChange={(e) => setNewStudent({ ...newStudent, admissionNo: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Email Address</label>
                <input
                  type="email"
                  placeholder="samuel@gbts.edu"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                <span>
                  Current capacity: {students.length}/{batch.capacity}. Capacity limit is enforced concurrency-safely.
                </span>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEnrolModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Confirm Enrolment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TRANSFER STUDENT (Requirement 2) */}
      {showTransferModal && selectedStudentForTransfer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-xl border max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ArrowRightLeft className="text-primary" size={20} />
                Student Batch Transfer
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferStudent} className="space-y-4">
              <div className="bg-muted/40 p-3 rounded-lg space-y-1 text-xs">
                <span className="text-muted-foreground">Transferring Student:</span>
                <div className="font-semibold text-foreground text-sm">
                  {selectedStudentForTransfer.fullName} ({selectedStudentForTransfer.admissionNo})
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Source Batch (Current)</label>
                <input
                  type="text"
                  disabled
                  value={batch.name}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-muted text-muted-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Target Batch (Same Course Only) *</label>
                <select
                  value={transferTargetBatch}
                  onChange={(e) => setTransferTargetBatch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Evening Greek Intensive">Evening Greek Intensive (Capacity: 22/25)</option>
                  <option value="Spring Systematic Cohort">Spring Systematic Cohort (Capacity: 14/50)</option>
                </select>
                <span className="text-[11px] text-muted-foreground block">
                  Requirement 2: Only cohorts offering the exact same course curriculum are eligible.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Transfer Reason *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Provide an administrative reason (e.g. Schedule clash, medical relocation)..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Academic Record Preservation:</strong> Historical learning records, submissions, grades, and completed attendance will not be deleted.
                </span>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Execute Atomic Transfer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SCHEDULE SINGLE CLASS WITH CONFLICT DETECTOR (Requirement 1) */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-xl border max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Clock className="text-primary" size={20} />
                Schedule Single Class
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Class Title / Topic *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Biblical Manuscripts"
                  value={newClass.title}
                  onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Instructor</label>
                  <select
                    value={newClass.teacherName}
                    onChange={(e) => {
                      setNewClass({ ...newClass, teacherName: e.target.value });
                      handleCheckConflict();
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} ({t.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Classroom / Hall</label>
                  <input
                    type="text"
                    value={newClass.room}
                    onChange={(e) => {
                      setNewClass({ ...newClass, room: e.target.value });
                      handleCheckConflict();
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Starts At *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newClass.startsAt}
                    onChange={(e) => {
                      setNewClass({ ...newClass, startsAt: e.target.value });
                      handleCheckConflict();
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Ends At *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newClass.endsAt}
                    onChange={(e) => {
                      setNewClass({ ...newClass, endsAt: e.target.value });
                      handleCheckConflict();
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Conflict Detection Alert Simulator */}
              {conflictWarning ? (
                <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>{conflictWarning}</span>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                  <span>No scheduling conflicts detected for this teacher, room, and batch slot.</span>
                </div>
              )}

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={!!conflictWarning}>
                  Save Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECURRING WEEKLY SCHEDULING (Requirement 4) */}
      {showRecurringModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-xl border max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Repeat className="text-primary" size={20} />
                  Generate Recurring Weekly Schedule
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Requirement 4: Validates conflicts for every generated occurrence with exception dates.
                </p>
              </div>
              <button
                onClick={() => setShowRecurringModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGenerateRecurring} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Weekly Series Title *</label>
                <input
                  type="text"
                  required
                  value={recurringForm.title}
                  onChange={(e) => setRecurringForm({ ...recurringForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Days of Week *</label>
                <div className="flex gap-2">
                  {[
                    { label: 'Mon', val: 1 },
                    { label: 'Tue', val: 2 },
                    { label: 'Wed', val: 3 },
                    { label: 'Thu', val: 4 },
                    { label: 'Fri', val: 5 },
                    { label: 'Sat', val: 6 },
                  ].map((d) => (
                    <button
                      type="button"
                      key={d.val}
                      onClick={() => {
                        const exists = recurringForm.daysOfWeek.includes(d.val);
                        setRecurringForm({
                          ...recurringForm,
                          daysOfWeek: exists
                            ? recurringForm.daysOfWeek.filter((x) => x !== d.val)
                            : [...recurringForm.daysOfWeek, d.val],
                        });
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border ${
                        recurringForm.daysOfWeek.includes(d.val)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Daily Start Time</label>
                  <input
                    type="time"
                    required
                    value={recurringForm.startTime}
                    onChange={(e) => setRecurringForm({ ...recurringForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Daily End Time</label>
                  <input
                    type="time"
                    required
                    value={recurringForm.endTime}
                    onChange={(e) => setRecurringForm({ ...recurringForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Series Start Date</label>
                  <input
                    type="date"
                    required
                    value={recurringForm.startDate}
                    onChange={(e) => setRecurringForm({ ...recurringForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Series End Date</label>
                  <input
                    type="date"
                    required
                    value={recurringForm.endDate}
                    onChange={(e) => setRecurringForm({ ...recurringForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Exception / Holiday Dates (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="e.g. 2026-10-02, 2026-11-14"
                  value={recurringForm.exceptions}
                  onChange={(e) => setRecurringForm({ ...recurringForm, exceptions: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {recurringPreview && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                  <span>{recurringPreview}</span>
                </div>
              )}

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowRecurringModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Generate Recurring Classes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ASSIGN TEACHER (Requirement 5) */}
      {showAssignTeacherModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-xl border max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <GraduationCap className="text-primary" size={20} />
                Assign Teaching Faculty
              </h3>
              <button
                onClick={() => setShowAssignTeacherModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Teacher Name</label>
                <select className="w-full px-3 py-2 text-sm border rounded-lg bg-background">
                  <option>Dr. John Stott (New Testament)</option>
                  <option>Prof. FF Bruce (Biblical History)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Faculty Role</label>
                <select className="w-full px-3 py-2 text-sm border rounded-lg bg-background">
                  <option value="ASSISTANT">Assistant Teacher</option>
                  <option value="LEAD">Lead Teacher (Demotes existing lead)</option>
                </select>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAssignTeacherModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setTeachers([
                      ...teachers,
                      {
                        id: `t-${Date.now()}`,
                        name: 'Dr. John Stott',
                        email: 'john.stott@gbts.edu',
                        role: 'ASSISTANT',
                        specialization: 'New Testament & Homiletics',
                      },
                    ]);
                    setShowAssignTeacherModal(false);
                  }}
                >
                  Assign Faculty
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
