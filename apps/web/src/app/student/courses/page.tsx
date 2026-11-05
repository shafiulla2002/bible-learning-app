'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { StudentPlaceholder } from '@/components/layout/student-placeholder';
import { BookOpen } from 'lucide-react';

export default function StudentCoursesPage() {
  return (
    <StudentShell pageTitle="My Courses">
      <StudentPlaceholder
        title="My Courses"
        category="Curriculum & Learning"
        description="Access all your enrolled theological courses, video lectures, reading assignments, and module syllabi."
        phasePlanned="Phase 3"
        icon={<BookOpen size={28} />}
        features={[
          'Course catalog with progress percentage indicators',
          'Interactive lesson video player with automatic resume',
          'Downloadable study guides, PDF handouts & reading resources',
          'Module completion tracking and prerequisite validation',
        ]}
      />
    </StudentShell>
  );
}

