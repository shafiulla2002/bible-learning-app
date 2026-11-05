'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { StudentPlaceholder } from '@/components/layout/student-placeholder';
import { PieChart } from 'lucide-react';

export default function StudentProgressPage() {
  return (
    <StudentShell pageTitle="Learning Progress">
      <StudentPlaceholder
        title="Learning Progress & Analytics"
        category="Academic Analytics"
        description="Monitor your overall theological study hours, course progression, category distribution, and daily streaks."
        phasePlanned="Phase 2"
        icon={<PieChart size={28} />}
        features={[
          'Multi-segment circular progress donut chart across theological disciplines',
          'Weekly learning goal tracking with dynamic completion progress rings',
          'Consecutive day study streaks and total verified learning hours',
          'Academic term credit summaries and course milestone badges',
        ]}
      />
    </StudentShell>
  );
}
