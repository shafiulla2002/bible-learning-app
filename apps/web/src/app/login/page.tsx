'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { apiFetchResponse } from '@/lib/api';
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

type RoleOption = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleOption>('STUDENT');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick switch phone when role changes
  const handleRoleChange = (role: RoleOption) => {
    setSelectedRole(role);
    setErrorMessage(null);
    setOtpSent(false);
    setChallengeToken(null);
    setOtp('');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await apiFetchResponse('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.challengeToken) {
        throw new Error(json?.message || 'Failed to send verification code');
      }
      setChallengeToken(json.challengeToken);
      setOtp(typeof json.devOtp === 'string' && json.devOtp ? json.devOtp : '123456');
      setOtpSent(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to request verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const executeLoginRequest = async (
    targetPhone: string,
    targetRole: RoleOption,
    targetOtp: string,
    existingChallengeToken?: string | null
  ) => {
    let resolvedChallengeToken = existingChallengeToken || null;
    let resolvedOtp = targetOtp?.trim() || '';

    if (!resolvedChallengeToken) {
      const challengeRes = await apiFetchResponse('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: targetPhone }),
      });
      const challengeData = await challengeRes.json().catch(() => ({}));
      if (!challengeRes.ok || !challengeData?.challengeToken) {
        throw new Error(challengeData?.message || 'Unable to start OTP verification');
      }
      resolvedChallengeToken = challengeData.challengeToken;
      if (!resolvedOtp && typeof challengeData.devOtp === 'string') {
        resolvedOtp = challengeData.devOtp;
      }
    }

    const payload = {
      phoneNumber: targetPhone,
      role: targetRole === 'ADMIN' ? 'INSTITUTE_ADMIN' : targetRole,
      otp: resolvedOtp,
      challengeToken: resolvedChallengeToken,
    };

    const res = await apiFetchResponse('/auth/phone-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.accessToken) {
      throw new Error(data?.message || data?.error || `Authentication failed (${res.status})`);
    }
    return data;
  };

  const persistAuthenticatedSession = (data: any) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('auth_token', data.accessToken);
    if (data.user?.role) {
      localStorage.setItem('current_user_role', data.user.role);
    }
    if (data.user?.instituteId) {
      localStorage.setItem('current_institute_id', data.user.instituteId);
    }
    if (data.user?.studentProfileId) {
      localStorage.setItem('current_student_profile_id', data.user.studentProfileId);
    }
  };

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await executeLoginRequest(phone, selectedRole, otp, challengeToken);
      persistAuthenticatedSession(data);

      const targetUrl =
        data.redirectUrl ||
        (selectedRole === 'STUDENT'
          ? '/student'
          : selectedRole === 'TEACHER'
            ? '/teacher'
            : selectedRole === 'SUPER_ADMIN'
              ? '/super-admin'
              : '/admin');
      if (typeof window !== 'undefined') {
        window.location.href = targetUrl;
      } else {
        router.push(targetUrl);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err?.message || 'Authentication failed. Please check your OTP and registered role.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLaunch = async (role: RoleOption, targetPhone: string) => {
    setSelectedRole(role);
    setPhone(targetPhone);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await executeLoginRequest(targetPhone, role, '');
      persistAuthenticatedSession(data);

      const targetUrl =
        data.redirectUrl ||
        (role === 'STUDENT'
          ? '/student'
          : role === 'TEACHER'
            ? '/teacher'
            : role === 'SUPER_ADMIN'
              ? '/super-admin'
              : '/admin');
      if (typeof window !== 'undefined') {
        window.location.href = targetUrl;
      } else {
        router.push(targetUrl);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to sign in with the selected account.');
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              
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

              {/* Role: Super Admin */}
              <button
                type="button"
                onClick={() => handleRoleChange('SUPER_ADMIN')}
                className={`flex flex-col items-center p-3 rounded-2xl border-2 transition text-center ${
                  selectedRole === 'SUPER_ADMIN'
                    ? 'border-amber-600 bg-amber-50/70 text-amber-900 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 ${
                  selectedRole === 'SUPER_ADMIN' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <ShieldCheck size={18} />
                </div>
                <span className="text-xs font-bold">Super Admin</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Platform Root</span>
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
                    placeholder="Enter registered 10-digit mobile number"
                    required
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
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
                  Enter the 6-digit verification code for <strong>+91 {phone}</strong>.
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
                  <span>Verify & Enter {selectedRole === 'STUDENT' ? 'Student Portal' : selectedRole === 'TEACHER' ? 'Teacher Portal' : selectedRole === 'SUPER_ADMIN' ? 'Super Admin Portal' : 'Admin Portal'}</span>
                </Button>
              </div>
            </form>
          )}

        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          Bible Institute Management Platform • Secure Multi-Tenant Access
        </p>
      </div>
    </div>
  );
}
