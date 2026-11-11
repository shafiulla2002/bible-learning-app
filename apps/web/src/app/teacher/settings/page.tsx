'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Bell,
  Globe,
  Lock,
  Shield,
  Save,
  CheckCircle2,
  RefreshCw,
  Clock,
  LogOut,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherAuth } from '@/lib/use-teacher-auth';
import { teacherMeApi } from '@/lib/api';

export default function TeacherSettingsPage() {
  const { teacher, institute, logout } = useTeacherAuth({
    requireAuth: true,
    redirectTo: '/login',
  });

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [submissionAlerts, setSubmissionAlerts] = useState(true);
  const [liveSessionReminders, setLiveSessionReminders] = useState(true);
  const [examDeadlineAlerts, setExamDeadlineAlerts] = useState(true);
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    teacherMeApi
      .getSettings()
      .then((res) => {
        if (res?.settings) {
          setEmailNotifications(res.settings.emailNotifications);
          setSubmissionAlerts(res.settings.submissionAlerts);
          setLiveSessionReminders(res.settings.liveSessionReminders);
          setExamDeadlineAlerts(res.settings.examDeadlineAlerts);
          setPreferredLanguage(res.settings.preferredLanguage);
          setTimezone(res.settings.timezone);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSavedSuccess(false);
    try {
      await teacherMeApi.updateSettings({
        emailNotifications,
        submissionAlerts,
        liveSessionReminders,
        examDeadlineAlerts,
        preferredLanguage,
        timezone,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save portal preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeacherShell pageTitle="Teacher Settings">
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Portal Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure your notifications, academic preferences, timezone, and security.
          </p>
        </div>

        {saveError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
            {saveError}
          </div>
        )}

        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} className="text-emerald-600" />
            Your portal preferences have been persisted to PostgreSQL.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Notification Preferences */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Bell size={18} className="text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Notification Alerts</h3>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Email Notifications</p>
                  <p className="text-xs text-slate-500">
                    Receive email digests of important cohort announcements and updates.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Student Submission Alerts</p>
                  <p className="text-xs text-slate-500">
                    Notify me when students submit assignments or exam attempts.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={submissionAlerts}
                  onChange={(e) => setSubmissionAlerts(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Live Session Reminders</p>
                  <p className="text-xs text-slate-500">
                    Receive automated reminders 15 minutes before scheduled live classes.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={liveSessionReminders}
                  onChange={(e) => setLiveSessionReminders(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Exam Deadlines & Proctoring</p>
                  <p className="text-xs text-slate-500">
                    Get notifications when scheduled exam windows open or close.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={examDeadlineAlerts}
                  onChange={(e) => setExamDeadlineAlerts(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>

          {/* Regional & Timezone */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Globe size={18} className="text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Regional & Display</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">
                  Preferred Language
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Tamil">Tamil (தமிழ்)</option>
                  <option value="Telugu">Telugu (తెలుగు)</option>
                  <option value="Malayalam">Malayalam (മലയാളം)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="UTC">UTC (+0:00)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security & Session */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Shield size={18} className="text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Security & Session</h3>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-800">Faculty Session Security</p>
                <p className="text-xs text-slate-500">
                  Signed in as <strong className="text-slate-700">{teacher?.fullName}</strong> at{' '}
                  <strong className="text-slate-700">{institute?.name}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 transition shrink-0"
              >
                <LogOut size={14} />
                Sign Out Everywhere
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-sm disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Saving Preferences...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </TeacherShell>
  );
}
