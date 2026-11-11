'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Award,
  BookOpen,
  Library,
  Users,
  Building,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Calendar,
  Shield,
  Save,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherAuth } from '@/lib/use-teacher-auth';
import { teacherMeApi } from '@/lib/api';

export default function TeacherProfilePage() {
  const { teacher, institute, stats, isLoading, error, refresh } = useTeacherAuth({
    requireAuth: true,
    redirectTo: '/login',
  });

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experienceYears, setExperienceYears] = useState<string>('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (teacher) {
      setFullName(teacher.fullName || '');
      setEmail(teacher.email || '');
      setQualifications(teacher.qualifications || '');
      setSpecialization(teacher.specialization || '');
      setExperienceYears(
        teacher.experienceYears !== null && teacher.experienceYears !== undefined
          ? String(teacher.experienceYears)
          : '',
      );
      setBio(teacher.bio || '');
    }
  }, [teacher]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await teacherMeApi.updateProfile({
        fullName: fullName.trim() || undefined,
        email: email.trim(),
        qualifications: qualifications.trim(),
        specialization: specialization.trim(),
        experienceYears: experienceYears ? Number(experienceYears) : undefined,
        bio: bio.trim(),
      });
      setSaveSuccess(true);
      await refresh();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save faculty profile updates.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <TeacherShell pageTitle="Faculty Profile">
        <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4" />
          <div className="h-44 bg-white border border-slate-200 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl" />
            ))}
          </div>
        </div>
      </TeacherShell>
    );
  }

  const teacherInitials = teacher?.fullName
    ? teacher.fullName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'FC';

  return (
    <TeacherShell pageTitle="Faculty Profile">
      <div className="max-w-5xl mx-auto space-y-6 pb-16">
        {/* Page Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Faculty Profile</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your academic credentials, teaching specializations, and institute contact details.
            </p>
          </div>

          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-700">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Profile Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-24 h-24 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-3xl shadow-md border-4 border-white shrink-0">
              {teacher?.photoUrl ? (
                <img
                  src={teacher.photoUrl}
                  alt={teacher.fullName}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                teacherInitials
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {teacher?.fullName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {teacher?.status || 'Active Faculty'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-500">
                {teacher?.employeeCode && (
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold border border-slate-200">
                    ID: {teacher.employeeCode}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Building size={14} className="text-slate-400" />
                  {institute?.name} ({institute?.code})
                </span>
                <span className="flex items-center gap-1">
                  <Shield size={14} className="text-slate-400" />
                  Verified Faculty Instructor
                </span>
              </div>

              <p className="text-xs text-slate-600 max-w-2xl pt-1">
                {teacher?.qualifications || 'Theological Educator & Biblical Studies Instructor'}
                {teacher?.specialization ? ` • Specialized in ${teacher.specialization}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Teaching Activity Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Library size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Assigned Batches</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">
                {stats?.assignedBatchesCount || 0}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Assigned Courses</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">
                {stats?.assignedCoursesCount || 0}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Active Students</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">
                {stats?.assignedStudentsCount || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Details & Credentials */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} /> Faculty profile saved to PostgreSQL successfully.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Academic & Faculty Info */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <GraduationCap size={18} className="text-indigo-600" />
                Academic & Teaching Credentials
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Faculty Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter faculty name"
                    className="w-full text-sm font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Faculty Qualifications
                  </label>
                  <input
                    type="text"
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder="e.g. M.Div / Th.M in Biblical Studies"
                    className="w-full text-sm font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Department / Specialization
                  </label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Systematic Theology & New Testament Exegesis"
                    className="w-full text-sm font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Teaching Experience (Years)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="Years"
                      className="w-full text-sm font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Faculty Status
                    </span>
                    <p className="text-sm font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      {teacher?.status || 'ACTIVE'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Faculty Bio
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short theological teaching biography..."
                    className="w-full text-sm font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Mail size={18} className="text-indigo-600" />
                Official Institute Contact
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="faculty@institute.edu"
                    className="w-full text-sm font-mono text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                  />
                </div>

                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Phone (E.164 Verified)
                  </span>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800">
                    <Phone size={16} className="text-slate-400 shrink-0" />
                    <span className="font-mono">{teacher?.phone || 'Not configured'}</span>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Affiliated Bible Institute
                  </span>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800">
                    <Building size={16} className="text-slate-400 shrink-0" />
                    <span>
                      {institute?.name} ({institute?.code})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-sm disabled:opacity-60"
            >
              <Save size={16} />
              {isSaving ? 'Saving Profile...' : 'Save Faculty Profile'}
            </button>
          </div>
        </form>
      </div>
    </TeacherShell>
  );
}
