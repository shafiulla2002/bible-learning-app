'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { StudentPlaceholder } from '@/components/layout/student-placeholder';
import { Award } from 'lucide-react';

export default function StudentCertificatesPage() {
  return (
    <StudentShell pageTitle="Certificates">
      <StudentPlaceholder
        title="Certificates & Transcripts"
        category="Academic Credentials"
        description="View and download verified completion certificates for completed courses and diploma programs."
        phasePlanned="Phase 6"
        icon={<Award size={28} />}
        features={[
          'Official cryptographic verification token for public authenticity checks',
          'High-resolution PDF certificate viewer and download',
          'Academic transcript generation with course credits and letter grades',
          'Automated certificate issuance upon 100% course curriculum completion',
        ]}
      />
    </StudentShell>
  );
}

