'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
  color?: string;
}

export function LoadingSpinner({
  size = 'md',
  text,
  className = '',
  color = 'text-blue-600',
}: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  };

  return (
    <div className={`inline-flex items-center justify-center gap-2.5 ${className}`}>
      <Loader2 className={`${sizeMap[size]} animate-spin ${color}`} />
      {text && (
        <span className="text-xs font-semibold text-slate-600 tracking-tight">
          {text}
        </span>
      )}
    </div>
  );
}

interface SkeletonContainerProps {
  children: React.ReactNode;
  spinnerText?: string;
  spinnerPosition?: 'top' | 'center' | 'bottom';
  className?: string;
}

export function SkeletonWithSpinner({
  children,
  spinnerText = 'Loading portal content...',
  spinnerPosition = 'center',
  className = '',
}: SkeletonContainerProps) {
  return (
    <div className={`relative w-full ${className}`}>
      {/* Top Banner Spinner if position is 'top' */}
      {spinnerPosition === 'top' && (
        <div className="flex items-center justify-center py-3 mb-4 bg-white/80 backdrop-blur-xs rounded-2xl border border-blue-100 shadow-xs">
          <LoadingSpinner size="sm" text={spinnerText} />
        </div>
      )}

      {/* Center Floating Spinner Badge if position is 'center' */}
      {spinnerPosition === 'center' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-lg border border-slate-200/90 flex items-center gap-3">
            <LoadingSpinner size="md" color="text-blue-600" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800">{spinnerText}</span>
              <span className="text-[10px] text-slate-400">Synchronizing database...</span>
            </div>
          </div>
        </div>
      )}

      {/* Skeleton Content with Pulse */}
      <div className="animate-pulse opacity-75">
        {children}
      </div>

      {/* Bottom Banner Spinner if position is 'bottom' */}
      {spinnerPosition === 'bottom' && (
        <div className="flex items-center justify-center py-3 mt-4 bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-100">
          <LoadingSpinner size="sm" text={spinnerText} />
        </div>
      )}
    </div>
  );
}

/**
 * Lesson Player Loading Skeleton with Centered Spinner
 * Matches the exact layout of /student/courses/[courseId]/lessons/[lessonId]
 */
export function LessonLoadingSkeleton({ message = 'Loading lesson stream & lecture notes...' }: { message?: string }) {
  return (
    <div className="space-y-5 w-full">
      {/* Top Navigation & Breadcrumb Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse flex items-center justify-center">
            <Loader2 size={16} className="text-slate-400 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-44 bg-slate-200 rounded animate-pulse" />
            <div className="h-5 w-64 bg-slate-200 rounded-md animate-pulse" />
          </div>
        </div>

        {/* Loading Spinner Badge in Header */}
        <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200/60 px-3 py-1.5 rounded-xl">
          <Loader2 size={14} className="text-blue-600 animate-spin" />
          <span className="text-[11px] font-semibold text-blue-800">
            Fetching Lesson...
          </span>
        </div>
      </div>

      {/* Main Stage Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Video / Media Stage Skeleton (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Player Box with Centered Spinner */}
            <div className="relative bg-slate-900 aspect-video flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-3 shadow-lg border border-white/10">
                <Loader2 size={28} className="text-blue-400 animate-spin" />
              </div>
              <p className="text-sm font-bold text-white/95 tracking-tight max-w-sm">
                {message}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Please wait while video resources and exegesis materials are prepared...
              </p>
            </div>

            {/* Bottom Meta Skeleton */}
            <div className="p-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-4/5 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Right Sidebar Skeleton (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Resources Card Skeleton */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="w-4 h-4 rounded-full bg-slate-100 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          </div>

          {/* Learning Path Card Skeleton */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500/40 w-1/3 animate-pulse" />
            </div>
            <div className="h-3 w-48 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Course Detail Loading Skeleton with Spinner
 */
export function CourseDetailLoadingSkeleton({ message = 'Loading course curriculum & syllabi...' }: { message?: string }) {
  return (
    <div className="space-y-6 w-full">
      {/* Hero Banner Skeleton */}
      <div className="relative bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs overflow-hidden">
        {/* Floating Spinner Overlay */}
        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
          <div className="bg-white px-6 py-3.5 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <div>
              <p className="text-xs font-bold text-slate-800">{message}</p>
              <p className="text-[10px] text-slate-400">Loading modules and lessons...</p>
            </div>
          </div>
        </div>

        <div className="animate-pulse space-y-6">
          <div className="h-56 bg-slate-200 rounded-2xl w-full" />
          <div className="h-8 bg-slate-200 rounded-lg w-1/2" />
          <div className="h-4 bg-slate-200 rounded w-3/4" />
        </div>
      </div>

      {/* Curriculum Accordion Skeletons */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 animate-pulse flex justify-between items-center">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-4 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Grid Courses Loading Skeleton with Floating Spinner
 */
export function CourseGridLoadingSkeleton({ message = 'Loading enrolled courses...' }: { message?: string }) {
  return (
    <div className="relative w-full">
      {/* Floating Center Spinner */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <div className="bg-white px-5 py-3 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <span className="text-xs font-bold text-slate-800">{message}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="w-full h-40 bg-slate-200 rounded-xl" />
            <div className="w-24 h-4 bg-slate-200 rounded" />
            <div className="w-3/4 h-5 bg-slate-200 rounded" />
            <div className="w-full h-10 bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Generic Portal Dashboard Loading Skeleton with Spinner
 */
export function DashboardLoadingSkeleton({ message = 'Synchronizing student portal...' }: { message?: string }) {
  return (
    <div className="space-y-6 w-full">
      {/* Top Banner with Spinner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-xs font-bold tracking-wider uppercase text-cyan-400">
              {message}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">Welcome Back</h2>
          <p className="text-xs text-slate-400 max-w-md">
            Retrieving your courses, attendance, and recent activity...
          </p>
        </div>
      </div>

      {/* Grid Content Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/2" />
            <div className="h-8 bg-slate-200 rounded w-1/3" />
            <div className="h-3 bg-slate-100 rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
