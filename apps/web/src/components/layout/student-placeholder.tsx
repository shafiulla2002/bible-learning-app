'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface StudentPlaceholderProps {
  title: string;
  category: string;
  description: string;
  phasePlanned: string;
  icon: React.ReactNode;
  features: string[];
}

export function StudentPlaceholder({
  title,
  category,
  description,
  phasePlanned,
  icon,
  features,
}: StudentPlaceholderProps) {
  return (
    <div className="space-y-6">
      {/* Header Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/student"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-sm"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                {category}
              </span>
              <Badge variant="info">{phasePlanned}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {title}
            </h1>
          </div>
        </div>

        <Link href="/student">
          <Button variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Main Roadmap Preview Card */}
      <Card className="p-8 md:p-12 text-center border-dashed border-2 border-slate-200 bg-white/70 backdrop-blur-sm">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-slate-900">{title} Module</h2>
        <p className="text-sm text-slate-500 max-w-lg mx-auto mt-2 leading-relaxed">
          {description}
        </p>

        {/* Planned Features List */}
        <div className="mt-8 max-w-md mx-auto text-left bg-slate-50 p-5 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            <Sparkles size={14} className="text-blue-600" />
            <span>Planned Capabilities for {phasePlanned}</span>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-600">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/student">
            <Button variant="primary">Return to Student Dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

