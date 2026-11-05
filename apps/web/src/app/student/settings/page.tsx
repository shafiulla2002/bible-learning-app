'use client';

import React, { useState, useEffect } from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Settings,
  Bell,
  Globe,
  Lock,
  Shield,
  Save,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export default function StudentSettingsPage() {
  const [preferredLanguage, setPreferredLanguage] = useState<string>('English');
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true);
  const [smsNotifications, setSmsNotifications] = useState<boolean>(false);
  const [courseReminders, setCourseReminders] = useState<boolean>(true);
  const [examAlerts, setExamAlerts] = useState<boolean>(true);
  const [liveClassReminders, setLiveClassReminders] = useState<boolean>(true);

  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        else headers['x-dev-role'] = 'STUDENT';

        const res = await fetch('/api/students/settings', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setPreferredLanguage(data.settings.preferredLanguage || 'English');
            if (data.settings.notifications) {
              setEmailNotifications(data.settings.notifications.emailNotifications ?? true);
              setSmsNotifications(data.settings.notifications.smsNotifications ?? false);
              setCourseReminders(data.settings.notifications.courseReminders ?? true);
              setExamAlerts(data.settings.notifications.examAlerts ?? true);
              setLiveClassReminders(data.settings.notifications.liveSessionReminders ?? true);
            }
          }
        }
      } catch (err) {
        console.error('Load settings error:', err);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-dev-role'] = 'STUDENT';

      await fetch('/api/students/settings', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          preferredLanguage,
          notifications: {
            emailNotifications,
            smsNotifications,
            courseReminders,
            examAlerts,
            liveSessionReminders: liveClassReminders,
          },
        }),
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Save settings error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudentShell pageTitle="Settings">
      <div className="space-y-6 max-w-4xl">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Preferences & Controls
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Student Account Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure learning platform language, automated notification channels, and account security.
          </p>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Settings preferences saved successfully.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Language Card */}
          <Card className="p-6 border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Globe size={18} className="text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Platform Language</h3>
                <p className="text-[11px] text-slate-500">Choose your preferred reading and navigation language.</p>
              </div>
            </div>

            <div className="max-w-xs text-xs">
              <label className="font-semibold text-slate-700 block mb-1">Language</label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="English">English (United States)</option>
                <option value="Spanish">Spanish (Español)</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
                <option value="Tamil">Tamil (தமிழ்)</option>
                <option value="Telugu">Telugu (తెలుగు)</option>
                <option value="Malayalam">Malayalam (മലയാളം)</option>
              </select>
            </div>
          </Card>

          {/* Notifications Card */}
          <Card className="p-6 border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Bell size={18} className="text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Academic Notifications</h3>
                <p className="text-[11px] text-slate-500">Manage alerts for assignments, exams, and live classes.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100/60 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Email Notifications</div>
                  <div className="text-[11px] text-slate-500">Receive weekly digests and tuition invoices via email.</div>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100/60 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Live Session Reminders</div>
                  <div className="text-[11px] text-slate-500">Alerts 15 minutes before scheduled Google Meet classes.</div>
                </div>
                <input
                  type="checkbox"
                  checked={liveClassReminders}
                  onChange={(e) => setLiveClassReminders(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100/60 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Examination & Assignment Alerts</div>
                  <div className="text-[11px] text-slate-500">Due date warnings and published exam results.</div>
                </div>
                <input
                  type="checkbox"
                  checked={examAlerts}
                  onChange={(e) => setExamAlerts(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100/60 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">SMS / WhatsApp Reminders</div>
                  <div className="text-[11px] text-slate-500">Urgent attendance and emergency campus notices.</div>
                </div>
                <input
                  type="checkbox"
                  checked={smsNotifications}
                  onChange={(e) => setSmsNotifications(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
            </div>
          </Card>

          {/* Account Security Card */}
          <Card className="p-6 border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Lock size={18} className="text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Account Security</h3>
                <p className="text-[11px] text-slate-500">Manage authentication credentials and active sessions.</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
              <div>
                <span className="font-bold text-blue-900 block">Password Authentication</span>
                <span className="text-[11px] text-blue-700">Protected with bcrypt hashing. Last updated upon enrollment.</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => alert('Password reset verification link sent to your registered email.')}
                className="text-xs h-8 bg-white text-blue-600 border-blue-200 hover:bg-blue-50 font-semibold"
              >
                Change Password
              </Button>
            </div>
          </Card>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-10 px-6 gap-1.5 shadow-sm"
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save Preferences
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </StudentShell>
  );
}

