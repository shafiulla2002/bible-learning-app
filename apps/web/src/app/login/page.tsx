'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Lock, ArrowRight, ShieldCheck, UserCheck, GraduationCap, Building2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<'OTP' | 'PASSWORD'>('OTP');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setOtpSent(true);
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // Default demo login routes to student portal
      router.push('/student');
    }, 800);
  };

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push('/admin');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-xl shadow-blue-500/20 mb-3">
            ✝
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bible Institute LMS</h1>
          <p className="text-xs text-slate-400 mt-1">
            Sign in with your verified phone number or credentials
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl border border-slate-100">
          {/* Method Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('OTP');
                setOtpSent(false);
              }}
              className={`py-2 rounded-lg transition ${
                authMethod === 'OTP' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Phone OTP
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('PASSWORD')}
              className={`py-2 rounded-lg transition ${
                authMethod === 'PASSWORD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Password Login
            </button>
          </div>

          {/* Phone OTP Form */}
          {authMethod === 'OTP' && (
            <div>
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Mobile Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        required
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <Button type="submit" variant="primary" size="md" className="w-full" isLoading={isLoading}>
                    Send Verification Code
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">Enter 6-Digit Code</label>
                      <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Change number
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      required
                      className="w-full px-3 py-2.5 text-center tracking-[0.5em] text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1 text-center">
                      (Development mode: use test code <strong>123456</strong>)
                    </p>
                  </div>

                  <Button type="submit" variant="primary" size="md" className="w-full" isLoading={isLoading}>
                    Verify & Enter Portal
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Password Login Form */}
          {authMethod === 'PASSWORD' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone Number or Email
                </label>
                <input
                  type="text"
                  defaultValue="admin@bible-institute.org"
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <a href="#" className="text-[11px] text-blue-600 hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    defaultValue="••••••••••••"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <Button type="submit" variant="primary" size="md" className="w-full" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          )}

          {/* Instant Portal Demos */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
              Direct Role Demo Portals
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/student')}
                className="text-xs justify-start gap-2"
              >
                <UserCheck size={14} className="text-blue-600" />
                Student
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/teacher')}
                className="text-xs justify-start gap-2"
              >
                <GraduationCap size={14} className="text-purple-600" />
                Teacher
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin')}
                className="text-xs justify-start gap-2"
              >
                <Building2 size={14} className="text-emerald-600" />
                Institute Admin
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/super-admin')}
                className="text-xs justify-start gap-2"
              >
                <ShieldCheck size={14} className="text-amber-600" />
                Super Admin
              </Button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400 mt-6">
          Need an account? New student admissions are reviewed by the institute administrator.
        </p>
      </div>
    </div>
  );
}
