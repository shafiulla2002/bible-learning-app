'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { StudentPlaceholder } from '@/components/layout/student-placeholder';
import { MessageSquare } from 'lucide-react';

export default function StudentMessagesPage() {
  return (
    <StudentShell pageTitle="Messages & Announcements">
      <StudentPlaceholder
        title="Messages & Announcements"
        category="Communication"
        description="Receive official academic notices, faculty announcements, and direct messages from your instructors."
        phasePlanned="Phase 2 & 4"
        icon={<MessageSquare size={28} />}
        features={[
          'Institute-wide announcements and theological event alerts',
          'Faculty direct messaging and cohort discussion channels',
          'Assignment and examination submission notifications',
          'Read/unread status tracking and priority urgent broadcast banners',
        ]}
      />
    </StudentShell>
  );
}

