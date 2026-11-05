'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { StudentPlaceholder } from '@/components/layout/student-placeholder';
import { CreditCard } from 'lucide-react';

export default function StudentPaymentsPage() {
  return (
    <StudentShell pageTitle="Fee Payments & Invoices">
      <StudentPlaceholder
        title="Tuition Fees & Official Receipts"
        category="Financial Portal"
        description="Review tuition fee invoices, outstanding balances, payment installment histories, and official receipts."
        phasePlanned="Phase 6"
        icon={<CreditCard size={28} />}
        features={[
          'Itemized tuition fee invoices with due date tracking',
          'Breakdown of paid amounts, outstanding balances, and installment plans',
          'Downloadable official payment receipts with financial sequence numbers',
          'Secure online fee payment portal integration',
        ]}
      />
    </StudentShell>
  );
}
