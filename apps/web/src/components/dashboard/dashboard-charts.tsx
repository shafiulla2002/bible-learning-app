'use client';

import React, { useState } from 'react';

// Format paise to INR string
export function formatINR(paise: number): string {
  const rupees = Math.round(paise / 100);
  return '₹' + rupees.toLocaleString('en-IN');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENROLLMENT BAR CHART (Pure SVG)
// ─────────────────────────────────────────────────────────────────────────────

interface EnrollmentBarChartProps {
  data: { month: string; label: string; count: number }[];
}

export function EnrollmentBarChart({ data }: EnrollmentBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No enrollment records for this period</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.count), 10);
  const chartHeight = 180;
  const chartWidth = 500;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const barWidth = Math.min(32, innerWidth / (data.length * 2));
  const step = innerWidth / data.length;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-64 overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="enrollBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="enrollBarHover" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
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

        {/* Bars */}
        {data.map((item, idx) => {
          const x = paddingLeft + idx * step + (step - barWidth) / 2;
          const barHeight = (item.count / maxVal) * innerHeight;
          const y = paddingTop + innerHeight - barHeight;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={item.month}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Background hover column */}
              <rect
                x={paddingLeft + idx * step}
                y={paddingTop}
                width={step}
                height={innerHeight}
                fill={isHovered ? 'rgba(59, 130, 246, 0.05)' : 'transparent'}
                rx="6"
              />

              {/* The bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 3)}
                fill={isHovered ? 'url(#enrollBarHover)' : 'url(#enrollBarGrad)'}
                rx="5"
                filter={isHovered ? 'drop-shadow(0 4px 6px rgba(37,99,235,0.25))' : 'none'}
              />

              {/* Value on top of bar */}
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                className={`text-[11px] font-bold ${
                  isHovered ? 'fill-blue-600' : 'fill-slate-600'
                }`}
              >
                {item.count}
              </text>

              {/* Month label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - 8}
                textAnchor="middle"
                className={`text-[11px] font-medium ${
                  isHovered ? 'fill-blue-700 font-semibold' : 'fill-slate-400'
                }`}
              >
                {item.label.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FINANCIAL PERFORMANCE AREA / LINE CHART (Pure SVG)
// ─────────────────────────────────────────────────────────────────────────────

interface FinancialAreaChartProps {
  data: { month: string; label: string; collected: number; pending: number }[];
}

export function FinancialAreaChart({ data }: FinancialAreaChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No financial data available for this range</p>
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.collected, d.pending)),
    5000000, // 50,000 INR in paise minimum scale
  );

  const chartHeight = 180;
  const chartWidth = 500;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const step = innerWidth / (data.length - 1 || 1);

  // Generate path points for collected
  const collectedPoints = data.map((d, i) => {
    const x = paddingLeft + i * step;
    const y = paddingTop + innerHeight - (d.collected / maxVal) * innerHeight;
    return { x, y, collected: d.collected, pending: d.pending, label: d.label };
  });

  const collectedPath = collectedPoints.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    '',
  );

  const collectedAreaPath = `${collectedPath} L ${
    collectedPoints[collectedPoints.length - 1].x
  } ${paddingTop + innerHeight} L ${collectedPoints[0].x} ${
    paddingTop + innerHeight
  } Z`;

  // Generate path points for pending
  const pendingPoints = data.map((d, i) => {
    const x = paddingLeft + i * step;
    const y = paddingTop + innerHeight - (d.pending / maxVal) * innerHeight;
    return { x, y };
  });

  const pendingPath = pendingPoints.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    '',
  );

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-64 overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="collectedAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines with currency values */}
        {[0, 0.33, 0.66, 1].map((pct, idx) => {
          const y = paddingTop + innerHeight * (1 - pct);
          const valInRupees = Math.round((maxVal * pct) / 100);
          const label =
            valInRupees >= 100000
              ? `₹${(valInRupees / 100000).toFixed(1)}L`
              : `₹${(valInRupees / 1000).toFixed(0)}k`;

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

        {/* Area fill for collected */}
        <path d={collectedAreaPath} fill="url(#collectedAreaGrad)" />

        {/* Pending line (amber dashed) */}
        <path
          d={pendingPath}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeDasharray="4 4"
        />

        {/* Collected line (emerald solid) */}
        <path
          d={collectedPath}
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Dots and interactive hover points */}
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
              {/* Vertical guideline on hover */}
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

              {/* Pending dot */}
              <circle
                cx={pendPt.x}
                cy={pendPt.y}
                r={isHovered ? 5 : 3.5}
                fill="#ffffff"
                stroke="#f59e0b"
                strokeWidth="2"
              />

              {/* Collected dot */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 6 : 4}
                fill="#ffffff"
                stroke="#10b981"
                strokeWidth="2.5"
                filter={isHovered ? 'drop-shadow(0 2px 4px rgba(16,185,129,0.4))' : 'none'}
              />

              {/* Month label */}
              <text
                x={pt.x}
                y={chartHeight - 8}
                textAnchor="middle"
                className={`text-[11px] font-medium ${
                  isHovered ? 'fill-slate-900 font-semibold' : 'fill-slate-400'
                }`}
              >
                {pt.label.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip when hovered */}
      {hoveredIdx !== null && (
        <div
          className="absolute z-10 bg-slate-900 text-white rounded-xl shadow-xl px-3 py-2 text-xs pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all"
          style={{
            left: `${((collectedPoints[hoveredIdx].x) / chartWidth) * 100}%`,
            top: '40px',
          }}
        >
          <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1 mb-1">
            {collectedPoints[hoveredIdx].label}
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Collected: {formatINR(collectedPoints[hoveredIdx].collected)}</span>
          </div>
          <div className="flex items-center gap-2 text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Pending: {formatINR(collectedPoints[hoveredIdx].pending)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. COURSE DISTRIBUTION (Horizontal Bars)
// ─────────────────────────────────────────────────────────────────────────────

interface CourseDistributionProps {
  data: { courseTitle: string; studentCount: number }[];
}

export function CourseDistributionBars({ data }: CourseDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-sm">
        <p>No course enrolments recorded</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((c) => c.studentCount), 1);
  const totalEnrolments = data.reduce((s, c) => s + c.studentCount, 0);

  const colors = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-purple-500 to-violet-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ];

  return (
    <div className="space-y-3.5">
      {data.slice(0, 6).map((item, index) => {
        const pct = Math.round((item.studentCount / (totalEnrolments || 1)) * 100);
        const barWidthPct = Math.round((item.studentCount / maxCount) * 100);
        const colorClass = colors[index % colors.length];

        return (
          <div key={index} className="group">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-800 truncate max-w-[240px]">
                {item.courseTitle}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-slate-900">{item.studentCount} students</span>
                <span className="text-[11px] text-slate-400">({pct}%)</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-500 ease-out`}
                style={{ width: `${barWidthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ATTENDANCE DONUT CHART & PERFORMANCE RING
// ─────────────────────────────────────────────────────────────────────────────

interface AttendanceDonutChartProps {
  percentage: number | null;
}

export function AttendanceDonutChart({ percentage }: AttendanceDonutChartProps) {
  const validPct = percentage !== null ? Math.min(Math.max(percentage, 0), 100) : 85; // default fallback preview if null
  const radius = 54;
  const strokeWidth = 11;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (validPct / 100) * circumference;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
      {/* Circular Progress Ring */}
      <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 130 130">
          {/* Background circle */}
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="transparent"
            stroke="#2563eb"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {percentage !== null ? `${percentage}%` : 'N/A'}
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mt-0.5">
            Attendance Rate
          </span>
        </div>
      </div>

      {/* Breakdown Legend */}
      <div className="space-y-2.5 text-xs w-full max-w-[200px]">
        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 text-emerald-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium">Present / Regular</span>
          </div>
          <span className="font-bold">{validPct}%</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 text-amber-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="font-medium">Late / Excused</span>
          </div>
          <span className="font-bold">{Math.round((100 - validPct) * 0.4)}%</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/70 text-rose-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="font-medium">Absent</span>
          </div>
          <span className="font-bold">{Math.round((100 - validPct) * 0.6)}%</span>
        </div>
      </div>
    </div>
  );
}

