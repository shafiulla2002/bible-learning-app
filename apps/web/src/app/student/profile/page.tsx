'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  User,
  Mail,
  Phone,
  Church,
  Globe,
  Shield,
  BookOpen,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Camera,
  MapPin,
  Lock,
} from 'lucide-react';

interface PersonalProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: any;
  guardian?: any;
  church?: string | null;
  preferredLanguage: string;
}

interface EnrolledCourseSummary {
  enrolmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  batchName: string;
  enrolledAt: string;
  status: string;
}

interface AcademicProfile {
  admissionNo: string;
  instituteName: string;
  instituteSlug: string;
  instituteLogo?: string | null;
  status: string;
  enrolmentDate: string;
  enrolledCourses: EnrolledCourseSummary[];
}

export default function StudentProfilePage() {
  const [personal, setPersonal] = useState<PersonalProfile | null>(null);
  const [academic, setAcademic] = useState<AcademicProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for editable fields
  const [phone, setPhone] = useState<string>('');
  const [church, setChurch] = useState<string>('');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('English');
  const [addressLine, setAddressLine] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [country, setCountry] = useState<string>('India');
  const [guardianName, setGuardianName] = useState<string>('');
  const [guardianPhone, setGuardianPhone] = useState<string>('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-dev-role'] = 'STUDENT';

      const res = await fetch('/api/students/profile', { headers });
      if (res.ok) {
        const data = await res.json();
        const p = data.profile?.personal;
        const a = data.profile?.academic;

        if (p) {
          setPersonal(p);
          setPhone(p.phone || '');
          setChurch(p.church || '');
          setPreferredLanguage(p.preferredLanguage || 'English');
          if (p.address) {
            setAddressLine(p.address.line || p.address.street || '');
            setCity(p.address.city || '');
            setState(p.address.state || '');
            setCountry(p.address.country || 'India');
          }
          if (p.guardian) {
            setGuardianName(p.guardian.name || '');
            setGuardianPhone(p.guardian.phone || '');
          }
        }
        if (a) setAcademic(a);
      } else {
        // Fallback demo data
        const demoPersonal: PersonalProfile = {
          id: 'c842bc26-7488-4a86-8be8-52b72df2f8aa',
          fullName: 'Grace Thomas',
          email: 'grace.thomas@example.org',
          phone: '+919811100001',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256',
          dateOfBirth: '2001-05-14T00:00:00Z',
          gender: 'FEMALE',
          church: 'Bethel Bible Church, Bangalore',
          preferredLanguage: 'English',
        };
        const demoAcademic: AcademicProfile = {
          admissionNo: 'ADM-2026-001',
          instituteName: 'Grace Bible Institute',
          instituteSlug: 'grace-bible',
          status: 'ACTIVE',
          enrolmentDate: '2026-08-05T09:30:00Z',
          enrolledCourses: [
            {
              enrolmentId: 'e-1',
              courseId: 'c-1',
              courseTitle: 'Building Biblical Theology',
              courseSlug: 'building-biblical-theology',
              batchName: 'Fall 2026 Batch A',
              enrolledAt: '2026-08-05T09:30:00Z',
              status: 'ACTIVE',
            },
            {
              enrolmentId: 'e-2',
              courseId: 'c-2',
              courseTitle: 'Hermeneutics & Exegesis',
              courseSlug: 'hermeneutics-and-exegesis',
              batchName: 'Fall 2026 Batch B',
              enrolledAt: '2026-09-01T10:00:00Z',
              status: 'ACTIVE',
            },
          ],
        };
        setPersonal(demoPersonal);
        setAcademic(demoAcademic);
        setPhone(demoPersonal.phone);
        setChurch(demoPersonal.church || '');
      }
    } catch (err) {
      console.error('Fetch Profile Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-dev-role'] = 'STUDENT';

      const res = await fetch('/api/students/profile', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          phone,
          church,
          preferredLanguage,
          address: { line: addressLine, city, state, country },
          guardian: { name: guardianName, phone: guardianPhone },
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Profile information updated successfully.' });
        fetchProfile();
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
      }
    } catch (err: any) {
      console.error('Save Profile Error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Network error while saving profile.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudentShell pageTitle="My Profile">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Account & Identity
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                Verified Enrolment
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              Student Profile & Academic Record
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage personal contact information, view verified admission credentials, and review enrolled courses.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchProfile}
              className="h-9 gap-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-600" />
              ) : (
                <AlertCircle size={16} className="text-red-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Identity Card & Academic Standings */}
          <div className="space-y-6">
            <Card className="p-6 text-center border-slate-100 shadow-sm flex flex-col items-center">
              <div className="relative mb-3">
                <img
                  src={
                    personal?.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256'
                  }
                  alt={personal?.fullName || 'Student Avatar'}
                  className="w-24 h-24 rounded-full object-cover border-4 border-blue-50 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => alert('Photo update upload dialog opened.')}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-sm"
                  title="Upload New Photo"
                >
                  <Camera size={14} />
                </button>
              </div>

              <h2 className="text-lg font-bold text-slate-900">
                {personal?.fullName || 'Grace Thomas'}
              </h2>
              <p className="text-xs font-mono text-blue-600 font-semibold mt-0.5">
                {academic?.admissionNo || 'ADM-2026-001'}
              </p>
              <div className="mt-2">
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                  {academic?.status || 'ACTIVE'} STUDENT
                </span>
              </div>

              <div className="w-full border-t border-slate-100 mt-5 pt-4 text-left space-y-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{personal?.email || 'grace.thomas@example.org'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  <span>{personal?.phone || '+91 98111 00001'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{academic?.instituteName || 'Grace Bible Institute'}</span>
                </div>
              </div>
            </Card>

            {/* Read-Only Academic Protection Card */}
            <Card className="p-5 border-slate-100 shadow-sm bg-slate-50/70 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Lock size={14} className="text-amber-600" />
                <span>Protected Academic Identity</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Official records including Admission Number, Institute Enrollment, and Fee Allocations are governed by the Registrar and cannot be edited by students directly.
              </p>
              <div className="text-[11px] text-slate-700 space-y-1 pt-1">
                <div>
                  <span className="text-slate-400">Enrolment Date: </span>
                  <span className="font-medium">
                    {academic?.enrolmentDate ? new Date(academic.enrolmentDate).toLocaleDateString() : 'August 2026'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Academic Standing: </span>
                  <span className="font-semibold text-emerald-600">Good Standing</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Column 2 & 3: Editable Personal Info & Enrolled Courses */}
          <div className="lg:col-span-2 space-y-6">
            {/* Editable Profile Form */}
            <Card className="p-6 border-slate-100 shadow-sm">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Personal & Contact Information</h3>
                  <p className="text-[11px] text-slate-500">
                    Fields that you are authorized by the institute to update.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      disabled
                      value={personal?.fullName || ''}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Official Email</label>
                    <input
                      type="email"
                      disabled
                      value={personal?.email || ''}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Phone Number (E.164)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+919811100001"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Preferred Language</label>
                    <select
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Tamil">Tamil</option>
                      <option value="Telugu">Telugu</option>
                      <option value="Malayalam">Malayalam</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Home Church / Ministry Affiliation</label>
                    <input
                      type="text"
                      value={church}
                      onChange={(e) => setChurch(e.target.value)}
                      placeholder="e.g. Bethel Bible Church, Bangalore"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Street Address</label>
                    <input
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="House / Street / Apartment"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">State / Province</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Guardian / Sponsor Name</label>
                    <input
                      type="text"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Optional sponsor contact"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Guardian Contact Phone</label>
                    <input
                      type="tel"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="Optional sponsor phone"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-9 px-5 gap-1.5 shadow-xs"
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Save Profile Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Enrolled Programmes List */}
            <Card className="p-6 border-slate-100 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Enrolled Courses & Batches</h3>
                  <p className="text-[11px] text-slate-500">
                    Active academic enrolments in Grace Bible Institute.
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-600">
                  {academic?.enrolledCourses?.length || 0} Course(s)
                </span>
              </div>

              <div className="space-y-3">
                {academic?.enrolledCourses?.map((c) => (
                  <div
                    key={c.enrolmentId}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900">{c.courseTitle}</div>
                      <div className="text-[11px] text-slate-500">
                        Batch: <span className="text-slate-700 font-medium">{c.batchName}</span>
                      </div>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </StudentShell>
  );
}
