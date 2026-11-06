'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Phone,
  Lock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Building2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

type RoleOption = 'STUDENT' | 'TEACHER' | 'ADMIN';

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleOption>('STUDENT');
  const [phone, setPhone] = useState('9642402639');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('123456');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick switch phone when role changes
  const handleRoleChange = (role: RoleOption) => {
    setSelectedRole(role);
    setErrorMessage(null);
    setOtpSent(false);
    if (role === 'STUDENT') {
      setPhone('9642402639');
    } else if (role === 'TEACHER') {
      setPhone('9876500011');
    } else if (role === 'ADMIN') {
      setPhone('9876543210');
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setOtpSent(true);
      setOtp('123456');
    }, 400);
  };

  const executeLoginRequest = async (targetPhone: string, targetRole: RoleOption, targetOtp: string) => {
    const payload = {
      phoneNumber: targetPhone,
      role: targetRole === 'ADMIN' ? 'INSTITUTE_ADMIN' : targetRole,
      otp: targetOtp || '123456',
    };

    let res = await fetch('/api/auth/phone-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!res || res.status === 404) {
      res = await fetch('/auth/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);
    }

    if (!res) {
      throw new Error('Network error contacting authentication service');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Login failed. Please check credentials.');
    }

    return data;
  };

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await executeLoginRequest(phone, selectedRole, otp);

      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('auth_token', data.accessToken);
        localStorage.setItem('current_user_role', data.user.role);
        localStorage.setItem('current_institute_id', data.user.instituteId || 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5');
        
        if (data.user.studentProfileId) {
          localStorage.setItem('current_student_profile_id', data.user.studentProfileId);
        }

        document.cookie = `auth_token=${data.accessToken}; path=/; max-age=2592000; SameSite=Lax`;
      }

      router.push(data.redirectUrl || (selectedRole === 'STUDENT' ? '/student' : selectedRole === 'TEACHER' ? '/teacher' : '/admin'));
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Unable to connect to authentication server');
    } finally {
      setIsLoading(false);
    }
  };

  // Direct 1-click test launcher
  const handleQuickLaunch = async (role: RoleOption, targetPhone: string) => {
    setSelectedRole(role);
    setPhone(targetPhone);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await executeLoginRequest(targetPhone, role, '123456');

      if (data && data.accessToken && typeof window !== 'undefined') {
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('auth_token', data.accessToken);
        localStorage.setItem('current_user_role', data.user.role);
        localStorage.setItem('current_institute_id', data.user.instituteId || 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5');
        if (data.user.studentProfileId) {
          localStorage.setItem('current_student_profile_id', data.user.studentProfileId);
        }
        document.cookie = `auth_token=${data.accessToken}; path=/; max-age=2592000; SameSite=Lax`;
        router.push(data.redirectUrl);
      } else {
        router.push(role === 'STUDENT' ? '/student' : role === 'TEACHER' ? '/teacher' : '/admin');
      }
    } catch {
      router.push(role === 'STUDENT' ? '/student' : role === 'TEACHER' ? '/teacher' : '/admin');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#090D1A] via-[#111827] to-[#1E1B4B] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-xl shadow-blue-500/20 mb-3 border border-blue-400/30">
            ✝
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Bible Institute LMS
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Sign in with your registered mobile number and role
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6">
          
          {/* 1. Role Selection Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Select Your Role
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              
              {/* Role: Student */}
              <button
                type="button"
                onClick={() => handleRoleChange('STUDENT')}
                className={`flex flex-col items-center p-3 rounded-2xl border-2 transition text-center ${
                  selectedRole === 'STUDENT'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 ${
                  selectedRole === 'STUDENT' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <UserCheck size={18} />
                </div>
                <span className="text-xs font-bold">Student</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Learner Portal</span>
              </button>

              {/* Role: Teacher */}
              <button
                type="button"
                onClick={() => handleRoleChange('TEACHER')}
                className={`flex flex-col items-center p-3 rounded-2xl border-2 transition text-center ${
                  selectedRole === 'TEACHER'
                    ? 'border-purple-600 bg-purple-50/70 text-purple-900 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 ${
                  selectedRole === 'TEACHER' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <GraduationCap size={18} />
                </div>
                <span className="text-xs font-bold">Teacher</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Faculty Portal</span>
              </button>

              {/* Role: Admin */}
              <button
                type="button"
                onClick={() => handleRoleChange('ADMIN')}
                className={`flex flex-col items-center p-3 rounded-2xl border-2 transition text-center ${
                  selectedRole === 'ADMIN'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 ${
                  selectedRole === 'ADMIN' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Building2 size={18} />
                </div>
                <span className="text-xs font-bold">Admin</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Institute Admin</span>
              </button>

            </div>
          </div>

          {/* Error Message banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 2. Mobile Number & Verification Form */}
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Mobile Phone Number
                  </label>
                  <span className="text-[11px] text-slate-400">Include country code</span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9642402639"
                    required
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                {/* Role-based suggestion pill */}
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Quick fill registered number:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRole === 'STUDENT') setPhone('9642402639');
                      else if (selectedRole === 'TEACHER') setPhone('9876500011');
                      else setPhone('9876543210');
                    }}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    {selectedRole === 'STUDENT'
                      ? 'Shaik Shafiulla (9642402639)'
                      : selectedRole === 'TEACHER'
                      ? 'Dr. John Mark (9876500011)'
                      : 'Samuel Admin (9876543210)'}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md shadow-blue-500/25"
                  isLoading={isLoading}
                >
                  <span>Send Verification Code</span>
                  <ArrowRight size={15} className="ml-1" />
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Enter 6-Digit Code</label>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-[11px] text-blue-600 font-semibold hover:underline"
                  >
                    Change number ({phone})
                  </button>
                </div>

                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  required
                  className="w-full px-4 py-2.5 text-center tracking-[0.5em] text-xl font-extrabold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                />

                <p className="text-[11px] text-slate-500 mt-2 text-center">
                  Verification code sent to <strong>+91 {phone}</strong>. (Test OTP: <strong className="text-blue-600 font-bold">123456</strong>)
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="flex-1 justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md shadow-blue-500/25"
                  isLoading={isLoading}
                >
                  <CheckCircle2 size={16} className="mr-1.5" />
                  <span>Verify & Enter {selectedRole === 'STUDENT' ? 'Student Portal' : selectedRole === 'TEACHER' ? 'Teacher Portal' : 'Admin Portal'}</span>
                </Button>
              </div>
            </form>
          )}

          {/* 3. Direct Role Demo Shortcuts */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mb-3">
              Direct Instant Role Access
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLaunch('STUDENT', '9642402639')}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition border border-blue-100"
              >
                <UserCheck size={14} />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLaunch('TEACHER', '9876500011')}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition border border-purple-100"
              >
                <GraduationCap size={14} />
                <span>Teacher</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLaunch('ADMIN', '9876543210')}
                className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition border border-emerald-100"
              >
                <Building2 size={14} />
                <span>Admin</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          Bible Institute Management Platform • Secure Multi-Tenant Access
        </p>
      </div>
    </div>
  );
}
