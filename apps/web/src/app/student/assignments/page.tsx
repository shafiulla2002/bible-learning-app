'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { StudentPlaceholder } from '@/components/layout/student-placeholder';
import { FileCheck2 } from 'lucide-react';

export default function StudentAssignmentsPage() {
  return (
    <StudentShell pageTitle="Assignments">
      <StudentPlaceholder
        title="Assignments & Essays"
        category="Academic Assessments"
        description="View assignment guidelines, submit theological research essays, and review instructor grading and feedback."
        phasePlanned="Phase 5"
        icon={<FileCheck2 size={28} />}
        features={[
          'Submission status filter: Pending, Submitted, Graded',
          'Rich text submission and file attachment uploads',
          'Faculty grading rubrics and personalized theological feedback',
          'Due date countdown timers and late submission prevention',
        ]}
      />
    </StudentShell>
  );
}
