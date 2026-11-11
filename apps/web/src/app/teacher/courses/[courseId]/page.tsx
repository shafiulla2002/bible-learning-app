'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  BookOpen,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Video,
  FileText,
  Music,
  HelpCircle,
  FileCheck,
  Download,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  Users,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  FilePlus,
  X,
  Library,
  GraduationCap,
  ExternalLink,
  PlayCircle,
  Eye,
  Calendar,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { apiFetchResponse, resolveApiUrl } from '@/lib/api';
import {
  useTeacherCourseDetail,
  ModuleItem,
  ChapterItem,
  LessonItem,
  LessonResourceItem,
  CourseLiveSessionItem,
} from '@/lib/use-teacher-course-detail';
import { MediaPlayerModal } from '@/components/shared/MediaPlayerModal';

export default function TeacherCourseCurriculumPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;

  const { course, isLoading, error, refresh } = useTeacherCourseDetail(courseId);

  // Expanded state for modules & chapters
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  // Active selected lesson for inspection pane
  const [selectedLesson, setSelectedLesson] = useState<LessonItem | null>(null);

  // Upload Resource Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [targetLessonId, setTargetLessonId] = useState<string>('');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    storageKey: '',
    kind: 'PDF',
    mimeType: 'application/pdf',
    sizeBytes: 1048576, // 1MB default
    downloadable: true,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Media / Recorded Class Video Modal state
  const [activeVideoResource, setActiveVideoResource] = useState<LessonResourceItem | null>(null);
  const [activeRecordedSession, setActiveRecordedSession] = useState<CourseLiveSessionItem | null>(null);

  // Auto-expand first module/chapter and keep selectedLesson synced on refresh
  React.useEffect(() => {
    if (course && course.modules.length > 0) {
      const firstMod = course.modules[0];
      setExpandedModules((prev) => ({ ...prev, [firstMod.id]: true }));
      if (firstMod.chapters.length > 0) {
        const firstChap = firstMod.chapters[0];
        setExpandedChapters((prev) => ({ ...prev, [firstChap.id]: true }));
        if (selectedLesson) {
          for (const mod of course.modules) {
            for (const chap of mod.chapters) {
              const updated = chap.lessons.find((l) => l.id === selectedLesson.id);
              if (updated) {
                setSelectedLesson(updated);
                return;
              }
            }
          }
        } else if (firstChap.lessons.length > 0) {
          setSelectedLesson(firstChap.lessons[0]);
        }
      }
    }
  }, [course]);

  const toggleModule = (modId: string) => {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const toggleChapter = (chapId: string) => {
    setExpandedChapters((prev) => ({ ...prev, [chapId]: !prev[chapId] }));
  };

  const formatFileSize = (bytesStr: string) => {
    const bytes = parseInt(bytesStr, 10) || 0;
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getLessonTypeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'VIDEO':
        return <Video size={16} className="text-blue-500" />;
      case 'PDF':
        return <FileText size={16} className="text-rose-500" />;
      case 'AUDIO':
        return <Music size={16} className="text-purple-500" />;
      case 'QUIZ':
        return <HelpCircle size={16} className="text-amber-500" />;
      default:
        return <FileCheck size={16} className="text-slate-500" />;
    }
  };

  const handleOpenUploadModal = (lessonId: string) => {
    setTargetLessonId(lessonId);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadForm({
      title: '',
      storageKey: `courses/${courseId}/materials/${Date.now()}-resource.pdf`,
      kind: 'PDF',
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
      downloadable: true,
    });
    setUploadModalOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.storageKey.trim()) {
      setUploadError('Storage key or file path is required');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await apiFetchResponse('/teachers/materials', {
        method: 'POST',
        body: JSON.stringify({
          courseId,
          lessonId: targetLessonId,
          kind: uploadForm.kind,
          storageKey: uploadForm.storageKey.trim(),
          mimeType: uploadForm.mimeType,
          sizeBytes: uploadForm.sizeBytes,
          downloadable: uploadForm.downloadable,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload study material');
      }

      setUploadSuccess('Study material successfully attached to syllabus!');
      setTimeout(() => {
        setUploadModalOpen(false);
        refresh();
      }, 1200);
    } catch (err: any) {
      setUploadError(err?.message || 'Error uploading material');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <TeacherShell pageTitle={course ? `${course.title} - Curriculum` : 'Curriculum Viewer'}>
      <div className="space-y-6">

        {/* 1. Navigation & Breadcrumb Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/teacher/courses"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft size={16} />
            Back to Assigned Courses
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={resolveApiUrl(`/teachers/courses/${courseId}/syllabus`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs transition"
            >
              <Download size={14} />
              Download Syllabus PDF
            </a>

            <Link
              href={`/teacher/materials?courseId=${courseId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <FileText size={14} className="text-blue-600" />
              Browse Study Materials
            </Link>

            <button
              onClick={() => refresh()}
              title="Refresh syllabus"
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>

        {/* 2. Loading State */}
        {isLoading && !course ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-4 animate-pulse">
            <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
            <div className="h-4 bg-slate-100 rounded w-1/2" />
            <div className="grid grid-cols-4 gap-4 pt-4">
              <div className="h-20 bg-slate-100 rounded-xl" />
              <div className="h-20 bg-slate-100 rounded-xl" />
              <div className="h-20 bg-slate-100 rounded-xl" />
              <div className="h-20 bg-slate-100 rounded-xl" />
            </div>
          </div>
        ) : error || !course ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 flex flex-col items-center justify-center space-y-3">
            <AlertCircle size={32} className="text-rose-600" />
            <p className="text-base font-bold">{error || 'Course not found or access denied'}</p>
            <Link
              href="/teacher/courses"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition"
            >
              Return to Courses
            </Link>
          </div>
        ) : (
          <>
            {/* 3. Course Hero Header Banner */}
            <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-md">
                      {course.level || 'General'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
                      {course.category}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                      {course.status}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/20">
                      Role: {course.role}
                    </span>
                  </div>

                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                    {course.title}
                  </h1>

                  <p className="text-slate-300 text-sm leading-relaxed">
                    {course.description || 'Full curriculum syllabus, lesson breakdown, and learning resources repository.'}
                  </p>

                  {/* Assigned Batches Pills */}
                  {course.assignedBatches.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 text-xs text-slate-300">
                      <Library size={14} className="text-indigo-400" />
                      <span>Assigned Cohorts:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {course.assignedBatches.map((b) => (
                          <span
                            key={b.id}
                            className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium text-[11px]"
                          >
                            {b.name} ({b.studentCount} students)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md text-center">
                    <div className="text-xs text-slate-400 font-medium">Modules</div>
                    <div className="text-2xl font-black text-white">{course.summary.moduleCount}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md text-center">
                    <div className="text-xs text-slate-400 font-medium">Chapters</div>
                    <div className="text-2xl font-black text-white">{course.summary.chapterCount}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md text-center">
                    <div className="text-xs text-slate-400 font-medium">Lessons</div>
                    <div className="text-2xl font-black text-white">{course.summary.lessonCount}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md text-center">
                    <div className="text-xs text-slate-400 font-medium">Resources</div>
                    <div className="text-2xl font-black text-white">{course.summary.resourceCount}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Curriculum Hierarchy & Lesson Inspector Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

              {/* Left Column: Modules & Chapters Tree (8 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers size={18} className="text-blue-600" />
                    Curriculum Hierarchy
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">
                    {course.modules.length} Modules / {course.summary.lessonCount} Lessons
                  </span>
                </div>

                {course.modules.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500 space-y-2">
                    <BookOpen size={28} className="mx-auto text-slate-400" />
                    <p className="text-sm font-semibold">No modules configured yet</p>
                    <p className="text-xs text-slate-400">
                      The course curriculum structure has not yet been populated by the academic administrator.
                    </p>
                  </div>
                ) : (
                  course.modules.map((mod, modIdx) => {
                    const isModExpanded = expandedModules[mod.id] ?? false;
                    return (
                      <div
                        key={mod.id}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                      >
                        {/* Module Accordion Header */}
                        <button
                          onClick={() => toggleModule(mod.id)}
                          className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {modIdx + 1}
                            </span>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">{mod.title}</h3>
                              <span className="text-xs text-slate-500">
                                {mod.chapters.length} Chapters • {mod.chapters.reduce((a, c) => a + c.lessons.length, 0)} Lessons
                              </span>
                            </div>
                          </div>

                          <div className="text-slate-400">
                            {isModExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </div>
                        </button>

                        {/* Chapters Container */}
                        {isModExpanded && (
                          <div className="p-4 space-y-3 bg-white border-t border-slate-100">
                            {mod.chapters.length === 0 ? (
                              <p className="text-xs text-slate-400 italic px-2">No chapters inside this module.</p>
                            ) : (
                              mod.chapters.map((chap, chapIdx) => {
                                const isChapExpanded = expandedChapters[chap.id] ?? false;
                                return (
                                  <div
                                    key={chap.id}
                                    className="rounded-xl border border-slate-200/80 overflow-hidden"
                                  >
                                    {/* Chapter Accordion Header */}
                                    <button
                                      onClick={() => toggleChapter(chap.id)}
                                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/60 transition text-left"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-indigo-600">
                                          {modIdx + 1}.{chapIdx + 1}
                                        </span>
                                        <h4 className="text-xs font-bold text-slate-800">{chap.title}</h4>
                                        <span className="text-[11px] text-slate-400 font-medium">
                                          ({chap.lessons.length} lessons)
                                        </span>
                                      </div>
                                      <div className="text-slate-400">
                                        {isChapExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                      </div>
                                    </button>

                                    {/* Lessons List */}
                                    {isChapExpanded && (
                                      <div className="divide-y divide-slate-100 bg-white">
                                        {chap.lessons.length === 0 ? (
                                          <p className="text-xs text-slate-400 italic p-3">No lessons in this chapter.</p>
                                        ) : (
                                          chap.lessons.map((lesson) => {
                                            const isSelected = selectedLesson?.id === lesson.id;
                                            return (
                                              <div
                                                key={lesson.id}
                                                onClick={() => setSelectedLesson(lesson)}
                                                className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                                                  isSelected
                                                    ? 'bg-blue-50/70 border-l-4 border-blue-600 text-blue-950'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                              >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                  <div className="p-1.5 rounded-lg bg-slate-100 shrink-0">
                                                    {getLessonTypeIcon(lesson.type)}
                                                  </div>
                                                  <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <span className="text-xs font-semibold truncate">{lesson.title}</span>
                                                      {lesson.isPreview && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                                          Preview
                                                        </span>
                                                      )}
                                                      {lesson.isMandatory && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                                          Required
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                                                      <span>Type: {lesson.type}</span>
                                                      {lesson.durationSec > 0 && (
                                                        <span>• {Math.round(lesson.durationSec / 60)} min</span>
                                                      )}
                                                      <span>• {lesson.resources.length} materials</span>
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleOpenUploadModal(lesson.id);
                                                    }}
                                                    title="Attach study material"
                                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                                                  >
                                                    <Plus size={13} />
                                                  </button>
                                                  <ChevronRight size={14} className="text-slate-400" />
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Recorded Class Videos & Live Sessions */}
                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Video size={18} className="text-indigo-600" />
                      Recorded Class Videos & Live Sessions
                    </h2>
                    <span className="text-xs text-slate-500 font-medium">
                      {course.liveSessions?.length || 0} Sessions
                    </span>
                  </div>

                  {!course.liveSessions || course.liveSessions.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-500 space-y-2">
                      <Video size={24} className="mx-auto text-slate-400" />
                      <p className="text-xs font-semibold text-slate-700">No live or recorded class sessions for this course yet.</p>
                      <Link
                        href="/teacher/live-classes"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Go to Live Classes
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                      {course.liveSessions.map((ls) => {
                        const hasRec = Boolean(ls.recordingUrl);
                        return (
                          <div
                            key={ls.id}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {ls.title}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 whitespace-nowrap ${
                                    hasRec
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {hasRec ? 'Recording Ready' : 'No Recording URL'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar size={11} />
                                  {new Date(ls.startsAt).toLocaleDateString()}
                                </span>
                                <span>• {ls.batchName}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setActiveRecordedSession(ls)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                                  hasRec
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <PlayCircle size={13} />
                                <span>{hasRec ? 'Watch Recording' : 'Attach Recording'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Selected Lesson Inspector Pane (5 cols) */}
              <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText size={18} className="text-indigo-600" />
                    Lesson Inspector
                  </h2>
                  {selectedLesson && (
                    <button
                      onClick={() => handleOpenUploadModal(selectedLesson.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
                    >
                      <Plus size={13} />
                      Attach Material
                    </button>
                  )}
                </div>

                {selectedLesson ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
                    {/* Lesson Header */}
                    <div className="space-y-2 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-blue-50">
                          {getLessonTypeIcon(selectedLesson.type)}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                          {selectedLesson.type} Lesson
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{selectedLesson.title}</h3>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={12} />
                          {selectedLesson.durationSec > 0
                            ? `${Math.round(selectedLesson.durationSec / 60)} minutes`
                            : 'Self-paced'}
                        </span>
                        {selectedLesson.isPreview && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Public Preview
                          </span>
                        )}
                        {selectedLesson.isMandatory && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Mandatory Completion
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lesson Body/Notes */}
                    {selectedLesson.body && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lesson Notes & Summary</h4>
                        <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed max-h-40 overflow-y-auto">
                          {selectedLesson.body}
                        </div>
                      </div>
                    )}

                    {/* Attached Resources */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Attached Study Resources ({selectedLesson.resources.length})
                        </h4>
                      </div>

                      {selectedLesson.resources.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-xl text-center space-y-2 border border-dashed border-slate-200">
                          <FileText size={20} className="mx-auto text-slate-400" />
                          <p className="text-xs text-slate-500">No materials attached to this lesson yet.</p>
                          <button
                            onClick={() => handleOpenUploadModal(selectedLesson.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <Plus size={12} />
                            Upload first resource
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedLesson.resources.map((res) => {
                            const fileName = res.storageKey.split('/').pop() || res.storageKey;
                            const isVideo = res.kind?.toUpperCase() === 'VIDEO';
                            const isPdf =
                              res.kind?.toUpperCase() === 'PDF' ||
                              res.mimeType?.toLowerCase().includes('pdf');
                            const contentUrl = resolveApiUrl(`/teachers/materials/${res.id}/content`);
                            return (
                              <div
                                key={res.id}
                                className="p-3 rounded-xl border border-slate-200/90 hover:border-slate-300 transition-all space-y-2.5 bg-slate-50/50 overflow-hidden"
                              >
                                <div className="flex items-start justify-between gap-2.5 min-w-0">
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 shrink-0">
                                      {isVideo ? (
                                        <Video size={16} className="text-blue-600" />
                                      ) : (
                                        <FileText size={16} className="text-indigo-600" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold text-slate-900 truncate" title={fileName}>
                                        {fileName}
                                      </div>
                                      <div className="text-[11px] text-slate-500 truncate">
                                        {formatFileSize(res.sizeBytes)} • {res.kind}
                                      </div>
                                    </div>
                                  </div>

                                  {/* DRM & Download Badge */}
                                  {res.downloadable ? (
                                    <span
                                      title="Students may download this file"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 whitespace-nowrap"
                                    >
                                      <Download size={10} />
                                      Downloadable
                                    </span>
                                  ) : (
                                    <span
                                      title="DRM protected streaming view only"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0 whitespace-nowrap"
                                    >
                                      <Lock size={10} />
                                      Stream Only
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="shrink-0">Added {new Date(res.createdAt).toLocaleDateString()}</span>
                                    <span className="font-mono text-[10px] text-slate-500 truncate hidden sm:inline">
                                      {res.mimeType}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isVideo ? (
                                      <button
                                        type="button"
                                        onClick={() => setActiveVideoResource(res)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-[11px] font-semibold transition"
                                      >
                                        <PlayCircle size={12} />
                                        <span>Stream Video</span>
                                      </button>
                                    ) : (
                                      <>
                                        {isPdf && (
                                          <a
                                            href={`${contentUrl}?inline=1`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-semibold transition"
                                          >
                                            <Eye size={12} />
                                            <span>View</span>
                                          </a>
                                        )}
                                        {res.downloadable && (
                                          <a
                                            href={`${contentUrl}?download=1`}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition"
                                          >
                                            <Download size={12} />
                                            <span>Download PDF</span>
                                          </a>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 space-y-2">
                    <Sparkles size={28} className="mx-auto text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">Select a Lesson</p>
                    <p className="text-xs text-slate-400">
                      Click any lesson from the curriculum hierarchy on the left to inspect its details, view resources, or attach study materials.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </>
        )}

        {/* 5. Upload Study Material Modal */}
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <FilePlus size={18} className="text-blue-600" />
                  Attach Study Material
                </div>
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {uploadError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 font-medium flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  {uploadSuccess}
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Resource / File Storage Key
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadForm.storageKey}
                    onChange={(e) => setUploadForm({ ...uploadForm, storageKey: e.target.value })}
                    placeholder="e.g. materials/theology-unit1-notes.pdf"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Unique storage path or CDN asset reference.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Material Kind
                    </label>
                    <select
                      value={uploadForm.kind}
                      onChange={(e) => {
                        const k = e.target.value;
                        let mime = 'application/octet-stream';
                        if (k === 'PDF') mime = 'application/pdf';
                        if (k === 'VIDEO') mime = 'video/mp4';
                        if (k === 'AUDIO') mime = 'audio/mpeg';
                        if (k === 'IMAGE') mime = 'image/png';
                        setUploadForm({ ...uploadForm, kind: k, mimeType: mime });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    >
                      <option value="PDF">PDF Document</option>
                      <option value="VIDEO">Video Asset</option>
                      <option value="AUDIO">Audio Recording</option>
                      <option value="IMAGE">Image / Graphic</option>
                      <option value="FILE">General File</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      MIME Type
                    </label>
                    <input
                      type="text"
                      value={uploadForm.mimeType}
                      onChange={(e) => setUploadForm({ ...uploadForm, mimeType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="downloadable-toggle"
                    checked={uploadForm.downloadable}
                    onChange={(e) => setUploadForm({ ...uploadForm, downloadable: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="downloadable-toggle" className="text-xs text-slate-700 font-medium cursor-pointer">
                    Allow Student File Download (Uncheck to enforce streaming DRM)
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isUploading ? 'Attaching...' : 'Attach to Lesson'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 6. Lesson Video Stream Player Modal */}
        <MediaPlayerModal
          open={Boolean(activeVideoResource)}
          onClose={() => setActiveVideoResource(null)}
          title={
            activeVideoResource
              ? activeVideoResource.storageKey.split('/').pop() || 'Lesson Video'
              : 'Lesson Video'
          }
          subtitle={
            selectedLesson && course
              ? `${course.title} • ${selectedLesson.title}`
              : course?.title
          }
          sourceUrlOrKey={
            activeVideoResource?.videoStreamId || activeVideoResource?.storageKey
          }
          lessonNotes={selectedLesson?.body}
          downloadable={Boolean(activeVideoResource?.downloadable)}
          canAttachUrl={true}
          downloadHref={
            activeVideoResource?.downloadable
              ? resolveApiUrl(`/teachers/materials/${activeVideoResource.id}/content?download=1`)
              : null
          }
          onSaveVideoUrl={async (newUrl) => {
            if (!activeVideoResource) return;
            const res = await apiFetchResponse(
              `/teachers/materials/${activeVideoResource.id}/content`,
              {
                method: 'PATCH',
                body: JSON.stringify({ videoStreamId: newUrl }),
              }
            );
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(json.error || 'Failed to save video link');
            }
            refresh();
          }}
        />

        {/* 7. Recorded Live Class Player Modal */}
        <MediaPlayerModal
          open={Boolean(activeRecordedSession)}
          onClose={() => setActiveRecordedSession(null)}
          title={activeRecordedSession?.title || 'Recorded Class Video'}
          subtitle={
            activeRecordedSession
              ? `${course?.title || ''} • ${activeRecordedSession.batchName}`
              : undefined
          }
          sourceUrlOrKey={activeRecordedSession?.recordingUrl}
          lessonNotes={activeRecordedSession?.description}
          downloadable={false}
          canAttachUrl={true}
          onSaveVideoUrl={async (newUrl) => {
            if (!activeRecordedSession) return;
            const res = await apiFetchResponse(
              `/teachers/live-classes/${activeRecordedSession.id}`,
              {
                method: 'PUT',
                body: JSON.stringify({ recordingUrl: newUrl }),
              }
            );
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(json.message || json.error || 'Failed to save recording URL');
            }
            refresh();
          }}
        />

      </div>
    </TeacherShell>
  );
}
