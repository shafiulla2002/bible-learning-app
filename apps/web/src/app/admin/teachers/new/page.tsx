'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { teacherApi } from '@/lib/api';
import {
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  CreditCard,
  Building2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  FileText,
  Save,
  RotateCcw,
  Camera,
  Upload,
  Lock,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <Building2 size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
];

export default function RegisterTeacherPage() {
  const router = useRouter();
  const [instituteId, setInstituteId] = useState<string>('fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5');

  // Form State
  const [fullName, setFullName] = useState('');
  const [phoneE164, setPhoneE164] = useState('+91');
  const [email, setEmail] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [specialization, setSpecialization] = useState('Systematic Theology');
  const [highestDegree, setHighestDegree] = useState('M.Div');
  const [experienceYears, setExperienceYears] = useState<number | ''>(5);
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'ACTIVE' | 'DRAFT'>('ACTIVE');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  // Address
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [postalCode, setPostalCode] = useState('');

  // Submission Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('current_institute_id') || 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
      setInstituteId(storedId);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    if (!fullName.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }

    if (!phoneE164.trim() || phoneE164.length < 8) {
      setErrorMsg('A valid E.164 phone number is required (e.g. +91 98765 43210).');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        fullName: fullName.trim(),
        phoneE164: phoneE164.trim(),
        specialization: specialization.trim() || undefined,
        highestDegree: highestDegree.trim() || undefined,
        status,
        bio: bio.trim() || undefined,
      };

      if (email.trim()) payload.email = email.trim();
      if (employeeCode.trim()) payload.employeeCode = employeeCode.trim();
      if (experienceYears !== '') payload.experienceYears = Number(experienceYears);
      if (joiningDate) payload.joiningDate = new Date(joiningDate).toISOString();
      if (photoUrl) payload.photoUrl = photoUrl;
      if (password.trim()) payload.password = password.trim();

      if (street.trim() || city.trim() || state.trim() || postalCode.trim()) {
        payload.address = {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          country: country.trim(),
          postalCode: postalCode.trim(),
        };
      }

      const res = await teacherApi.createTeacher(instituteId, payload);
      setSuccessMsg(`Faculty member "${res.fullName}" registered successfully! Redirecting...`);

      setTimeout(() => {
        router.push(`/admin/teachers/${res.id}`);
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register faculty member. Please verify the input.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Institute Administrator"
      userRoleLabel="Administrator"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button & Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin/teachers">
            <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                Milestone 2.6
              </span>
              <span className="text-xs text-muted-foreground font-mono">Faculty Onboarding</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-1">
              <GraduationCap className="text-primary h-6 w-6" />
              Register New Faculty Member
            </h1>
            <p className="text-xs text-muted-foreground">
              Add a theological educator, configure their academic profile, credentials, and teaching status.
            </p>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Faculty Photo Upload */}
          <Card className="border shadow-sm bg-card p-6">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Camera className="h-4 w-4 text-primary" />
              Faculty Profile Photograph
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center shrink-0 shadow-inner">
                {photoPreview || photoUrl ? (
                  <img src={photoPreview || photoUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-slate-400 font-bold text-xl">
                    {fullName ? fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'FAC'}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-2 w-full text-xs">
                <label className="font-medium text-slate-700 block">Upload Photo (JPG, PNG, WebP up to 5MB)</label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition">
                    <Upload size={14} />
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setPhotoPreview(reader.result as string);
                            setPhotoUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <span className="text-slate-400">or enter image URL:</span>
                  <input
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    value={photoUrl.startsWith('data:') ? '' : photoUrl}
                    onChange={(e) => {
                      setPhotoUrl(e.target.value);
                      setPhotoPreview(null);
                    }}
                    className="flex-1 min-w-[200px] px-3 py-1.5 border rounded-lg text-xs bg-background"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 1. Personal & Contact Information */}
          <Card className="border shadow-sm bg-card">
            <div className="px-6 py-4 border-b bg-muted/20">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                1. Personal & Contact Information
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Arthur W. Pink"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Phone Number (E.164) <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={phoneE164}
                  onChange={(e) => setPhoneE164(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Used for SMS session reminders & institute login account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. apink@seminary.edu"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Custom Employee Code (Optional)
                </label>
                <input
                  type="text"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="Leave empty for auto-generated (e.g. FAC-2026-0001)"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1">
                  Biographical Note / Pastoral Background
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief summary of ministry background, theological convictions, and academic research..."
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </Card>

          {/* 2. Academic & Professional Credentials */}
          <Card className="border shadow-sm bg-card">
            <div className="px-6 py-4 border-b bg-muted/20">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                2. Academic & Professional Credentials
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Theological Specialization
                </label>
                <select
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="Systematic Theology">Systematic Theology</option>
                  <option value="Biblical Hermeneutics & Exegesis">Biblical Hermeneutics & Exegesis</option>
                  <option value="Old Testament Studies & Hebrew">Old Testament Studies & Hebrew</option>
                  <option value="New Testament Studies & Greek">New Testament Studies & Greek</option>
                  <option value="Church History & Patristics">Church History & Patristics</option>
                  <option value="Pastoral Ministry & Homiletics">Pastoral Ministry & Homiletics</option>
                  <option value="Missions & Evangelism">Missions & Evangelism</option>
                  <option value="Christian Ethics & Apologetics">Christian Ethics & Apologetics</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Highest Degree / Qualification
                </label>
                <input
                  type="text"
                  value={highestDegree}
                  onChange={(e) => setHighestDegree(e.target.value)}
                  placeholder="e.g. Ph.D, Th.D, M.Th, M.Div, B.Th"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Years of Teaching / Ministry Experience
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 8"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Joining / Appointment Date
                </label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Faculty Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'DRAFT')}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="ACTIVE">ACTIVE (Ready for Course/Batch Assignment)</option>
                  <option value="DRAFT">DRAFT (Pending Credential Verification)</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Portal Account Credentials */}
          <Card className="border shadow-sm bg-card">
            <div className="px-6 py-4 border-b bg-muted/20">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Faculty Portal Account Credentials (Optional)
              </h2>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <p className="text-muted-foreground">
                Provide an initial password if this faculty member requires immediate login access to the Teacher Portal.
              </p>
              <div className="max-w-md">
                <label className="block font-medium text-foreground mb-1">Initial Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters (optional)"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </Card>

          {/* 3. Address Information */}
          <Card className="border shadow-sm bg-card">
            <div className="px-6 py-4 border-b bg-muted/20">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                3. Residential / Mailing Address
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. 124 Seminary Campus Road"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bangalore"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">State / Province</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Karnataka"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Postal Code</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 560025"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. India"
                  className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/admin/teachers">
              <Button type="button" variant="outline" size="sm">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Registering Faculty...' : 'Register Faculty Member'}
            </Button>
          </div>
        </form>
      </div>
    </PortalShell>
  );
}
