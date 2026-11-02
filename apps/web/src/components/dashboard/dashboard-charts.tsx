'use client';

import React, { useState } from 'react';
import {
  BatchDistributionItem,
  AttendanceTrendItem,
} from '@/lib/api';

/**
 * Format integer paise to localized currency string (defaults to INR ₹).
 */
export function formatINR(paise: number, currency = 'INR'): string {
  const major = Math.round((paise || 0) / 100);
  if (currency && currency !== 'INR') {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(major);
    } catch {
      return `${currency} ${major.toLocaleString()}`;
    }
  }
  return '₹' + major.toLocaleString('en-IN');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STUDENT ENROLLMENT & REGISTRATION BAR CHART (Pure Responsive SVG)
// ─────────────────────────────────────────────────────────────────────────────

interface EnrollmentBarChartProps {
  data: {
    month: string;
    label: string;
    count: number;
    registrations?: number;
  }[];
}

export function EnrollmentBarChart({ data }: EnrollmentBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasAnyActivity =
    data &&
    data.length > 0 &&
    data.some((d) => d.count > 0 || (d.registrations || 0) > 0);

  if (!hasAnyActivity) {
    return (
      <div className="h-60 flex flex-col items-center justify-center text-center px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <p className="text-xs font-semibold text-slate-600">
          No enrollment activity in this period
        </p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
          Monthly student registrations and course enrollments will render here
          once students are admitted.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.count, d.registrations || 0)),
    4,
  );
  const chartHeight = 195;
  const chartWidth = 540;
  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 24;
  const paddingBottom = 34;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const step = innerWidth / data.length;
  const singleBarW = Math.min(16, Math.max(8, step * 0.24));
  const gap = 3;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-60 overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const y = paddingTop + innerHeight * (1 - pct);
          const val = Math.round(maxVal * pct);
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke="#f1f5f9"
                strokeDasharray={pct === 0 ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-medium"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Grouped Bars: Registrations (Navy/Indigo) & Course Enrolments (Primary Blue) */}
        {data.map((item, idx) => {
          const regVal = item.registrations ?? item.count;
          const enrVal = item.count;
          const groupWidth = singleBarW * 2 + gap;
          const groupStartX = paddingLeft + idx * step + (step - groupWidth) / 2;

          const regH = (regVal / maxVal) * innerHeight;
          const enrH = (enrVal / maxVal) * innerHeight;
          const regY = paddingTop + innerHeight - regH;
          const enrY = paddingTop + innerHeight - enrH;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={item.month}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <rect
                x={paddingLeft + idx * step + 2}
                y={paddingTop}
                width={Math.max(4, step - 4)}
                height={innerHeight}
                fill={isHovered ? 'rgba(37, 99, 235, 0.05)' : 'transparent'}
                rx="6"
              />

              {/* Registrations Bar */}
              <rect
                x={groupStartX}
                y={regVal > 0 ? regY : paddingTop + innerHeight - 2}
                width={singleBarW}
                height={regVal > 0 ? Math.max(regH, 3) : 2}
                fill={isHovered ? '#1e293b' : '#334155'}
                rx="4"
              />

              {/* Enrolments Bar */}
              <rect
                x={groupStartX + singleBarW + gap}
                y={enrVal > 0 ? enrY : paddingTop + innerHeight - 2}
                width={singleBarW}
                height={enrVal > 0 ? Math.max(enrH, 3) : 2}
                fill={isHovered ? '#1d4ed8' : '#3b82f6'}
                rx="4"
              />

              {/* Month Label */}
              <text
                x={paddingLeft + idx * step + step / 2}
                y={chartHeight - 10}
                textAnchor="middle"
                className={`text-[10px] font-medium ${
                  isHovered ? 'fill-slate-900 font-bold' : 'fill-slate-400'
                }`}
              >
                {item.label.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Interactive Tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div
          className="absolute z-20 bg-slate-900 text-white rounded-xl shadow-lg px-3 py-2 text-xs pointer-events-none transform -translate-x-1/2"
          style={{
            left: `${Math.min(
              86,
              Math.max(
                14,
                ((paddingLeft + hoveredIdx * step + step / 2) / chartWidth) *
                  100,
              ),
            )}%`,
            top: '8px',
          }}
        >
          <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1 mb-1">
            {data[hoveredIdx].label}
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>
              Registrations:{' '}
              <strong>
                {data[hoveredIdx].registrations ?? data[hoveredIdx].count}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-blue-300 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>
              Course Enrolments: <strong>{data[hoveredIdx].count}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FINANCIAL COLLECTION & PENDING TREND CHART (Pure Responsive SVG)
// ─────────────────────────────────────────────────────────────────────────────

interface FinancialAreaChartProps {
  data: {
    month: string;
    label: string;
    collected: number;
    invoiced?: number;
    pending: number;
  }[];
  currency?: string;
}

export function FinancialAreaChart({
  data,
  currency = 'INR',
}: FinancialAreaChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasFinancialActivity =
    data &&
    data.length > 0 &&
    data.some(
      (d) => d.collected > 0 || d.pending > 0 || (d.invoiced || 0) > 0,
    );

  if (!hasFinancialActivity) {
    return (
      <div className="h-60 flex flex-col items-center justify-center text-center px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <p className="text-xs font-semibold text-slate-600">
          No fee collection or invoice trend in this range
        </p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
          Issued invoices and verified fee payments will appear here
          automatically.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.collected, d.pending, d.invoiced || 0)),
    100000, // ₹1,000 minimum scale in paise
  );

  const chartHeight = 195;
  const chartWidth = 540;
  const paddingLeft = 56;
  const paddingRight = 18;
  const paddingTop = 24;
  const paddingBottom = 34;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const step = innerWidth / Math.max(1, data.length - 1);

  const collectedPoints = data.map((d, i) => ({
    x: paddingLeft + i * step,
    y: paddingTop + innerHeight - (d.collected / maxVal) * innerHeight,
    collected: d.collected,
    invoiced: d.invoiced ?? 0,
    pending: d.pending,
    label: d.label,
  }));

  const collectedPath = collectedPoints.reduce(
    (acc, pt, idx) =>
      idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`,
    '',
  );

  const collectedAreaPath = `${collectedPath} L ${
    collectedPoints[collectedPoints.length - 1].x
  } ${paddingTop + innerHeight} L ${collectedPoints[0].x} ${
    paddingTop + innerHeight
  } Z`;

  const pendingPoints = data.map((d, i) => ({
    x: paddingLeft + i * step,
    y: paddingTop + innerHeight - (d.pending / maxVal) * innerHeight,
  }));

  const pendingPath = pendingPoints.reduce(
    (acc, pt, idx) =>
      idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`,
    '',
  );

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-60 overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="finCollectedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {[0, 0.33, 0.66, 1].map((pct, idx) => {
          const y = paddingTop + innerHeight * (1 - pct);
          const valInRupees = Math.round((maxVal * pct) / 100);
          const label =
            valInRupees >= 100000
              ? `₹${(valInRupees / 100000).toFixed(1)}L`
              : valInRupees >= 1000
                ? `₹${(valInRupees / 1000).toFixed(0)}k`
                : `₹${valInRupees}`;

          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke="#f1f5f9"
                strokeDasharray={pct === 0 ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-medium"
              >
                {label}
              </text>
            </g>
          );
        })}

        <path d={collectedAreaPath} fill="url(#finCollectedGrad)" />

        <path
          d={pendingPath}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="4 4"
        />

        <path
          d={collectedPath}
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {collectedPoints.map((pt, idx) => {
          const isHovered = hoveredIdx === idx;
          const pendPt = pendingPoints[idx];
          return (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isHovered && (
                <line
                  x1={pt.x}
                  y1={paddingTop}
                  x2={pt.x}
                  y2={paddingTop + innerHeight}
                  stroke="#94a3b8"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
              )}
              <circle
                cx={pendPt.x}
                cy={pendPt.y}
                r={isHovered ? 5 : 3.5}
                fill="#ffffff"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5.5 : 4}
                fill="#ffffff"
                stroke="#10b981"
                strokeWidth="2.5"
              />
              <text
                x={pt.x}
                y={chartHeight - 10}
                textAnchor="middle"
                className={`text-[10px] font-medium ${
                  isHovered ? 'fill-slate-900 font-bold' : 'fill-slate-400'
                }`}
              >
                {pt.label.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && collectedPoints[hoveredIdx] && (
        <div
          className="absolute z-20 bg-slate-900 text-white rounded-xl shadow-lg px-3 py-2 text-xs pointer-events-none transform -translate-x-1/2"
          style={{
            left: `${Math.min(
              84,
              Math.max(16, (collectedPoints[hoveredIdx].x / chartWidth) * 100),
            )}%`,
            top: '8px',
          }}
        >
          <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1 mb-1">
            {collectedPoints[hoveredIdx].label}
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              Collected:{' '}
              <strong>
                {formatINR(collectedPoints[hoveredIdx].collected, currency)}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-amber-300 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>
              Outstanding:{' '}
              <strong>
                {formatINR(collectedPoints[hoveredIdx].pending, currency)}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ENROLLMENT DISTRIBUTION BARS (By Course & By Batch)
// ─────────────────────────────────────────────────────────────────────────────

interface CourseDistributionProps {
  data: {
    courseTitle: string;
    fullTitle?: string;
    studentCount: number;
  }[];
}

export function CourseDistributionBars({ data }: CourseDistributionProps) {
  const nonZero = (data || []).filter((d) => d.studentCount > 0);
  if (!data || data.length === 0 || nonZero.length === 0) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-center px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <p className="text-xs font-semibold text-slate-600">
          No course enrollments recorded
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Course distribution bars appear when students enroll in courses.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((c) => c.studentCount), 1);
  const totalEnrolments = data.reduce((s, c) => s + c.studentCount, 0);
  const barColors = [
    'bg-blue-600',
    'bg-indigo-600',
    'bg-emerald-600',
    'bg-sky-600',
    'bg-slate-700',
    'bg-amber-600',
  ];

  return (
    <div className="space-y-3">
      {data.slice(0, 6).map((item, index) => {
        const pct =
          totalEnrolments > 0
            ? Math.round((item.studentCount / totalEnrolments) * 100)
            : 0;
        const barWidthPct = Math.round((item.studentCount / maxCount) * 100);

        return (
          <div key={index} title={item.fullTitle || item.courseTitle}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-800 truncate max-w-[230px]">
                {item.fullTitle || item.courseTitle}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold text-slate-900">
                  {item.studentCount}
                </span>
                <span className="text-[11px] text-slate-400">({pct}%)</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  barColors[index % barColors.length]
                } transition-all duration-500`}
                style={{ width: `${Math.max(barWidthPct, item.studentCount > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BatchDistributionBars({
  data,
}: {
  data: BatchDistributionItem[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-center px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <p className="text-xs font-semibold text-slate-600">
          No academic batches created yet
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Create a batch cohort to monitor batch enrollment capacity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.slice(0, 6).map((batch) => (
        <div key={batch.batchId}>
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="min-w-0 pr-2">
              <span className="font-semibold text-slate-800 truncate block">
                {batch.batchName}
              </span>
              <span className="text-[10px] text-slate-400 truncate block">
                {batch.courseTitle}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="font-bold text-slate-900">
                {batch.enrolledCount}/{batch.capacity}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">
                ({batch.utilizationPct}%)
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{
                width: `${Math.max(
                  batch.utilizationPct,
                  batch.enrolledCount > 0 ? 4 : 0,
                )}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ATTENDANCE DONUT RING & HONEST BREAKDOWN (Zero Fabricated Percentages)
// ─────────────────────────────────────────────────────────────────────────────

interface AttendanceDonutChartProps {
  percentage: number | null;
  presentCount?: number;
  lateCount?: number;
  absentCount?: number;
  excusedCount?: number;
  totalRecords?: number;
  minThresholdPct?: number;
  trend?: AttendanceTrendItem[];
}

export function AttendanceDonutChart({
  percentage,
  presentCount = 0,
  lateCount = 0,
  absentCount = 0,
  excusedCount = 0,
  totalRecords = 0,
  minThresholdPct = 75,
  trend = [],
}: AttendanceDonutChartProps) {
  const hasRecords = percentage !== null && totalRecords > 0;
  const ringPct = hasRecords ? Math.min(Math.max(percentage, 0), 100) : 0;
  const radius = 52;
  const strokeWidth = 11;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (ringPct / 100) * circumference;

  const ringColor = !hasRecords
    ? '#cbd5e1'
    : ringPct >= minThresholdPct
      ? '#2563eb'
      : '#f59e0b';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
        {/* Progress Ring */}
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg
            className="w-full h-full transform -rotate-90"
            viewBox="0 0 128 128"
          >
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />
            {hasRecords && (
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="transparent"
                stroke={ringColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {percentage !== null ? `${percentage}%` : 'N/A'}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              {hasRecords ? 'Attendance' : 'No Roll-Calls'}
            </span>
          </div>
        </div>

        {/* Exact Database Counts Breakdown */}
        <div className="grid grid-cols-2 gap-2 text-xs w-full">
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-emerald-900">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Present</span>
            </div>
            <p className="text-sm font-bold mt-0.5">{presentCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-900">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Late</span>
            </div>
            <p className="text-sm font-bold mt-0.5">{lateCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100 text-rose-900">
            <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Absent</span>
            </div>
            <p className="text-sm font-bold mt-0.5">{absentCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Excused</span>
            </div>
            <p className="text-sm font-bold mt-0.5">{excusedCount}</p>
          </div>
        </div>
      </div>

      {/* Monthly Attendance Trend Strip */}
      {trend && trend.some((t) => t.totalRecords > 0) && (
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
            <span className="font-semibold">Monthly Attendance Trend</span>
            <span>Min Policy: {minThresholdPct}%</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {trend.slice(-6).map((t) => (
              <div
                key={t.period}
                className="bg-slate-50 rounded-lg p-1.5 text-center border border-slate-100"
                title={`${t.label}: ${
                  t.percentage !== null ? `${t.percentage}%` : 'No sessions'
                } (${t.totalRecords} records)`}
              >
                <div className="text-[10px] font-bold text-slate-800">
                  {t.percentage !== null ? `${t.percentage}%` : '—'}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  {t.label.split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
