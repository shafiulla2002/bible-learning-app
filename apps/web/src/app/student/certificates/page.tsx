'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Award,
  Download,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Search,
  RefreshCw,
  X,
  FileCheck,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

interface Certificate {
  id: string;
  certificateNo: string;
  courseTitle: string;
  courseSlug?: string;
  studentName: string;
  admissionNo: string;
  instituteName: string;
  issuedAt: string;
  verifyToken: string;
  verificationUrl: string;
  pdfUrl?: string | null;
  status: string;
  completionDate?: string;
}

export default function StudentCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-dev-role'] = 'STUDENT';

      const res = await fetch('/api/students/certificates', { headers });
      if (res.ok) {
        const data = await res.json();
        setCertificates(Array.isArray(data.certificates) ? data.certificates : []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.message || 'Unable to retrieve certificates from the server.');
        setCertificates([]);
      }
    } catch (err: any) {
      console.error('Fetch Certificates Error:', err);
      setErrorMessage(err.message || 'Connection error while contacting certificates service.');
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/verify/certificate/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const filtered = certificates.filter(
    (c) =>
      c.courseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.certificateNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <StudentShell pageTitle="Certificates">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Academic Credentials
              </span>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                <ShieldCheck size={11} /> Cryptographically Verified
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              Certificates & Diplomas
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Official verifiable completion certificates issued upon meeting academic attendance, exam pass marks, and curriculum requirements.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCertificates}
              className="h-9 gap-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Error State Banner */}
        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCertificates}
              className="h-7 text-[11px] text-red-700 border-red-200 hover:bg-red-100"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search certificate number or course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loading || certificates.length === 0}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Loading Skeleton State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden border border-slate-200 shadow-xs animate-pulse">
                <div className="bg-slate-200 h-28 w-full" />
                <div className="p-5 space-y-3 bg-white">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                  <div className="h-8 bg-slate-100 rounded mt-4" />
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty State */
          <Card className="p-12 text-center border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Award size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {searchQuery ? 'No Matching Certificates' : 'No Certificates Issued Yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery
                ? `No certificates matched "${searchQuery}". Clear your search query to see all issued credentials.`
                : 'Certificates are automatically awarded by the Academic Coordinator upon achieving 100% curriculum completion and passing required course examinations.'}
            </p>
          </Card>
        ) : (
          /* Certificate Gallery */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((cert) => (
              <Card
                key={cert.id}
                className="overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between"
              >
                {/* Certificate Ribbon Header */}
                <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-5 text-white relative">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                      <Award size={22} className="text-amber-300" />
                    </div>
                    <span className="bg-white/15 backdrop-blur-xs text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 uppercase tracking-wider text-blue-100">
                      {cert.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold mt-3 leading-snug line-clamp-2">
                    {cert.courseTitle}
                  </h3>
                  <p className="text-[11px] text-blue-100 mt-0.5">
                    {cert.instituteName}
                  </p>
                </div>

                {/* Body Details */}
                <div className="p-5 space-y-3.5 bg-white text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-400">Awarded To:</span>
                    <span className="font-semibold text-slate-900">{cert.studentName}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-400">Certificate No:</span>
                    <span className="font-mono font-bold text-blue-600">{cert.certificateNo}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-400">Issued Date:</span>
                    <span className="font-medium text-slate-800">
                      {new Date(cert.issuedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Verification Token Banner */}
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-[11px]">
                    <div className="truncate pr-2">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Public Token</span>
                      <span className="font-mono text-slate-700 font-medium truncate block">
                        {cert.verifyToken}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyLink(cert.verifyToken)}
                      title="Copy Public Verification Link"
                      className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors shrink-0"
                    >
                      {copiedToken === cert.verifyToken ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCert(cert)}
                    className="flex-1 text-xs h-9 text-slate-700 hover:text-slate-900 font-semibold"
                  >
                    View Document
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      alert(`Downloading certificate ${cert.certificateNo} PDF...`);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 font-semibold gap-1.5 shadow-xs"
                  >
                    <Download size={13} />
                    Download PDF
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Certificate Preview Modal */}
        {selectedCert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in-50 zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Award size={20} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Certificate of Completion</h3>
                </div>
                <button
                  onClick={() => setSelectedCert(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Ornate Certificate Preview Frame */}
              <div className="border-4 border-double border-amber-600/40 p-8 rounded-xl bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 text-center space-y-4 shadow-inner relative">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white mx-auto flex items-center justify-center shadow-md">
                  <Award size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-serif font-bold text-slate-900 tracking-wide uppercase">
                    {selectedCert.instituteName}
                  </h4>
                  <p className="text-[11px] font-serif text-slate-500 uppercase tracking-widest">
                    Hereby certifies that
                  </p>
                </div>

                <div className="text-2xl font-serif font-bold text-blue-700 border-b border-slate-200 pb-2 inline-block px-6">
                  {selectedCert.studentName}
                </div>

                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  has satisfactorily completed all theological coursework, practical assignments, and examinations for
                </p>

                <div className="text-lg font-bold text-slate-900">
                  {selectedCert.courseTitle}
                </div>

                <div className="flex justify-between items-end pt-6 text-xs text-slate-500 border-t border-slate-200">
                  <div className="text-left">
                    <div className="font-semibold text-slate-800">Academic Dean</div>
                    <div className="text-[10px] text-slate-400">Authorized Signatory</div>
                  </div>
                  <div className="text-center font-mono text-[10px] text-slate-400">
                    No: {selectedCert.certificateNo}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-800">
                      {new Date(selectedCert.issuedAt).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] text-slate-400">Date of Convocations</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedCert(null)}
                  className="text-xs h-10 px-5"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    alert(`Downloading certificate PDF: ${selectedCert.certificateNo}`);
                    setSelectedCert(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-10 px-6 font-semibold gap-1.5 shadow-sm"
                >
                  <Download size={14} /> Download Official PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
