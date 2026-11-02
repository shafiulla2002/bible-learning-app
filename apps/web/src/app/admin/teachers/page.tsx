'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { teacherApi, TeacherSummaryDto } from '@/lib/api';
import {
  GraduationCap,
  Users,
  Search,
  Filter,
  Plus,
  BookOpen,
  Calendar,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertCircle,
  Briefcase,
  Layers,
  RotateCcw,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <Building2 size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
];

export default function TeachersDirectoryPage() {
  const [instituteId, setInstituteId] = useState<string>('fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5');
  const [teachers, setTeachers] = useState<TeacherSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [specializationFilter, setSpecializationFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('current_institute_id') || 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
      setInstituteId(storedId);
    }
  }, []);

  const loadTeachers = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: 10,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (specializationFilter !== 'ALL') params.specialization = specializationFilter;

      const res = await teacherApi.getTeachers(instituteId, params);
      setTeachers(res.data);
      setTotalPages(res.meta.totalPages || 1);
      setTotalCount(res.meta.total || 0);
    } catch (err: any) {
      console.warn('Teacher fetch fallback:', err.message);
      // Fallback preview data for prototype navigation if API not directly reachable
      const fallbackList: TeacherSummaryDto[] = [
        {
          id: 'fac-1',
          employeeCode: 'FAC-2026-0001',
          fullName: 'Dr. Samuel V. Mathews',
          phoneE164: '+91 98401 23456',
          email: 's.mathews@faithseminary.edu',
          specialization: 'Systematic Theology',
          highestDegree: 'Ph.D in Biblical Studies',
          experienceYears: 14,
          status: 'ACTIVE',
          assignedCoursesCount: 3,
          assignedBatchesCount: 2,
          joiningDate: '2020-06-01',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'fac-2',
          employeeCode: 'FAC-2026-0002',
          fullName: 'Prof. Deborah Livingstone',
          phoneE164: '+91 98402 34567',
          email: 'deborah.l@faithseminary.edu',
          specialization: 'Biblical Languages (Hebrew/Greek)',
          highestDegree: 'M.Th (Old Testament)',
          experienceYears: 9,
          status: 'ACTIVE',
          assignedCoursesCount: 2,
          assignedBatchesCount: 1,
          joiningDate: '2022-01-15',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'fac-3',
          employeeCode: 'FAC-2026-0003',
          fullName: 'Pastor John Mark K.',
          phoneE164: '+91 98403 45678',
          email: 'johnmark@faithseminary.edu',
          specialization: 'Church History & Missions',
          highestDegree: 'D.Min (Pastoral Ministry)',
          experienceYears: 18,
          status: 'ACTIVE',
          assignedCoursesCount: 1,
          assignedBatchesCount: 2,
          joiningDate: '2018-08-01',
          createdAt: new Date().toISOString(),
        },
      ];
      setTeachers([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, currentPage, searchQuery, statusFilter, specializationFilter]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  // Distinct specializations for quick filtering
  const availableSpecializations = useMemo(() => {
    const specs = new Set<string>();
    teachers.forEach((t) => {
      if (t.specialization) specs.add(t.specialization);
    });
    return Array.from(specs);
  }, [teachers]);

  // Statistics
  const activeCount = useMemo(() => teachers.filter((t) => t.status === 'ACTIVE').length, [teachers]);
  const totalCoursesAssigned = useMemo(
    () => teachers.reduce((sum, t) => sum + (t.assignedCoursesCount || 0), 0),
    [teachers],
  );

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Institute Administrator"
      userRoleLabel="Administrator"
    >
      <div className="space-y-6">
        {/* Header with Title and Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                Milestone 2.6
              </span>
              <span className="text-xs text-muted-foreground font-mono">Faculty Roster</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <GraduationCap className="text-primary h-7 w-7" />
              Faculty & Teacher Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage theological faculty, assign courses and batch cohorts, and monitor instructional workloads.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTeachers()}
              className="flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/admin/teachers/new">
              <Button size="sm" className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="h-4 w-4" />
                Register New Teacher
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Faculty"
            value={totalCount.toString()}
            trend="Registered instructors"
            icon={<GraduationCap className="h-5 w-5 text-primary" />}
            colorScheme="blue"
          />
          <StatCard
            title="Active Teachers"
            value={activeCount.toString()}
            trend="Available for scheduling"
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            colorScheme="emerald"
          />
          <StatCard
            title="Course Assignments"
            value={totalCoursesAssigned.toString()}
            trend="Active teaching roles"
            icon={<BookOpen className="h-5 w-5 text-indigo-600" />}
            colorScheme="purple"
          />
          <StatCard
            title="Avg Faculty Experience"
            value="12.5 yrs"
            trend="Theological pedagogy"
            icon={<Briefcase className="h-5 w-5 text-amber-600" />}
            colorScheme="amber"
          />
        </div>

        {/* Search & Filters */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search faculty by name, phone, email, or employee code..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-sm bg-background border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="DRAFT">Draft</option>
                <option value="ON_LEAVE">On Leave</option>
              </select>

              {availableSpecializations.length > 0 && (
                <select
                  value={specializationFilter}
                  onChange={(e) => {
                    setSpecializationFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-sm bg-background border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">All Specializations</option>
                  {availableSpecializations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </Card>

        {/* Faculty Table Card */}
        <Card className="border shadow-sm overflow-hidden bg-card">
          <div className="px-6 py-4 border-b bg-muted/20 flex flex-row items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Faculty Roster</h2>
              <p className="text-xs text-muted-foreground">
                Showing {teachers.length} of {totalCount} instructors
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
                <tr>
                  <th className="px-6 py-3">Instructor</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3">Specialization & Degree</th>
                  <th className="px-6 py-3 text-center">Courses / Batches</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>Loading faculty records...</span>
                      </div>
                    </td>
                  </tr>
                ) : teachers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <GraduationCap className="h-10 w-10 text-muted-foreground/50" />
                        <p className="font-semibold text-foreground">No faculty members found</p>
                        <p className="text-xs text-muted-foreground">
                          {searchQuery
                            ? `No instructors matched "${searchQuery}". Try clearing search filters.`
                            : 'Get started by registering the first faculty member for this institute.'}
                        </p>
                        <Link href="/admin/teachers/new" className="mt-2">
                          <Button size="sm" className="flex items-center gap-1.5">
                            <Plus className="h-4 w-4" />
                            Add First Teacher
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  teachers.map((teacher) => (
                    <tr
                      key={teacher.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Name & Title */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shrink-0">
                            {teacher.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                          <div>
                            <Link
                              href={`/admin/teachers/${teacher.id}`}
                              className="font-medium text-foreground hover:text-primary transition underline-offset-2 hover:underline"
                            >
                              {teacher.fullName}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {teacher.highestDegree || 'Theology Faculty'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Employee Code */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs px-2 py-1 bg-muted rounded border text-muted-foreground">
                          {teacher.employeeCode || '—'}
                        </span>
                      </td>

                      {/* Contact Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{teacher.phoneE164}</span>
                          </div>
                          {teacher.email && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <span>{teacher.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Specialization & Exp */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs">
                          <p className="font-medium text-foreground">
                            {teacher.specialization || 'General Biblical Studies'}
                          </p>
                          <p className="text-muted-foreground">
                            {teacher.experienceYears
                              ? `${teacher.experienceYears} yrs experience`
                              : 'Experienced'}
                          </p>
                        </div>
                      </td>

                      {/* Assigned Counts */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {teacher.assignedCoursesCount || 0} Courses
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {teacher.assignedBatchesCount || 0} Batches
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Badge
                          variant={
                            teacher.status === 'ACTIVE'
                              ? 'success'
                              : teacher.status === 'DRAFT'
                              ? 'warning'
                              : 'neutral'
                          }
                          className="text-xs"
                        >
                          {teacher.status}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link href={`/admin/teachers/${teacher.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 px-2.5 flex items-center gap-1 hover:border-primary hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Manage
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PortalShell>
  );
}
