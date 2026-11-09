'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  GraduationCap,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherStudents, TeacherStudentItem } from '@/lib/use-teacher-students';

export default function TeacherStudentsPage() {
  const {
    items,
    assignedBatches,
    totalCount,
    totalPages,
    page,
    limit,
    search,
    batchId,
    status,
    isLoading,
    error,
    setPage,
    setSearch,
    setBatchId,
    setStatus,
    refresh,
  } = useTeacherStudents();

  const [searchInput, setSearchInput] = useState(search);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setBatchId('ALL');
    setStatus('ALL');
    setPage(1);
  };

  const getStatusBadge = (enrolStatus: string) => {
    switch (enrolStatus.toUpperCase()) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 size={11} className="text-blue-500" />
            Completed
          </span>
        );
      case 'SUSPENDED':
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={11} className="text-rose-500" />
            Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {enrolStatus}
          </span>
        );
    }
  };

  return (
    <TeacherShell pageTitle="My Students Roster">
      <div className="space-y-6">

        {/* 1. Header Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-md border border-white/10">
                <Users size={13} className="text-indigo-400" />
                <span>Assigned Cohort Roster</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                My Students Directory
              </h1>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                View all students enrolled in your assigned Bible courses and teaching cohorts. 
                Data is strictly scoped to your active academic assignments.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
                <span className="block text-2xl font-black text-white">{totalCount}</span>
                <span className="text-[11px] text-blue-200 font-medium uppercase tracking-wider">
                  Enrolled Students
                </span>
              </div>
              <div className="px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
                <span className="block text-2xl font-black text-white">{assignedBatches.length}</span>
                <span className="text-[11px] text-blue-200 font-medium uppercase tracking-wider">
                  Assigned Batches
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Error State Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
              <div>
                <p className="text-sm font-bold">Failed to load student roster</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* 3. Search & Filter Bar */}
        <div className="p-4 md:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col md:flex-row md:items-center gap-3"
          >
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search students by name, email, or admission number..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Batch Filter Dropdown */}
            <div className="w-full md:w-64">
              <select
                value={batchId}
                onChange={(e) => {
                  setBatchId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              >
                <option value="ALL">All Assigned Batches ({assignedBatches.length})</option>
                {assignedBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Dropdown */}
            <div className="w-full md:w-44">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              >
                <option value="ALL">All Enrolment Status</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            {/* Submit & Reset Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Search
              </button>
              {(search || batchId !== 'ALL' || status !== 'ALL' || searchInput) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 4. Student Roster Directory Content */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
          {isLoading ? (
            /* Loading Skeleton */
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-36 bg-slate-200 rounded" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-40 bg-slate-100 rounded hidden md:block" />
                  <div className="h-6 w-20 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            /* Empty State */
            <div className="py-16 px-6 text-center max-w-md mx-auto space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Users size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900">No students found</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {assignedBatches.length === 0
                  ? "You have not been assigned to instruct any active batches yet. Once an administrator assigns you to a cohort, enrolled students will appear here automatically."
                  : "No students matched your search criteria. Try modifying your search keywords or clearing active filters."}
              </p>
              {(search || batchId !== 'ALL' || status !== 'ALL') && (
                <div className="pt-2">
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">Student</th>
                      <th className="py-3.5 px-4">Admission No</th>
                      <th className="py-3.5 px-4">Assigned Batch</th>
                      <th className="py-3.5 px-4">Enrolled Course</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-6">Enrolled Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {items.map((student) => {
                      const initials = student.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <tr
                          key={student.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          {/* Student Info */}
                          <td className="py-3.5 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                {initials}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{student.fullName}</p>
                                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  {student.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail size={10} className="text-slate-400" />
                                      {student.email}
                                    </span>
                                  )}
                                  {student.phone && (
                                    <span className="flex items-center gap-1 ml-2">
                                      <Phone size={10} className="text-slate-400" />
                                      {student.phone}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Admission No */}
                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                            {student.admissionNo}
                          </td>

                          {/* Batch */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <p className="font-semibold text-slate-800">{student.batchName}</p>
                              {student.batchCode && (
                                <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {student.batchCode}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Course */}
                          <td className="py-3.5 px-4 text-slate-700 font-medium">
                            {student.courseTitle}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {getStatusBadge(student.enrolmentStatus)}
                          </td>

                          {/* Enrolled Date */}
                          <td className="py-3.5 px-6 text-slate-500">
                            {new Date(student.enrolledAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-slate-100">
                {items.map((student) => {
                  const initials = student.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div key={student.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900">{student.fullName}</p>
                            <p className="text-xs font-mono text-slate-500">{student.admissionNo}</p>
                          </div>
                        </div>
                        {getStatusBadge(student.enrolmentStatus)}
                      </div>

                      <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Batch:</span>
                          <span className="font-semibold text-slate-800">{student.batchName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Course:</span>
                          <span className="font-medium text-slate-700">{student.courseTitle}</span>
                        </div>
                        {student.email && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                            <span className="text-slate-500">Email:</span>
                            <span className="text-slate-700 truncate max-w-[200px]">{student.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <div className="p-4 md:p-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-800">{items.length}</span> of{' '}
                  <span className="font-semibold text-slate-800">{totalCount}</span> enrolled students
                </span>

                <div className="flex items-center gap-2 self-center sm:self-auto">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft size={14} />
                    <span>Previous</span>
                  </button>

                  <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </TeacherShell>
  );
}

