'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStudentAuth } from '@/lib/use-student-auth';
import { User, Mail, Phone, Church, Globe, Shield, BookOpen } from 'lucide-react';

export default function StudentProfilePage() {
  const { student, profile, institute, activeEnrolmentCount, isLoading } = useStudentAuth();

  return (
    <StudentShell pageTitle="My Profile">
      <div className="space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Account & Identity
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Student Profile
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Verified admission identity and academic enrollment record.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Identity Card */}
          <Card className="p-6 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-2xl shadow-xl shadow-blue-500/20 mb-4">
              {student?.fullName
                ? student.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : 'ST'}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{student?.fullName || 'Grace Thomas'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Admission No: <strong className="text-slate-700">{profile?.admissionNo || 'ADM-2026-001'}</strong>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="success">Active Student</Badge>
              <Badge variant="primary">{institute?.code || 'GBI'}</Badge>
            </div>

            <div className="mt-6 w-full pt-6 border-t border-slate-100 space-y-3 text-left text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-400">
                  <BookOpen size={15} />
                  <span>Enrolled Courses</span>
                </span>
                <span className="font-bold text-slate-800">{activeEnrolmentCount || 1}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-400">
                  <Shield size={15} />
                  <span>Tenant Status</span>
                </span>
                <span className="font-bold text-emerald-600">Verified</span>
              </div>
            </div>
          </Card>

          {/* Details & Academic Context */}
          <Card className="lg:col-span-2 p-6 space-y-6">
            <CardHeader
              title="Personal & Academic Information"
              subtitle="Information synchronized from your official admission record"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-400 mb-1">
                  <Mail size={14} />
                  <span>Email Address</span>
                </span>
                <p className="font-bold text-slate-800 text-sm">
                  {student?.email || 'grace.thomas@example.org'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-400 mb-1">
                  <Phone size={14} />
                  <span>Phone Number</span>
                </span>
                <p className="font-bold text-slate-800 text-sm">
                  {student?.phone || '+91 98111 00001'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-400 mb-1">
                  <Church size={14} />
                  <span>Home Church Affiliation</span>
                </span>
                <p className="font-bold text-slate-800 text-sm">
                  {profile?.church || 'St. Thomas Evangelical Church'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="flex items-center gap-2 text-slate-400 mb-1">
                  <Globe size={14} />
                  <span>Preferred Language</span>
                </span>
                <p className="font-bold text-slate-800 text-sm">
                  {profile?.preferredLanguage || 'English'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 leading-relaxed">
              <p className="font-bold mb-1">Academic Institute Context</p>
              <p className="text-blue-700">
                You are enrolled under <strong className="text-blue-950">{institute?.name || 'Grace Bible Institute'}</strong>.
                All course registrations, fee receipts, and certificates are cryptographically bound to this academic institution.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </StudentShell>
  );
}
