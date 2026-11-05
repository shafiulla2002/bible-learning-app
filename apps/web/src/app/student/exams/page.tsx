'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { StudentPlaceholder } from '@/components/layout/student-placeholder';
import { GraduationCap } from 'lucide-react';

export default function StudentExamsPage() {
  return (
    <StudentShell pageTitle="Examinations">
      <StudentPlaceholder
        title="Examinations & Quizzes"
        category="Examinations"
        description="Take timed online theological examinations, hermeneutics quizzes, and review instant score reports."
        phasePlanned="Phase 5"
        icon={<GraduationCap size={28} />}
        features={[
          'Timed online quiz engine with live countdown timer',
          'Multiple choice questions with automated instant grading',
          'Attempt audit logging with anti-cheat submission validation',
          'Comprehensive scorecards and answer key reviews upon completion',
        ]}
      />
    </StudentShell>
  );
}
