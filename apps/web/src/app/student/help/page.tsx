'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/layout/student-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { HelpCircle, BookOpen, MessageSquare, Video, ExternalLink } from 'lucide-react';

interface StudentInstituteSummary {
  student?: {
    admissionNo?: string;
    name?: string;
  };
  institute?: {
    name?: string;
    slug?: string;
    supportEmail?: string;
    supportPhone?: string;
  };
}

export default function StudentHelpPage() {
  const [profile, setProfile] = useState<StudentInstituteSummary | null>(null);

  useEffect(() => {
    apiFetch<StudentInstituteSummary>('/students/me')
      .then((res) => setProfile(res))
      .catch(() => setProfile(null));
  }, []);

  const instituteName = profile?.institute?.name || 'Your Bible Institute';
  const supportEmail = profile?.institute?.supportEmail;
  const supportPhone = profile?.institute?.supportPhone;

  return (
    <StudentShell pageTitle="Help & Support">
      <div className="space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Student Support Desk · {instituteName}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Help & Guidance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assistance with course curriculum, live classes, timetable access, and academic records.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <MessageSquare size={22} />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Academic Inquiries & Notices</h3>
            <p className="text-xs text-slate-500 mt-1">
              Review institute announcements and academic desk updates from your faculty and registrar.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/student/messages"
                className="inline-flex items-center gap-1 py-2 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition"
              >
                Open Messages
                <ExternalLink size={12} />
              </Link>
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-block py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  {supportEmail}
                </a>
              )}
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <BookOpen size={22} />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Registrar & Fee Receipts</h3>
            <p className="text-xs text-slate-500 mt-1">
              Download invoices, review payment status, or check admission details
              {profile?.student?.admissionNo ? ` (${profile.student.admissionNo})` : ''}.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/student/payments"
                className="inline-flex items-center gap-1 py-2 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition"
              >
                Fee & Invoices
                <ExternalLink size={12} />
              </Link>
              {supportPhone && (
                <a
                  href={`tel:${supportPhone}`}
                  className="inline-block py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  {supportPhone}
                </a>
              )}
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Video size={22} />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Live Classes & Progress</h3>
            <p className="text-xs text-slate-500 mt-1">
              Check active live meeting links, recorded replays, and attendance summary across batches.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/student/classes"
                className="inline-flex items-center gap-1 py-2 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition"
              >
                Live Classes
                <ExternalLink size={12} />
              </Link>
              <Link
                href="/student/progress"
                className="inline-flex items-center gap-1 py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Progress Tracker
              </Link>
            </div>
          </Card>
        </div>

        {/* FAQs */}
        <Card className="p-6">
          <CardHeader
            title="Frequently Asked Questions"
            subtitle="Quick answers to common questions about the Student Portal"
          />
          <div className="space-y-4 text-xs mt-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm mb-1">
                How do I join a live Google Meet class?
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Navigate to the <strong>Live Classes</strong> tab. When a lecture is live, the session card will display a pulsing red LIVE badge and a blue <em>Join Now</em> button that launches Google Meet directly.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm mb-1">
                How is my attendance recorded?
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Attendance is recorded automatically by your instructor during daily cohort lectures and live sessions. You can review your attendance record in the <strong>Attendance</strong> tab.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm mb-1">
                When do I receive my course certificate?
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Certificates are issued automatically upon completing 100% of the lessons and submitting all required assignments and examinations. You will be able to download your official PDF from the <strong>Certificates</strong> tab.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </StudentShell>
  );
}

