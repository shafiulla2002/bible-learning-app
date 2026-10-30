'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
  FileSpreadsheet,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Calendar,
  Phone,
  Mail,
  GraduationCap,
  ShieldCheck,
  Building2,
  Clock,
  RotateCcw,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <Building2 size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <ShieldCheck size={18} /> },
];

// Realistic student directory state preserving prototype records
interface StudentItem {
  id: string;
  admissionNo: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  gender: string;
  church: string;
  preferredLanguage: string;
  enrolledCourse: string;
  batch: string;
  admissionDate: string;
  status: 'ACTIVE' | 'UNDER_REVIEW' | 'APPROVED' | 'INACTIVE' | 'REJECTED';
  feesPaid: string;
}

const INITIAL_STUDENTS: StudentItem[] = [
  {
    id: 'stu-1',
    admissionNo: 'ADM-2026-0001',
    fullName: 'Grace Thomas',
    phoneNumber: '+91 98765 43210',
    email: 'grace.thomas@example.com',
    gender: 'Female',
    church: 'Bethany Fellowship, Bangalore',
    preferredLanguage: 'English',
    enrolledCourse: 'Building Biblical Theology',
    batch: 'Batch 2026-A (Morning)',
    admissionDate: '2026-10-12',
    status: 'ACTIVE',
    feesPaid: '₹18,500',
  },
  {
    id: 'stu-2',
    admissionNo: 'ADM-2026-0002',
    fullName: 'Daniel Joseph',
    phoneNumber: '+91 98765 43211',
    email: 'daniel.j@example.com',
    gender: 'Male',
    church: 'Emmanuel Baptist Church, Hyderabad',
    preferredLanguage: 'English',
    enrolledCourse: 'Church History: Reformation to Modern',
    batch: 'Batch 2026-A (Morning)',
    admissionDate: '2026-10-10',
    status: 'ACTIVE',
    feesPaid: '₹16,000',
  },
  {
    id: 'stu-3',
    admissionNo: 'ADM-2026-0003',
    fullName: 'Esther Williams',
    phoneNumber: '+91 98765 43212',
    email: 'esther.w@example.com',
    gender: 'Female',
    church: 'St. Thomas Evangelical, Chennai',
    preferredLanguage: 'English',
    enrolledCourse: 'Pastoral Leadership & Counseling',
    batch: 'Batch 2026-B (Evening)',
    admissionDate: '2026-10-08',
    status: 'UNDER_REVIEW',
    feesPaid: 'Pending',
  },
  {
    id: 'stu-4',
    admissionNo: 'ADM-2026-0004',
    fullName: 'Michael David',
    phoneNumber: '+91 98765 43213',
    email: 'michael.d@example.com',
    gender: 'Male',
    church: 'Grace Reformed Church, Kochi',
    preferredLanguage: 'English',
    enrolledCourse: 'Hermeneutics & Exegesis',
    batch: 'Batch 2026-A (Morning)',
    admissionDate: '2026-10-05',
    status: 'ACTIVE',
    feesPaid: '₹17,500',
  },
  {
    id: 'stu-5',
    admissionNo: 'ADM-2026-0005',
    fullName: 'Ruth Samuel',
    phoneNumber: '+91 98765 43214',
    email: 'ruth.s@example.com',
    gender: 'Female',
    church: 'Zion Assembly of God, Mumbai',
    preferredLanguage: 'English',
    enrolledCourse: 'Building Biblical Theology',
    batch: 'Batch 2026-B (Evening)',
    admissionDate: '2026-09-29',
    status: 'INACTIVE',
    feesPaid: '₹14,000',
  },
  {
    id: 'stu-6',
    admissionNo: 'ADM-2026-0006',
    fullName: 'John Peter',
    phoneNumber: '+91 98765 43215',
    email: 'john.p@example.com',
    gender: 'Male',
    church: 'Calvary Bible Church, Delhi',
    preferredLanguage: 'English',
    enrolledCourse: 'Hermeneutics & Exegesis',
    batch: 'Batch 2026-A (Morning)',
    admissionDate: '2026-09-25',
    status: 'APPROVED',
    feesPaid: 'Pending Enrollment Fee',
  },
];

export default function StudentsDirectoryPage() {
  const [students, setStudents] = useState<StudentItem[]>(INITIAL_STUDENTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Add Student Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({
    fullName: '',
    phoneNumber: '+91 ',
    email: '',
    gender: 'Male',
    church: '',
    preferredLanguage: 'English',
    enrolledCourse: 'Building Biblical Theology',
    batch: 'Batch 2026-A (Morning)',
    guardianName: '',
    guardianPhone: '',
    addressCity: '',
    educationLevel: 'Bachelor Degree',
    status: 'ACTIVE' as const,
  });

  // Bulk Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importSummary, setImportSummary] = useState<{ total: number; valid: number; duplicates: number } | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Status Filter Counts
  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.status === 'ACTIVE').length;
    const review = students.filter((s) => s.status === 'UNDER_REVIEW').length;
    const inactive = students.filter((s) => s.status === 'INACTIVE').length;
    return { total, active, review, inactive };
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.phoneNumber.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);

      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      const matchCourse = courseFilter === 'ALL' || s.enrolledCourse === courseFilter;

      return matchSearch && matchStatus && matchCourse;
    });
  }, [students, search, statusFilter, courseFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

  // Handle Add Student
  const handleAddStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.fullName || !newStudent.phoneNumber) {
      showToast('Please enter full name and phone number');
      return;
    }

    // Check duplicate phone
    if (students.some((s) => s.phoneNumber.replace(/\s+/g, '') === newStudent.phoneNumber.replace(/\s+/g, ''))) {
      showToast(`A student with phone ${newStudent.phoneNumber} is already registered.`);
      return;
    }

    const nextId = `stu-${Date.now()}`;
    const nextSeq = String(students.length + 1).padStart(4, '0');
    const newRecord: StudentItem = {
      id: nextId,
      admissionNo: `ADM-2026-${nextSeq}`,
      fullName: newStudent.fullName,
      phoneNumber: newStudent.phoneNumber,
      email: newStudent.email || `${newStudent.fullName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      gender: newStudent.gender,
      church: newStudent.church || 'Local Bible Church',
      preferredLanguage: newStudent.preferredLanguage,
      enrolledCourse: newStudent.enrolledCourse,
      batch: newStudent.batch,
      admissionDate: new Date().toISOString().split('T')[0],
      status: newStudent.status,
      feesPaid: newStudent.status === 'ACTIVE' ? 'Paid' : 'Pending',
    };

    setStudents([newRecord, ...students]);
    setIsAddModalOpen(false);
    showToast(`Student ${newRecord.fullName} registered with ID ${newRecord.admissionNo}`);
    setNewStudent({
      fullName: '',
      phoneNumber: '+91 ',
      email: '',
      gender: 'Male',
      church: '',
      preferredLanguage: 'English',
      enrolledCourse: 'Building Biblical Theology',
      batch: 'Batch 2026-A (Morning)',
      guardianName: '',
      guardianPhone: '',
      addressCity: '',
      educationLevel: 'Bachelor Degree',
      status: 'ACTIVE',
    });
  };

  // Status Toggle
  const handleStatusChange = (id: string, newStatus: StudentItem['status']) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );
    showToast(`Student status updated to ${newStatus}`);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Admission No', 'Full Name', 'Phone', 'Email', 'Course', 'Batch', 'Date', 'Status', 'Fees'];
    const rows = filteredStudents.map((s) => [
      s.admissionNo,
      s.fullName,
      s.phoneNumber,
      s.email,
      s.enrolledCourse,
      s.batch,
      s.admissionDate,
      s.status,
      s.feesPaid,
    ]);

    const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bible-institute-students-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Student CSV export downloaded successfully');
  };

  // Sample CSV template download
  const handleDownloadTemplate = () => {
    const template = 'fullName,phoneNumber,email,gender,courseName,church,preferredLanguage\n"Timothy Paul","+919876543220","timothy@example.com","Male","Building Biblical Theology","Grace Bible Church","English"';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'student_bulk_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Import template downloaded');
  };

  // Simulate file upload validation
  const handleSimulateCSVPreview = () => {
    const samplePreview = [
      { row: 1, name: 'Philip Mathew', phone: '+919876543290', email: 'philip.m@example.com', course: 'Building Biblical Theology', status: 'VALID' },
      { row: 2, name: 'Mary Magdalene', phone: '+919876543291', email: 'mary.m@example.com', course: 'Church History', status: 'VALID' },
      { row: 3, name: 'Grace Thomas', phone: '+91 98765 43210', email: 'grace.t@example.com', course: 'Hermeneutics', status: 'DUPLICATE (Phone exists)' },
    ];
    setImportPreview(samplePreview);
    setImportSummary({ total: 3, valid: 2, duplicates: 1 });
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const validRows = importPreview.filter((r) => r.status === 'VALID');
    const newImported: StudentItem[] = validRows.map((r, i) => ({
      id: `stu-imp-${Date.now()}-${i}`,
      admissionNo: `ADM-2026-${String(students.length + i + 1).padStart(4, '0')}`,
      fullName: r.name,
      phoneNumber: r.phone,
      email: r.email,
      gender: 'Unspecified',
      church: 'Affiliated Institute Fellowship',
      preferredLanguage: 'English',
      enrolledCourse: r.course,
      batch: 'Batch 2026-A (Morning)',
      admissionDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      feesPaid: 'Pending',
    }));

    setStudents([...newImported, ...students]);
    setIsImportModalOpen(false);
    setImportPreview(null);
    setImportSummary(null);
    showToast(`Successfully imported ${validRows.length} new students!`);
  };

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Samuel Admin"
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-6">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Student Directory & Admissions
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {students.length} Total Enrolled
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Review admissions, manage learner profiles, track enrollments, and verify admission credentials.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5"
            >
              <Download size={14} />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="gap-1.5"
            >
              <Upload size={14} />
              Bulk Import
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1.5"
            >
              <Plus size={14} />
              Add Student
            </Button>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Students"
            value={stats.total}
            icon={<Users size={20} />}
            trend={`${stats.active} Active Learners`}
            trendPositive={true}
            colorScheme="blue"
          />
          <StatCard
            title="Active Students"
            value={stats.active}
            icon={<CheckCircle2 size={20} />}
            trend="Attending classes"
            trendPositive={true}
            colorScheme="emerald"
          />
          <StatCard
            title="Pending Admissions"
            value={stats.review}
            icon={<Clock size={20} />}
            trend={stats.review > 0 ? 'Requires Action' : 'All clear'}
            trendPositive={stats.review === 0}
            colorScheme="amber"
          />
          <StatCard
            title="Inactive Accounts"
            value={stats.inactive}
            icon={<XCircle size={20} />}
            trend="On leave / deferred"
            trendPositive={false}
            colorScheme="purple"
          />
        </div>

        {/* Search & Filter Toolbar */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by student name, admission number, phone, email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="APPROVED">Approved</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {/* Course Filter */}
            <div>
              <select
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Courses</option>
                <option value="Building Biblical Theology">Biblical Theology</option>
                <option value="Church History: Reformation to Modern">Church History</option>
                <option value="Hermeneutics & Exegesis">Hermeneutics</option>
                <option value="Pastoral Leadership & Counseling">Pastoral Leadership</option>
              </select>
            </div>
          </div>

          {(search || statusFilter !== 'ALL' || courseFilter !== 'ALL') && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredStudents.length} matching students</span>
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setCourseFilter('ALL');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                <RotateCcw size={12} />
                Clear Filters
              </button>
            </div>
          )}
        </Card>

        {/* Student Data Table */}
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Admission No</th>
                  <th className="py-3.5 px-4">Course & Batch</th>
                  <th className="py-3.5 px-4">Admitted On</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Fee Record</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {paginatedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Users size={32} className="mx-auto mb-2 opacity-50 text-slate-300" />
                      <p className="font-semibold text-slate-600">No students found</p>
                      <p className="text-[11px] mt-0.5">Try adjusting your filters or add a new student</p>
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition group">
                      {/* Name & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                            {s.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition">
                              <Link href={`/admin/students/${s.id}`}>{s.fullName}</Link>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{s.phoneNumber}</span>
                              <span>•</span>
                              <span>{s.church}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Admission ID */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 text-[11px]">
                        {s.admissionNo}
                      </td>

                      {/* Course & Batch */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 text-xs">{s.enrolledCourse}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{s.batch}</div>
                      </td>

                      {/* Admission Date */}
                      <td className="py-3.5 px-4 text-slate-500">{s.admissionDate}</td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {s.status === 'ACTIVE' && <Badge variant="success">Active</Badge>}
                        {s.status === 'UNDER_REVIEW' && <Badge variant="warning">Under Review</Badge>}
                        {s.status === 'APPROVED' && <Badge variant="info">Approved</Badge>}
                        {s.status === 'INACTIVE' && <Badge variant="neutral">Inactive</Badge>}
                        {s.status === 'REJECTED' && <Badge variant="danger">Rejected</Badge>}
                      </td>

                      {/* Fees */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900">{s.feesPaid}</span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/admin/students/${s.id}`}>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" title="View Profile">
                              <Eye size={14} className="mr-1 text-slate-500" />
                              Profile
                            </Button>
                          </Link>

                          {s.status === 'UNDER_REVIEW' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleStatusChange(s.id, 'APPROVED')}
                              className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                              title="Approve Admission"
                            >
                              Approve
                            </Button>
                          )}

                          {s.status === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(s.id, 'INACTIVE')}
                              className="h-8 px-2 text-xs text-slate-500 hover:text-rose-600 hover:border-rose-200"
                              title="Mark Inactive"
                            >
                              Deactivate
                            </Button>
                          )}

                          {s.status === 'INACTIVE' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(s.id, 'ACTIVE')}
                              className="h-8 px-2 text-xs text-emerald-600 hover:bg-emerald-50"
                              title="Reactivate"
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {filteredStudents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} entries
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </Card>

        {/* Modal 1: Add Student Admission Form */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Student Admission & Enrollment</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Register a new student and optionally assign their initial course and cohort
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddStudentSubmit} className="space-y-5">
                {/* Section 1: Personal Info */}
                <div>
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                    1. Personal Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Timothy Paul"
                        value={newStudent.fullName}
                        onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mobile Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={newStudent.phoneNumber}
                        onChange={(e) => setNewStudent({ ...newStudent, phoneNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="timothy@example.com"
                        value={newStudent.email}
                        onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                      <select
                        value={newStudent.gender}
                        onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Church Affiliation
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Grace Bible Fellowship"
                        value={newStudent.church}
                        onChange={(e) => setNewStudent({ ...newStudent, church: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Preferred Study Language
                      </label>
                      <select
                        value={newStudent.preferredLanguage}
                        onChange={(e) => setNewStudent({ ...newStudent, preferredLanguage: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="English">English</option>
                        <option value="Telugu">Telugu</option>
                        <option value="Tamil">Tamil</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Course & Batch */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                    2. Course & Cohort Enrollment
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Course Selection
                      </label>
                      <select
                        value={newStudent.enrolledCourse}
                        onChange={(e) => setNewStudent({ ...newStudent, enrolledCourse: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Building Biblical Theology">Building Biblical Theology</option>
                        <option value="Church History: Reformation to Modern">Church History</option>
                        <option value="Hermeneutics & Exegesis">Hermeneutics & Exegesis</option>
                        <option value="Pastoral Leadership & Counseling">Pastoral Leadership</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Batch</label>
                      <select
                        value={newStudent.batch}
                        onChange={(e) => setNewStudent({ ...newStudent, batch: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Batch 2026-A (Morning)">Batch 2026-A (Morning)</option>
                        <option value="Batch 2026-B (Evening)">Batch 2026-B (Evening)</option>
                        <option value="Self-Paced Online">Self-Paced Online</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Initial Admission Status
                      </label>
                      <select
                        value={newStudent.status}
                        onChange={(e) => setNewStudent({ ...newStudent, status: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ACTIVE">Active (Enrolled immediately)</option>
                        <option value="UNDER_REVIEW">Under Review (Interview scheduled)</option>
                        <option value="APPROVED">Approved (Pending fee payment)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Guardian Details */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                    3. Emergency Contact & City
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Guardian / Emergency Contact Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Paul (Father)"
                        value={newStudent.guardianName}
                        onChange={(e) => setNewStudent({ ...newStudent, guardianName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        City / Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bangalore, Karnataka"
                        value={newStudent.addressCity}
                        onChange={(e) => setNewStudent({ ...newStudent, addressCity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="md">
                    Complete Admission
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Bulk CSV Import Dialog */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Bulk Student CSV Import</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload a CSV file containing multiple student records with validation
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportPreview(null);
                    setImportSummary(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              {!importPreview ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-blue-900">Need the correct column format?</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Download the standard template with pre-filled sample headers
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleDownloadTemplate} className="gap-1 bg-white text-xs">
                      <Download size={13} />
                      Template
                    </Button>
                  </div>

                  {/* Dropzone container */}
                  <div
                    onClick={handleSimulateCSVPreview}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 rounded-2xl p-8 text-center cursor-pointer transition"
                  >
                    <FileSpreadsheet size={36} className="mx-auto text-blue-600 mb-2" />
                    <p className="text-xs font-bold text-slate-800">
                      Click to choose CSV file or drag & drop
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supports .csv UTF-8 formatted spreadsheets up to 5MB
                    </p>
                    <div className="mt-4">
                      <span className="inline-block px-3 py-1 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                        Select Demo CSV
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl text-center text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Total Rows</span>
                      <strong className="text-slate-900 text-sm">{importSummary?.total}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-500 block text-[10px] uppercase">Valid</span>
                      <strong className="text-emerald-600 text-sm">{importSummary?.valid}</strong>
                    </div>
                    <div>
                      <span className="text-rose-500 block text-[10px] uppercase">Duplicates</span>
                      <strong className="text-rose-600 text-sm">{importSummary?.duplicates}</strong>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase sticky top-0">
                        <tr className="border-b border-slate-200">
                          <th className="p-2">Row</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Phone</th>
                          <th className="p-2">Validation Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importPreview.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-[11px]">{r.row}</td>
                            <td className="p-2 font-semibold text-slate-900">{r.name}</td>
                            <td className="p-2 text-slate-500">{r.phone}</td>
                            <td className="p-2">
                              {r.status === 'VALID' ? (
                                <Badge variant="success">Ready</Badge>
                              ) : (
                                <Badge variant="danger">{r.status}</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImportPreview(null);
                        setImportSummary(null);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleConfirmImport}
                      className="bg-blue-600"
                    >
                      Import {importSummary?.valid} Valid Records
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
