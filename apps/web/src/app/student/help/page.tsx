'use client';

import React from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpCircle, Mail, Phone, BookOpen, MessageSquare, ExternalLink } from 'lucide-react';

export default function StudentHelpPage() {
  return (
    <StudentShell pageTitle="Help & Support">
      <div className="space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Student Support Desk
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Help & Guidance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assistance with course curriculum, video playback, timetable access, and academic records.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Mail size={22} />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Academic Inquiries</h3>
            <p className="text-xs text-slate-500 mt-1">
              For questions regarding curriculum, faculty office hours, or assignment grading.
            </p>
            <div className="mt-4">
              <a
                href="mailto:academic@bible-institute.org"
                className="inline-block py-2 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition"
              >
                academic@bible-institute.org
              </a>
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Phone size={22} />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Registrar & Admissions</h3>
            <p className="text-xs text-slate-500 mt-1">
              For fee receipts, enrollment letters, transcripts, and official certificates.
            </p>
            <div className="mt-4">
              <a
                href="tel:+918000000000"
                className="inline-block py-2 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition"
              >
                +91 (800) 000-0000
              </a>
            </div>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <HelpCircle size={22} />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Technical Help</h3>
            <p className="text-xs text-slate-500 mt-1">
              Issues with video playback, password resets, or Google Meet connections.
            </p>
            <div className="mt-4">
              <a
                href="mailto:support@bible-institute.org"
                className="inline-block py-2 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition"
              >
                support@bible-institute.org
              </a>
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
