'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { StudentPlaceholder } from '@/components/layout/student-placeholder';
import { Calendar } from 'lucide-react';

export default function StudentCalendarPage() {
  return (
    <StudentShell pageTitle="Academic Calendar">
      <StudentPlaceholder
        title="Academic Calendar & Schedule"
        category="Academic Schedule"
        description="View your comprehensive monthly schedule of live lectures, assignment deadlines, and institute events."
        phasePlanned="Phase 2 & 4"
        icon={<Calendar size={28} />}
        features={[
          'Monthly and weekly calendar views synchronized with your enrolled cohorts',
          'Color-coded markers for live Google Meet sessions and assignment deadlines',
          'Filter by course, batch, or event type',
          'Export schedule to Google Calendar or Apple iCal',
        ]}
      />
    </StudentShell>
  );
}

