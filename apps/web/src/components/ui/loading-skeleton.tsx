'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Database,
  Sparkles,
  Layers,
  GraduationCap,
  CreditCard,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
 * 1. PERCENTAGE PROGRESS HOOK
 * Animates smoothly from initial% to 95% while loading, and when loading finishes,
 * surges rapidly to 100% and holds briefly before completing.
 * ───────────────────────────────────────────────────────────────────────── */
export interface UsePercentageProgressOptions {
  isLoading: boolean;
  minDurationMs?: number;
  initialProgress?: number;
  onComplete?: () => void;
}

export function usePercentageProgress({
  isLoading,
  minDurationMs = 800,
  initialProgress = 12,
  onComplete,
}: UsePercentageProgressOptions) {
  const [progress, setProgress] = useState<number>(initialProgress);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const startTimeRef = useRef<number>(Date.now());
  const completedRef = useRef<boolean>(false);

  useEffect(() => {
    if (isLoading) {
      completedRef.current = false;
      setIsComplete(false);
      setProgress((prev) => (prev >= 100 ? initialProgress : Math.max(prev, initialProgress)));
      startTimeRef.current = Date.now();

      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 35) return prev + Math.floor(Math.random() * 8 + 6);
          if (prev < 68) return prev + Math.floor(Math.random() * 6 + 4);
          if (prev < 88) return prev + Math.floor(Math.random() * 3 + 2);
          if (prev < 95) return prev + 1;
          return prev;
        });
      }, 70);

      return () => clearInterval(interval);
    } else {
      if (completedRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const waitTime = Math.max(0, minDurationMs - elapsed);

      const surgeTimeout = setTimeout(() => {
        setProgress(100);
        const doneTimeout = setTimeout(() => {
          completedRef.current = true;
          setIsComplete(true);
          onComplete?.();
        }, 220);
        return () => clearTimeout(doneTimeout);
      }, Math.min(waitTime, 250));

      return () => clearTimeout(surgeTimeout);
    }
  }, [isLoading, minDurationMs, initialProgress, onComplete]);

  const clampedProgress = Math.min(100, Math.max(0, progress));

  let stageMessage = 'Connecting to institute database...';
  if (clampedProgress >= 100) {
    stageMessage = 'Database synchronized • 100% Complete';
  } else if (clampedProgress >= 88) {
    stageMessage = 'Finalizing live database reflection...';
  } else if (clampedProgress >= 65) {
    stageMessage = 'Compiling financial ledgers & performance...';
  } else if (clampedProgress >= 40) {
    stageMessage = 'Loading curriculum, batches & attendance...';
  } else if (clampedProgress >= 20) {
    stageMessage = 'Fetching student admissions & course metrics...';
  }

  return {
    progress: clampedProgress,
    isComplete,
    stageMessage,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2. STANDALONE LOADING SPINNER
 * ───────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────
 * 3. PERCENTAGE PROGRESS LOADER (Primary Modern UI Component)
 * Clean, animated 0% -> 100% progress bar with percentage readout & stage text
 * ───────────────────────────────────────────────────────────────────────── */
export interface PercentageProgressLoaderProps {
  progress: number;
  stageMessage?: string;
  title?: string;
  subtitle?: string;
  variant?: 'hero' | 'card' | 'inline';
  showCheckpoints?: boolean;
  className?: string;
}

export function PercentageProgressLoader({
  progress,
  stageMessage,
  title = 'Synchronizing Live Institute Data',
  subtitle = 'Fetching verified PostgreSQL database records without mock data...',
  variant = 'hero',
  showCheckpoints = true,
  className = '',
}: PercentageProgressLoaderProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)));
  const isFinished = clamped >= 100;

  const defaultStage = isFinished
    ? 'Database synchronized • 100% Complete'
    : clamped >= 85
    ? 'Finalizing live database reflection...'
    : clamped >= 60
    ? 'Compiling financial ledgers & attendance...'
    : clamped >= 35
    ? 'Loading curriculum, courses & batches...'
    : 'Connecting to PostgreSQL database...';

  const activeStage = stageMessage || defaultStage;

  if (variant === 'inline') {
    return (
      <div className={`w-full space-y-2 p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            {isFinished ? (
              <CheckCircle2 size={15} className="text-emerald-600" />
            ) : (
              <Loader2 size={15} className="text-blue-600 animate-spin" />
            )}
            <span>{activeStage}</span>
          </div>
          <span className={`font-extrabold font-mono ${isFinished ? 'text-emerald-600' : 'text-blue-600'}`}>
            {clamped}%
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <div
            className={`h-full rounded-full transition-all duration-200 ease-out ${
              isFinished
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500'
            }`}
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white via-slate-50/50 to-blue-50/30 border border-slate-200/90 shadow-sm overflow-hidden ${className}`}
    >
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto space-y-6">
        {/* Header Badge */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            <span>Bible Institute LMS • Real-Time Database Sync</span>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold transition-colors ${
              isFinished
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {isFinished ? (
              <CheckCircle2 size={13} className="text-emerald-600" />
            ) : (
              <Database size={13} className="text-blue-600" />
            )}
            <span>{isFinished ? '100% READY' : 'LIVE DB SYNC'}</span>
          </div>
        </div>

        {/* Big Percentage + Title */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {subtitle}
            </p>
          </div>

          {/* Large Animated Percentage Counter */}
          <div className="flex items-baseline gap-1 text-right">
            <span
              className={`text-4xl sm:text-5xl font-black font-mono tracking-tight transition-colors duration-200 ${
                isFinished ? 'text-emerald-600' : 'text-blue-600'
              }`}
            >
              {clamped}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-400 font-mono">%</span>
          </div>
        </div>

        {/* The Animated Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3.5 bg-slate-100/90 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner relative">
            <div
              className={`h-full rounded-full transition-all duration-200 ease-out relative ${
                isFinished
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600'
              }`}
              style={{ width: `${clamped}%` }}
            >
              {/* Animated sheen highlight */}
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>

          {/* Dynamic Stage Message & Spinner */}
          <div className="flex items-center justify-between text-xs font-medium text-slate-600 pt-1">
            <div className="flex items-center gap-2">
              {isFinished ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              ) : (
                <Loader2 size={15} className="text-blue-600 animate-spin shrink-0" />
              )}
              <span className={isFinished ? 'font-bold text-emerald-700' : 'text-slate-700'}>
                {activeStage}
              </span>
            </div>

            <span className="text-[11px] font-mono text-slate-400">
              {isFinished ? 'Fast Live Reflect' : 'High-Performance Sync'}
            </span>
          </div>
        </div>

        {/* Checkpoint Pills */}
        {showCheckpoints && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            <div
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                clamped >= 25
                  ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-800'
                  : 'bg-white border-slate-200/70 text-slate-400'
              }`}
            >
              <Database size={14} className={clamped >= 25 ? 'text-emerald-600' : 'text-slate-300'} />
              <span>DB Connected</span>
            </div>

            <div
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                clamped >= 50
                  ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-800'
                  : 'bg-white border-slate-200/70 text-slate-400'
              }`}
            >
              <GraduationCap size={14} className={clamped >= 50 ? 'text-emerald-600' : 'text-slate-300'} />
              <span>Admissions</span>
            </div>

            <div
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                clamped >= 75
                  ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-800'
                  : 'bg-white border-slate-200/70 text-slate-400'
              }`}
            >
              <Layers size={14} className={clamped >= 75 ? 'text-emerald-600' : 'text-slate-300'} />
              <span>Curriculum</span>
            </div>

            <div
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                clamped >= 100
                  ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-800'
                  : 'bg-white border-slate-200/70 text-slate-400'
              }`}
            >
              <CreditCard size={14} className={clamped >= 100 ? 'text-emerald-600' : 'text-slate-300'} />
              <span>Finances</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 4. SKELETON CONTAINER WITH SPINNER & PROGRESS BAR
 * ───────────────────────────────────────────────────────────────────────── */
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
  // Built-in smooth progress animation for all skeleton containers
  const [internalProgress, setInternalProgress] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev < 40) return prev + Math.floor(Math.random() * 8 + 5);
        if (prev < 75) return prev + Math.floor(Math.random() * 5 + 3);
        if (prev < 94) return prev + 2;
        return prev;
      });
    }, 85);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Top Banner Spinner */}
      {spinnerPosition === 'top' && (
        <div className="flex flex-col items-center justify-center py-3 mb-4 bg-white/90 backdrop-blur-xs rounded-2xl border border-blue-100 shadow-xs">
          <LoadingSpinner size="sm" text={spinnerText} />
          <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-150"
              style={{ width: `${internalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Center Floating Spinner Badge with Percentage Progress */}
      {spinnerPosition === 'center' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-white/95 backdrop-blur-md px-6 py-4 rounded-3xl shadow-xl border border-slate-200/90 flex flex-col gap-2.5 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LoadingSpinner size="md" color="text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">{spinnerText}</span>
                  <span className="text-[10px] text-slate-400">Synchronizing database...</span>
                </div>
              </div>
              <span className="text-xs font-extrabold font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                {internalProgress}%
              </span>
            </div>

            {/* Moving Progress Bar */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-150 ease-out"
                style={{ width: `${internalProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Skeleton Content with Pulse */}
      <div className="animate-pulse opacity-75">{children}</div>

      {/* Bottom Banner Spinner */}
      {spinnerPosition === 'bottom' && (
        <div className="flex items-center justify-center py-3 mt-4 bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-100">
          <LoadingSpinner size="sm" text={spinnerText} />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 5. SPECIALIZED SKELETON LOADERS WITH PROGRESS
 * ───────────────────────────────────────────────────────────────────────── */

export function DashboardLoadingSkeleton({
  message = 'Synchronizing student portal...',
}: {
  message?: string;
}) {
  const { progress } = usePercentageProgress({ isLoading: true, minDurationMs: 900 });

  return (
    <div className="space-y-6 w-full">
      <PercentageProgressLoader
        progress={progress}
        title="Synchronizing Student Portal"
        subtitle={message}
        variant="hero"
      />

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

export function LessonLoadingSkeleton({
  message = 'Loading lesson stream & lecture notes...',
}: {
  message?: string;
}) {
  const [prog, setProg] = useState(20);
  useEffect(() => {
    const t = setInterval(() => setProg((p) => (p < 92 ? p + 5 : p)), 90);
    return () => clearInterval(t);
  }, []);

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
            Fetching Lesson ({prog}%)...
          </span>
        </div>
      </div>

      {/* Main Stage Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="relative bg-slate-900 aspect-video flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-3 shadow-lg border border-white/10">
                <Loader2 size={28} className="text-blue-400 animate-spin" />
              </div>
              <p className="text-sm font-bold text-white/95 tracking-tight max-w-sm">
                {message}
              </p>
              <div className="w-56 h-1.5 bg-white/10 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-blue-400 h-full rounded-full transition-all duration-200"
                  style={{ width: `${prog}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 font-mono">
                {prog}% • Preparing video resources & lecture notes...
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-5">
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
        </div>
      </div>
    </div>
  );
}

export function CourseDetailLoadingSkeleton({
  message = 'Loading course curriculum & syllabi...',
}: {
  message?: string;
}) {
  return (
    <div className="space-y-6 w-full">
      <SkeletonWithSpinner spinnerText={message}>
        <div className="relative bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs overflow-hidden">
          <div className="animate-pulse space-y-6">
            <div className="h-56 bg-slate-200 rounded-2xl w-full" />
            <div className="h-8 bg-slate-200 rounded-lg w-1/2" />
            <div className="h-4 bg-slate-200 rounded w-3/4" />
          </div>
        </div>
      </SkeletonWithSpinner>
    </div>
  );
}

export function CourseGridLoadingSkeleton({
  message = 'Loading enrolled courses...',
}: {
  message?: string;
}) {
  return (
    <div className="relative w-full">
      <SkeletonWithSpinner spinnerText={message}>
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
      </SkeletonWithSpinner>
    </div>
  );
}
