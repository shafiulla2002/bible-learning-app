'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Library,
  Users,
  Search,
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Award,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherBatches, TeacherBatchItem } from '@/lib/use-teacher-batches';

export default function TeacherBatchesPage() {
  const {
    batches,
    metrics,
    search,
    setSearch,
    status,
    setStatus,
    isLoading,
    error,
    refresh,
  } = useTeacherBatches();

  const [searchInput, setSearchInput] = useState(search);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('ALL');
  };

  const getStatusBadge = (batchStatus: string) => {
    switch (batchStatus?.toUpperCase()) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock size={12} className="text-blue-500" />
            Upcoming
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 size={12} className="text-slate-500" />
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            {batchStatus || 'Unknown'}
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    const isLead = role?.toUpperCase() === 'LEAD';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase ${
          isLead
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            : 'bg-slate-100 text-slate-600 border border-slate-200'
        }`}
      >
        <Award size={11} className={isLead ? 'text-indigo-600' : 'text-slate-500'} />
        {role || 'Faculty'}
      </span>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <TeacherShell pageTitle="My Batches & Cohorts">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Library size={22} />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  My Batches & Student Cohorts
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Manage assigned student cohorts, track attendance, monitor live classes, and manage curriculum progress.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm disabled:opacity-60"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Assigned Batches
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                  {metrics.totalAssignedBatches}
                </p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Library size={22} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold text-indigo-700">{metrics.activeBatches}</span> currently active cohorts
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Active Batches
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">
                  {metrics.activeBatches}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 size={22} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              In session this semester
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Enrolled Students
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                  {metrics.totalStudents}
                </p>
              </div>
              <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                <Users size={22} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
              Across all assigned batches
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Associated Courses
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                  {metrics.associatedCoursesCount}
                </p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <BookOpen size={22} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
              Curriculum disciplines
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by batch name, code or course title..."
                className="w-full pl-10 pr-24 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium mr-1 flex items-center gap-1">
                <Filter size={13} />
                Status:
              </span>
              {['ALL', 'ACTIVE', 'UPCOMING', 'COMPLETED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatus(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    status === st
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL' ? 'All Batches' : st}
                </button>
              ))}

              {(search || status !== 'ALL' || searchInput) && (
                <button
                  onClick={handleClearFilters}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 underline ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-rose-800">Unable to load batches</h3>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => refresh()}
              className="text-xs font-medium text-rose-700 hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 animate-pulse"
              >
                <div className="flex justify-between items-start">
                  <div className="h-5 bg-slate-200 rounded w-1/3" />
                  <div className="h-5 bg-slate-200 rounded w-16" />
                </div>
                <div className="h-6 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="pt-4 border-t border-slate-100 flex justify-between">
                  <div className="h-4 bg-slate-100 rounded w-20" />
                  <div className="h-4 bg-slate-100 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && batches.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Library size={28} />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No Batches Found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {search || status !== 'ALL'
                ? 'No assigned batches match your current search criteria or status filter.'
                : 'You are currently not assigned as lead instructor or faculty for any active cohorts.'}
            </p>
            {(search || status !== 'ALL') && (
              <button
                onClick={handleClearFilters}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* Batches Grid */}
        {!isLoading && batches.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-4">
                  {/* Card Header: Role & Status */}
                  <div className="flex items-center justify-between gap-2">
                    {getRoleBadge(batch.assignedRole)}
                    {getStatusBadge(batch.status)}
                  </div>

                  {/* Batch Title & Code */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">
                      <Link href={`/teacher/batches/${batch.id}`}>{batch.name}</Link>
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {batch.code && (
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                          {batch.code}
                        </span>
                      )}
                      {batch.termName && (
                        <span className="text-xs text-slate-500">
                          {batch.termName}
                          {batch.academicYearName ? ` (${batch.academicYearName})` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Associated Course */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Course Curriculum
                    </p>
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1">
                      {batch.courseTitle}
                    </p>
                  </div>

                  {/* Dates & Enrollment Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                        <Users size={12} className="text-slate-400" />
                        Students
                      </p>
                      <p className="text-sm font-bold text-slate-800">
                        {batch.activeStudentsCount}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          / {batch.capacity} cap
                        </span>
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        Timeline
                      </p>
                      <p className="text-xs font-medium text-slate-700">
                        {formatDate(batch.startDate)} – {formatDate(batch.endDate)}
                      </p>
                    </div>
                  </div>

                  {/* Next Live Session Preview if available */}
                  {batch.nextLiveSession && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-rose-700 font-medium">
                        <Radio size={14} className="animate-pulse text-rose-600" />
                        <span className="line-clamp-1">{batch.nextLiveSession.title}</span>
                      </div>
                      <span className="text-[11px] text-rose-600 font-semibold shrink-0">
                        {new Date(batch.nextLiveSession.startsAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/teacher/attendance?batchId=${batch.id}`}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition"
                      title="Mark batch attendance"
                    >
                      Attendance
                    </Link>
                    <Link
                      href={`/teacher/students?batchId=${batch.id}`}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition"
                      title="View batch roster"
                    >
                      Roster
                    </Link>
                  </div>

                  <Link
                    href={`/teacher/batches/${batch.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
                  >
                    Cohort Details
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
