'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { StudentPlaceholder } from '@/components/layout/student-placeholder';
import { Video } from 'lucide-react';

export default function StudentClassesPage() {
  return (
    <StudentShell pageTitle="Live Classes">
      <StudentPlaceholder
        title="Live Classes & Cohort Sessions"
        category="Live Lectures"
        description="Join live Google Meet lectures, pastoral mentorship hours, and interactive faculty seminar sessions."
        phasePlanned="Phase 4"
        icon={<Video size={28} />}
        features={[
          'One-click direct Google Meet room joining with active LIVE status badges',
          'Upcoming schedule filtered by your enrolled cohorts & batches',
          'Automated session attendance logging and participation tracking',
          'Past recorded lecture archives with faculty presentation slides',
        ]}
      />
    </StudentShell>
  );
}

