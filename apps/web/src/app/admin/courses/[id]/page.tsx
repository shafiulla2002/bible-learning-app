'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { courseApi, teacherApi, resolveVerifiedAdminContext } from '@/lib/api';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Plus,
  PlayCircle,
  FileText,
  Headphones,
  FileCode,
  Lock,
  Unlock,
  CheckCircle,
  Clock,
  Layers,
  Users,
  Settings,
  DollarSign,
  GraduationCap,
  Save,
  Trash2,
  Edit2,
  Eye,
  Download,
  AlertCircle,
  Share2,
  Sparkles,
} from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
  { label: 'Institute Settings', href: '/admin/settings', icon: <Settings size={18} /> },
];

interface ResourceItem {
  id: string;
  title: string;
  kind: 'PDF' | 'VIDEO' | 'AUDIO' | 'FILE';
  size: string;
  downloadable: boolean;
}

interface LessonItem {
  id: string;
  title: string;
  type: 'VIDEO' | 'PDF' | 'AUDIO' | 'TEXT' | 'QUIZ';
  durationMinutes: number;
  isPreview: boolean;
  isMandatory: boolean;
  body?: string;
  resources: ResourceItem[];
}

interface ChapterItem {
  id: string;
  title: string;
  lessons: LessonItem[];
}

interface ModuleItem {
  id: string;
  title: string;
  chapters: ChapterItem[];
}

export default function CourseCurriculumBuilderPage() {
  const params = useParams();
  const courseId = params?.id as string;

  const [instituteId, setInstituteId] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('Institute Admin');

  const [activeTab, setActiveTab] = useState<'curriculum' | 'settings' | 'pricing' | 'faculty' | 'enrolled'>('curriculum');
  const [courseStatus, setCourseStatus] = useState<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('PUBLISHED');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Course Metadata State (prices displayed in INR rupees in form, converted to/from paise for API)
  const [courseTitle, setCourseTitle] = useState('Course Curriculum');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [category, setCategory] = useState('Biblical Studies');
  const [level, setLevel] = useState('BEGINNER');
  const [courseType, setCourseType] = useState<'REGULAR' | 'BOOK' | 'SELF_PACED' | 'COHORT' | 'LIVE' | 'DIPLOMA' | 'CERTIFICATE'>('COHORT');
  const [learningMode, setLearningMode] = useState<'ONLINE' | 'OFFLINE' | 'HYBRID'>('ONLINE');
  const [durationLabel, setDurationLabel] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [language, setLanguage] = useState('English');
  const [price, setPrice] = useState('0');
  const [registrationFee, setRegistrationFee] = useState('0');
  const [pricingType, setPricingType] = useState<'FREE' | 'PAID'>('FREE');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [description, setDescription] = useState('');

  // Completion Rule state
  const [minProgressPct, setMinProgressPct] = useState(100);
  const [allMandatory, setAllMandatory] = useState(true);
  const [minExamPct, setMinExamPct] = useState(60);
  const [minAttendancePct, setMinAttendancePct] = useState(75);

  // Curriculum Hierarchy State (Course -> Modules -> Chapters -> Lessons -> Resources)
  const [modules, setModules] = useState<ModuleItem[]>([]);

  const showToastMessage = (msg: string) => {
    setSaveToast(msg);
    setActionError(null);
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Resolve admin context
  useEffect(() => {
    let active = true;
    resolveVerifiedAdminContext()
      .then((ctx) => {
        if (!active) return;
        if (ctx?.instituteId) setInstituteId(ctx.instituteId);
        else {
          setIsLoading(false);
          setActionError('Active institute session not found. Please log in again.');
        }
        if (ctx?.user?.fullName) setAdminName(ctx.user.fullName);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
        setActionError('Unable to verify administrator session.');
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch course, categories, instructors & enrolments from PostgreSQL
  const loadCourseFromDatabase = useCallback(async () => {
    if (!instituteId || !courseId) return;
    setIsLoading(true);
    try {
      const [data, cats, teachersRes, enrolmentsRes] = await Promise.all([
        courseApi.getCourse(instituteId, courseId),
        courseApi.getCategories(instituteId).catch(() => []),
        teacherApi.getTeachers(instituteId, { limit: 100 }).catch(() => ({ data: [] })),
        courseApi.getCourseEnrolments(instituteId, courseId).catch(() => []),
      ]);

      if (Array.isArray(cats)) {
        setCategories(cats);
      }
      if (Array.isArray(teachersRes?.data)) {
        setAvailableTeachers(
          teachersRes.data.map((t: any) => ({
            id: t.id,
            name: t.fullName || t.name || 'Instructor',
            email: t.email || '',
            spec: t.specialization || 'Faculty Member',
          })),
        );
      }
      if (Array.isArray(enrolmentsRes)) {
        setEnrolledStudents(
          enrolmentsRes.map((e: any) => ({
            id: e.id,
            name: e.studentName || 'Student',
            admissionNo: e.admissionNo || '',
            email: e.email || '—',
            phone: e.phoneNumber || '—',
            batchName: e.batchName || 'Unassigned',
            progress: e.progressPct ?? 0,
            status: e.status || 'ACTIVE',
            enrolledAt: e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString('en-IN') : '—',
          })),
        );
      }

      if (data) {
        setCourseTitle(data.title || 'Course Curriculum');
        setCategoryId(data.categoryId || '');
        setCategory(data.categoryName || data.category?.name || 'Biblical Studies');
        setLevel(data.level || 'BEGINNER');
        setCourseType((data.courseType as any) || 'COHORT');
        setLearningMode(data.learningMode || 'ONLINE');
        setDurationLabel(data.durationLabel || '');
        setEligibility(data.eligibility || '');
        setLanguage(data.language || 'English');
        setPrice(String(Math.round((data.price || 0) / 100)));
        setRegistrationFee(String(Math.round((data.registrationFee || 0) / 100)));
        setPricingType((data.pricing as 'FREE' | 'PAID') || (data.price && data.price > 0 ? 'PAID' : 'FREE'));
        setRequiresApproval(data.requiresApproval ?? true);
        setDescription(data.description || '');
        setCourseStatus(data.status as any);

        if (data.completionRule) {
          setMinProgressPct(data.completionRule.minProgressPct ?? 100);
          setAllMandatory(Boolean(data.completionRule.allMandatory));
          setMinExamPct(data.completionRule.minExamPct ?? 60);
          setMinAttendancePct(data.completionRule.minAttendancePct ?? 75);
        }

        setAssignedTeachers(
          Array.isArray(data.instructors)
            ? data.instructors.map((ins: any) => ({
                id: ins.teacherProfileId || ins.id,
                name: ins.teacherName || 'Instructor',
                role: (ins.role || 'LEAD') as 'LEAD' | 'ASSISTANT',
                email: ins.teacherEmail || '',
                spec: ins.role === 'LEAD' ? 'Lead Faculty' : 'Teaching Assistant',
              }))
            : [],
        );

        if (Array.isArray(data.modules)) {
          setModules(
            data.modules.map((m: any) => ({
              id: m.id,
              title: m.title,
              chapters: (m.chapters || []).map((ch: any) => ({
                id: ch.id,
                title: ch.title,
                lessons: (ch.lessons || []).map((l: any) => ({
                  id: l.id,
                  title: l.title,
                  type: l.type || 'VIDEO',
                  durationMinutes: l.durationSec ? Math.max(1, Math.round(l.durationSec / 60)) : (l.durationMinutes || 15),
                  isPreview: Boolean(l.isPreview),
                  isMandatory: Boolean(l.isMandatory),
                  body: l.body || '',
                  resources: (l.resources || []).map((r: any) => ({
                    id: r.id,
                    title: r.storageKey || r.title || 'Resource',
                    kind: r.kind || r.type || 'PDF',
                    size: r.sizeBytes ? `${Math.max(1, Math.round(Number(r.sizeBytes) / 1024))} KB` : '1 MB',
                    downloadable: Boolean(r.downloadable),
                  })),
                })),
              })),
            })),
          );
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to load course from database');
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, courseId]);

  useEffect(() => {
    loadCourseFromDatabase();
  }, [loadCourseFromDatabase]);

  // Modal States
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  const [showAddChapterModal, setShowAddChapterModal] = useState<string | null>(null); // moduleId
  const [newChapterTitle, setNewChapterTitle] = useState('');

  const [showAddLessonModal, setShowAddLessonModal] = useState<{ moduleId: string; chapterId: string } | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonType, setNewLessonType] = useState<'VIDEO' | 'PDF' | 'AUDIO' | 'TEXT' | 'QUIZ'>('VIDEO');
  const [newLessonDuration, setNewLessonDuration] = useState('30');
  const [newLessonPreview, setNewLessonPreview] = useState(false);
  const [newLessonBody, setNewLessonBody] = useState('');

  const [showAddResourceModal, setShowAddResourceModal] = useState<{
    moduleId: string;
    chapterId: string;
    lessonId: string;
  } | null>(null);
  const [newResourceTitle, setNewResourceTitle] = useState('');
  const [newResourceKind, setNewResourceKind] = useState<'PDF' | 'VIDEO' | 'AUDIO' | 'FILE'>('PDF');
  const [newResourceDownloadable, setNewResourceDownloadable] = useState(false);

  // Live Faculty & Enrolments state (Zero-Mock)
  const [assignedTeachers, setAssignedTeachers] = useState<
    Array<{ id: string; name: string; role: 'LEAD' | 'ASSISTANT'; email: string; spec: string }>
  >([]);
  const [availableTeachers, setAvailableTeachers] = useState<
    Array<{ id: string; name: string; email: string; spec: string }>
  >([]);
  const [selectedTeacherToAssign, setSelectedTeacherToAssign] = useState('');
  const [selectedTeacherRole, setSelectedTeacherRole] = useState<'LEAD' | 'ASSISTANT'>('LEAD');

  const [enrolledStudents, setEnrolledStudents] = useState<
    Array<{
      id: string;
      name: string;
      admissionNo: string;
      email: string;
      phone: string;
      batchName: string;
      progress: number;
      status: string;
      enrolledAt: string;
    }>
  >([]);

  // Handlers for Curriculum Management (all persisted to PostgreSQL)
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim() || !instituteId) return;

    try {
      await courseApi.createModule(instituteId, courseId, {
        title: newModuleTitle.trim(),
        position: modules.length,
      });
      await loadCourseFromDatabase();
      showToastMessage('Module created and saved.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create module');
    }

    setNewModuleTitle('');
    setShowAddModuleModal(false);
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!instituteId) return;
    try {
      await courseApi.deleteModule(instituteId, courseId, moduleId);
      await loadCourseFromDatabase();
      showToastMessage('Module deleted.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete module');
    }
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddChapterModal || !newChapterTitle.trim() || !instituteId) return;

    try {
      await courseApi.createChapter(instituteId, courseId, showAddChapterModal, {
        title: newChapterTitle.trim(),
      });
      await loadCourseFromDatabase();
      showToastMessage('Chapter added.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create chapter');
    }

    setNewChapterTitle('');
    setShowAddChapterModal(null);
  };

  const handleDeleteChapter = async (_moduleId: string, chapterId: string) => {
    if (!instituteId) return;
    try {
      await courseApi.deleteChapter(instituteId, courseId, chapterId);
      await loadCourseFromDatabase();
      showToastMessage('Chapter deleted.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete chapter');
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddLessonModal || !newLessonTitle.trim() || !instituteId) return;

    try {
      const minutes = parseInt(newLessonDuration, 10) || 15;
      await courseApi.createLesson(instituteId, courseId, showAddLessonModal.chapterId, {
        title: newLessonTitle.trim(),
        type: newLessonType,
        durationSec: minutes * 60,
        isPreview: newLessonPreview,
        isMandatory: true,
        body: newLessonBody.trim() || undefined,
      });
      await loadCourseFromDatabase();
      showToastMessage('Lesson added to chapter.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create lesson');
    }

    setNewLessonTitle('');
    setNewLessonBody('');
    setShowAddLessonModal(null);
  };

  const handleDeleteLesson = async (_moduleId: string, _chapterId: string, lessonId: string) => {
    if (!instituteId) return;
    try {
      await courseApi.deleteLesson(instituteId, courseId, lessonId);
      await loadCourseFromDatabase();
      showToastMessage('Lesson deleted.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete lesson');
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddResourceModal || !newResourceTitle.trim() || !instituteId) return;

    const mimeByKind: Record<string, string> = {
      PDF: 'application/pdf',
      VIDEO: 'video/mp4',
      AUDIO: 'audio/mpeg',
      FILE: 'application/octet-stream',
    };

    try {
      await courseApi.attachResource(instituteId, courseId, showAddResourceModal.lessonId, {
        kind: newResourceKind,
        storageKey: newResourceTitle.trim(),
        mimeType: mimeByKind[newResourceKind] || 'application/octet-stream',
        sizeBytes: '1048576',
        downloadable: newResourceDownloadable,
      });
      await loadCourseFromDatabase();
      showToastMessage('Resource attached and persisted.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to attach resource');
    }

    setNewResourceTitle('');
    setShowAddResourceModal(null);
  };

  const handleDeleteResource = async (
    _moduleId: string,
    _chapterId: string,
    _lessonId: string,
    resourceId: string,
  ) => {
    if (!instituteId) return;
    try {
      await courseApi.removeResource(instituteId, courseId, resourceId);
      await loadCourseFromDatabase();
      showToastMessage('Resource removed.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to remove resource');
    }
  };

  const handleToggleDownloadable = async (
    _moduleId: string,
    _chapterId: string,
    _lessonId: string,
    resourceId: string,
  ) => {
    if (!instituteId) return;
    let currentDownloadable = false;
    for (const mod of modules) {
      for (const ch of mod.chapters) {
        for (const les of ch.lessons) {
          const found = les.resources.find((r) => r.id === resourceId);
          if (found) currentDownloadable = found.downloadable;
        }
      }
    }
    try {
      await courseApi.updateResource(instituteId, courseId, resourceId, {
        downloadable: !currentDownloadable,
      });
      await loadCourseFromDatabase();
      showToastMessage(!currentDownloadable ? 'Offline download enabled.' : 'DRM protection enforced.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update DRM setting');
    }
  };

  const handleAssignFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !selectedTeacherToAssign) return;
    try {
      await courseApi.assignInstructor(instituteId, courseId, {
        teacherProfileId: selectedTeacherToAssign,
        role: selectedTeacherRole,
      });
      setSelectedTeacherToAssign('');
      await loadCourseFromDatabase();
      showToastMessage('Faculty member assigned to course.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to assign instructor');
    }
  };

  const handleRemoveFaculty = async (teacherProfileId: string) => {
    if (!instituteId) return;
    try {
      await courseApi.removeInstructor(instituteId, courseId, teacherProfileId);
      await loadCourseFromDatabase();
      showToastMessage('Instructor removed from course.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to remove instructor');
    }
  };

  const handleSave = async () => {
    if (!instituteId) return;
    try {
      const priceRupees = parseFloat(price) || 0;
      const regFeeRupees = parseFloat(registrationFee) || 0;
      await courseApi.updateCourse(instituteId, courseId, {
        title: courseTitle.trim(),
        categoryId: categoryId || undefined,
        description,
        pricing: pricingType,
        price: pricingType === 'PAID' ? Math.round(priceRupees * 100) : 0,
        registrationFee: Math.round(regFeeRupees * 100),
        courseType,
        learningMode,
        durationLabel: durationLabel.trim() || undefined,
        eligibility: eligibility.trim() || undefined,
        requiresApproval,
        level: level as any,
        language,
      });
      await courseApi.upsertCompletionRule(instituteId, courseId, {
        minProgressPct: Number(minProgressPct) || 100,
        allMandatory,
        minExamPct: Number(minExamPct) || 60,
        minAttendancePct: Number(minAttendancePct) || 75,
      });
      await loadCourseFromDatabase();
      showToastMessage('Curriculum, settings, pricing, and completion rules saved to PostgreSQL!');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update course in database');
    }
  };

  const handleUpdateStatus = async (newStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    if (!instituteId) return;
    try {
      await courseApi.updateStatus(instituteId, courseId, newStatus);
      setCourseStatus(newStatus);
      showToastMessage(`Course status updated to ${newStatus}.`);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update course status');
    }
  };

  const totalLessons = modules.reduce(
    (acc, m) => acc + m.chapters.reduce((cAcc, ch) => cAcc + ch.lessons.length, 0),
    0,
  );

  const totalDurationMin = modules.reduce(
    (acc, m) =>
      acc +
      m.chapters.reduce(
        (cAcc, ch) => cAcc + ch.lessons.reduce((lAcc, l) => lAcc + l.durationMinutes, 0),
        0,
      ),
    0,
  );

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName={adminName}
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-6">
        {/* Breadcrumbs & Navigation */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/admin/courses" className="hover:text-blue-600 flex items-center gap-1 font-medium">
            <ChevronLeft size={14} />
            Back to Courses Catalog
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold truncate">{courseTitle}</span>
        </div>

        {/* Studio Top Header */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{courseTitle}</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {category}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {level}
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  courseStatus === 'PUBLISHED'
                    ? 'bg-emerald-100 text-emerald-800 font-bold'
                    : 'bg-amber-100 text-amber-800 font-bold'
                }`}
              >
                {courseStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {modules.length} Modules • {totalLessons} Lessons • ~{Math.round(totalDurationMin / 60)} Study Hours • Assigned to{' '}
              {assignedTeachers[0]?.name || 'Unassigned'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handleUpdateStatus(courseStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')
              }
              className="text-xs"
            >
              {courseStatus === 'PUBLISHED' ? 'Unpublish to Draft' : 'Publish Course'}
            </Button>
            {courseStatus !== 'ARCHIVED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus('ARCHIVED')}
                className="text-xs text-slate-600"
              >
                Archive
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handleSave} className="gap-1.5 shadow-sm shadow-blue-500/20">
              <Save size={14} />
              Save Changes
            </Button>
          </div>
        </div>

        {actionError && (
          <div className="p-3 bg-red-50 text-red-800 border border-red-200 text-xs rounded-lg flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-red-700 font-bold">
              ✕
            </button>
          </div>
        )}

        {saveToast && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs rounded-lg flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600" />
              <span>{saveToast}</span>
            </div>
            <button onClick={() => setSaveToast(null)} className="text-emerald-700 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-px">
          {[
            { key: 'curriculum', label: 'Curriculum Builder', icon: <Layers size={14} /> },
            { key: 'settings', label: 'Course Settings', icon: <Settings size={14} /> },
            { key: 'pricing', label: 'Pricing & Enrolment', icon: <DollarSign size={14} /> },
            { key: 'faculty', label: 'Faculty & Teachers', icon: <GraduationCap size={14} /> },
            { key: 'enrolled', label: 'Enrolled Learners', icon: <Users size={14} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: CURRICULUM BUILDER */}
        {activeTab === 'curriculum' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Hierarchical Curriculum Tree</h3>
                <p className="text-xs text-slate-500">
                  Course → Modules → Chapters → Lessons → Downloadable Resources
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddModuleModal(true)}
                className="gap-1.5"
              >
                <Plus size={14} />
                Add Module
              </Button>
            </div>

            {/* Modules List */}
            <div className="space-y-4">
              {modules.map((module, mIdx) => (
                <div
                  key={module.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Module Header Bar */}
                  <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                        {mIdx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{module.title}</h4>
                      <span className="text-[11px] text-slate-400 font-medium">
                        ({module.chapters.length} Chapters)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddChapterModal(module.id)}
                        className="gap-1 text-xs py-1 h-7"
                      >
                        <Plus size={12} />
                        Add Chapter
                      </Button>
                      <button
                        onClick={() => handleDeleteModule(module.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded"
                        title="Delete Module"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Chapters within Module */}
                  <div className="p-4 space-y-4">
                    {module.chapters.map((chapter, cIdx) => (
                      <div
                        key={chapter.id}
                        className="rounded-lg border border-slate-200/90 bg-white overflow-hidden"
                      >
                        {/* Chapter Bar */}
                        <div className="p-3 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">
                              § {mIdx + 1}.{cIdx + 1}
                            </span>
                            <h5 className="text-xs font-bold text-slate-800">{chapter.title}</h5>
                            <span className="text-[10px] text-slate-400">
                              • {chapter.lessons.length} Lessons
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setShowAddLessonModal({ moduleId: module.id, chapterId: chapter.id })
                              }
                              className="gap-1 text-xs py-1 h-6 px-2"
                            >
                              <Plus size={11} />
                              Add Lesson
                            </Button>
                            <button
                              onClick={() => handleDeleteChapter(module.id, chapter.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded"
                              title="Delete Chapter"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Lessons List */}
                        <div className="divide-y divide-slate-100">
                          {chapter.lessons.map((lesson) => (
                            <div key={lesson.id} className="p-3 hover:bg-slate-50/60 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                  {/* Lesson Type Icon */}
                                  <div className="mt-0.5 text-blue-600">
                                    {lesson.type === 'VIDEO' && <PlayCircle size={16} />}
                                    {lesson.type === 'PDF' && <FileText size={16} />}
                                    {lesson.type === 'AUDIO' && <Headphones size={16} />}
                                    {lesson.type === 'TEXT' && <BookOpen size={16} />}
                                    {lesson.type === 'QUIZ' && <CheckCircle size={16} />}
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-slate-800">
                                        {lesson.title}
                                      </span>
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                        {lesson.type}
                                      </span>
                                      {lesson.isPreview && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                          FREE PREVIEW
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      {lesson.durationMinutes} mins • {lesson.body}
                                    </p>

                                    {/* Attached Resources */}
                                    {lesson.resources.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">
                                          Resources & Handouts:
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {lesson.resources.map((res) => (
                                            <div
                                              key={res.id}
                                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px]"
                                            >
                                              <FileText size={12} className="text-blue-500" />
                                              <span className="font-medium truncate max-w-[180px]">
                                                {res.title}
                                              </span>
                                              <span className="text-slate-400 text-[10px]">({res.size})</span>

                                              {/* Downloadable / DRM Lock indicator */}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleToggleDownloadable(
                                                    module.id,
                                                    chapter.id,
                                                    lesson.id,
                                                    res.id,
                                                  )
                                                }
                                                className={`p-0.5 rounded flex items-center gap-0.5 text-[10px] ${
                                                  res.downloadable
                                                    ? 'text-emerald-700 font-semibold'
                                                    : 'text-amber-700 font-semibold'
                                                }`}
                                                title={
                                                  res.downloadable
                                                    ? 'Download enabled for student'
                                                    : 'Protected: View/Stream Only (No download)'
                                                }
                                              >
                                                {res.downloadable ? (
                                                  <>
                                                    <Download size={11} />
                                                    <span>DL</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Lock size={11} />
                                                    <span>Protected</span>
                                                  </>
                                                )}
                                              </button>

                                              <button
                                                onClick={() =>
                                                  handleDeleteResource(
                                                    module.id,
                                                    chapter.id,
                                                    lesson.id,
                                                    res.id,
                                                  )
                                                }
                                                className="text-slate-400 hover:text-red-500 ml-1"
                                                title="Remove resource"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setShowAddResourceModal({
                                        moduleId: module.id,
                                        chapterId: chapter.id,
                                        lessonId: lesson.id,
                                      })
                                    }
                                    className="text-[11px] py-1 h-6 px-2 gap-1"
                                  >
                                    <Plus size={11} />
                                    Attach Resource
                                  </Button>
                                  <button
                                    onClick={() =>
                                      handleDeleteLesson(module.id, chapter.id, lesson.id)
                                    }
                                    className="text-slate-400 hover:text-red-600 p-1"
                                    title="Delete Lesson"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {chapter.lessons.length === 0 && (
                            <div className="p-3 text-center text-xs text-slate-400">
                              No lessons created in this chapter yet. Click "Add Lesson" to begin.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {module.chapters.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                        No chapters in this module. Click "Add Chapter" above.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: COURSE SETTINGS */}
        {activeTab === 'settings' && (
          <Card className="p-6 bg-white border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">Course Identity & Syllabus Metadata</h3>
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Title</label>
                <input
                  type="text"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      const found = categories.find((c) => c.id === e.target.value);
                      if (found) setCategory(found.name);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.length === 0 && <option value={categoryId}>{category}</option>}
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Course Format</label>
                  <select
                    value={courseType}
                    onChange={(e) => setCourseType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="COHORT">Cohort</option>
                    <option value="SELF_PACED">Self-Paced</option>
                    <option value="LIVE">Live Seminar</option>
                    <option value="DIPLOMA">Diploma</option>
                    <option value="CERTIFICATE">Certificate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Mode</label>
                  <select
                    value={learningMode}
                    onChange={(e) => setLearningMode(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="ONLINE">Online</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="OFFLINE">On-Campus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration</label>
                  <input
                    type="text"
                    placeholder="e.g. 12 Weeks"
                    value={durationLabel}
                    onChange={(e) => setDurationLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Eligibility & Prerequisites</label>
                <input
                  type="text"
                  placeholder="e.g. Open to all ministry candidates"
                  value={eligibility}
                  onChange={(e) => setEligibility(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Description & Overview</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Button variant="primary" size="sm" onClick={handleSave} className="gap-1.5 mt-2">
                <Save size={14} />
                Save Settings
              </Button>
            </div>
          </Card>
        )}

        {/* TAB 3: PRICING & ENROLMENT */}
        {activeTab === 'pricing' && (
          <Card className="p-6 bg-white border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">Pricing, Scholarships & Enrolment Access</h3>
            <div className="space-y-4 max-w-xl">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPricingType('PAID')}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                    pricingType === 'PAID'
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">Paid Tuition Course</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Enrolment requires tuition fee payment or approved scholarship.</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPricingType('FREE')}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                    pricingType === 'FREE'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">Free Open Ministry Course</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Any enrolled student may access lessons at no fee.</div>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pricingType === 'PAID' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Tuition Fee (₹ INR)</label>
                    <input
                      type="number"
                      min={0}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Fee (₹ INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={registrationFee}
                    onChange={(e) => setRegistrationFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Require Administrator Admission Approval before Activation
              </label>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-3">
                <div className="font-semibold text-slate-800">Completion Rule & Certificate Criteria</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Min Progress %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={minProgressPct}
                      onChange={(e) => setMinProgressPct(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Min Exam %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={minExamPct}
                      onChange={(e) => setMinExamPct(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Min Attendance %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={minAttendancePct}
                      onChange={(e) => setMinAttendancePct(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              </div>

              <Button variant="primary" size="sm" onClick={handleSave} className="gap-1.5 mt-2">
                <Save size={14} />
                Save Pricing Options
              </Button>
            </div>
          </Card>
        )}

        {/* TAB 4: FACULTY & TEACHERS */}
        {activeTab === 'faculty' && (
          <Card className="p-6 bg-white border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Assigned Instructors & Faculty</h3>
                <p className="text-xs text-slate-500">
                  Faculty members persisted in PostgreSQL to instruct, assess submissions, and lead classes.
                </p>
              </div>
              <form onSubmit={handleAssignFaculty} className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedTeacherToAssign}
                  onChange={(e) => setSelectedTeacherToAssign(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">Select faculty member...</option>
                  {availableTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.spec})
                    </option>
                  ))}
                </select>
                <select
                  value={selectedTeacherRole}
                  onChange={(e) => setSelectedTeacherRole(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                >
                  <option value="LEAD">Lead</option>
                  <option value="ASSISTANT">Assistant</option>
                </select>
                <Button type="submit" variant="primary" size="sm" disabled={!selectedTeacherToAssign}>
                  Assign
                </Button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      {teacher.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{teacher.name}</div>
                      <div className="text-[11px] text-slate-500">{teacher.email || '—'}</div>
                      <div className="text-[10px] text-blue-600 font-medium">{teacher.spec}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        teacher.role === 'LEAD'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {teacher.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFaculty(teacher.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Remove Instructor"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {assignedTeachers.length === 0 && (
                <p className="text-xs text-slate-400 col-span-2 py-6 text-center">
                  No instructors assigned to this course yet. Use the selector above to assign faculty.
                </p>
              )}
            </div>
          </Card>
        )}

        {/* TAB 5: ENROLLED LEARNERS */}
        {activeTab === 'enrolled' && (
          <Card className="p-6 bg-white border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Enrolled Students ({enrolledStudents.length})</h3>
                <p className="text-xs text-slate-500">Students registered and taking lessons in this course.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                    <th className="pb-2">Student Name</th>
                    <th className="pb-2">Contact</th>
                    <th className="pb-2">Enrolled Date</th>
                    <th className="pb-2">Progress</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrolledStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 font-bold text-slate-900">{st.name}</td>
                      <td className="py-2.5 text-slate-500">{st.phone}</td>
                      <td className="py-2.5 text-slate-500">{st.enrolledAt}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${st.progress}%` }} />
                          </div>
                          <span className="font-bold text-slate-700 text-[11px]">{st.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          {st.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ADD MODULE MODAL */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Add Course Module</h3>
            <form onSubmit={handleAddModule} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Module Title</label>
                <input
                  type="text"
                  required
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  placeholder="e.g. Module 3: Covenantal Hermeneutics"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModuleModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Add Module
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CHAPTER MODAL */}
      {showAddChapterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Add Chapter</h3>
            <form onSubmit={handleAddChapter} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chapter Title</label>
                <input
                  type="text"
                  required
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="e.g. Chapter 2: Historical Typology"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddChapterModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Add Chapter
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD LESSON MODAL */}
      {showAddLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Create Lesson</h3>
            <form onSubmit={handleAddLesson} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lesson Title</label>
                <input
                  type="text"
                  required
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="e.g. 1.3 Interpreting Prophetic Literature"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Content Format</label>
                  <select
                    value={newLessonType}
                    onChange={(e) => setNewLessonType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="VIDEO">Video Lecture</option>
                    <option value="PDF">PDF Reading Material</option>
                    <option value="AUDIO">Audio Commentary</option>
                    <option value="TEXT">Text Article & Notes</option>
                    <option value="QUIZ">Quiz / Assessment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={newLessonDuration}
                    onChange={(e) => setNewLessonDuration(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Summary / Body Notes</label>
                <textarea
                  rows={3}
                  value={newLessonBody}
                  onChange={(e) => setNewLessonBody(e.target.value)}
                  placeholder="Overview of theological concepts covered in this lesson..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLessonPreview}
                    onChange={(e) => setNewLessonPreview(e.target.checked)}
                  />
                  <span>Allow Free Preview (Students can view before purchase)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddLessonModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Add Lesson
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ATTACH RESOURCE MODAL */}
      {showAddResourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Attach Resource / Handout</h3>
            <form onSubmit={handleAddResource} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resource Title & File Name</label>
                <input
                  type="text"
                  required
                  value={newResourceTitle}
                  onChange={(e) => setNewResourceTitle(e.target.value)}
                  placeholder="e.g. Exegesis-Handout-Part1.pdf"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resource Type</label>
                <select
                  value={newResourceKind}
                  onChange={(e) => setNewResourceKind(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PDF">PDF Document</option>
                  <option value="AUDIO">Audio Track</option>
                  <option value="VIDEO">Supplementary Video</option>
                  <option value="FILE">General Attachment</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={newResourceDownloadable}
                    onChange={(e) => setNewResourceDownloadable(e.target.checked)}
                  />
                  <div>
                    <span className="font-semibold block text-slate-800">Allow Offline Download</span>
                    <span className="text-[11px] text-slate-500">
                      If unchecked, resource is strictly DRM-protected for in-platform viewing only (prevents unauthorized sharing).
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddResourceModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Attach Resource
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
