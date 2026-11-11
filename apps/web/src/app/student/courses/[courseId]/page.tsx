'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import { apiFetchResponse, resolveApiUrl } from '@/lib/api';
import {
  BookOpen,
  PlayCircle,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Layers,
  ArrowLeft,
  FileText,
  Headphones,
  HelpCircle,
  Video,
  Download,
  Sparkles,
} from 'lucide-react';

interface LessonItem {
  id: string;
  title: string;
  type: 'VIDEO' | 'PDF' | 'AUDIO' | 'TEXT' | 'QUIZ';
  durationSec: number;
  isMandatory: boolean;
  position: number;
  isCompleted: boolean;
  isLocked: boolean;
  lastPosSec: number;
  completedAt: string | null;
  resourceCount: number;
}

interface ChapterItem {
  id: string;
  title: string;
  position: number;
  lessons: LessonItem[];
}

interface ModuleItem {
  id: string;
  title: string;
  position: number;
  chapters: ChapterItem[];
}

interface CourseDetailData {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string;
    coverImage: string | null;
    level: string;
    category: string;
    instructor: string;
    totalModules: number;
    totalLessons: number;
    completedLessons: number;
  };
  enrolment: {
    id: string;
    status: string;
    progressPct: number;
    batchName: string | null;
    enrolledAt: string;
  };
  curriculum: ModuleItem[];
  nextLesson: {
    id: string;
    title: string;
    type: string;
    chapterTitle?: string;
    moduleTitle?: string;
  } | null;
}

export default function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const { student, profile, institute } = useStudentAuth();
  const [data, setData] = useState<CourseDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchCourseDetail() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await apiFetchResponse(`/students/courses/${courseId}`);

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || 'Failed to load course details');
        }

        const json = await res.json();
        setData(json);

        // Auto-expand all modules initially
        const expanded: Record<string, boolean> = {};
        for (const m of json.curriculum || []) {
          expanded[m.id] = true;
        }
        setExpandedModules(expanded);
      } catch (err: any) {
        console.error('Error fetching course detail:', err);
        setError(err.message || 'Failed to load course');
      } finally {
        setIsLoading(false);
      }
    }

    if (courseId) {
      fetchCourseDetail();
    }
  }, [courseId, institute?.id, profile?.studentProfileId, student?.id]);

  const toggleModule = (modId: string) => {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return <Video size={16} className="text-blue-600" />;
      case 'PDF':
        return <FileText size={16} className="text-amber-600" />;
      case 'AUDIO':
        return <Headphones size={16} className="text-purple-600" />;
      case 'QUIZ':
        return <HelpCircle size={16} className="text-emerald-600" />;
      default:
        return <BookOpen size={16} className="text-slate-600" />;
    }
  };

  const formatDuration = (sec: number) => {
    if (!sec || sec === 0) return '15m';
    const m = Math.floor(sec / 60);
    return `${m}m`;
  };

  return (
    <StudentShell pageTitle={data?.course.title || 'Course Details'}>
      <div className="space-y-6">
        
        {/* Back navigation & Syllabus PDF Download */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/student/courses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
          >
            <ArrowLeft size={14} />
            <span>Back to My Courses</span>
          </Link>

          <a
            href={resolveApiUrl(`/students/courses/${courseId}/syllabus`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Download size={14} />
            <span>Download Syllabus PDF</span>
          </a>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 animate-pulse space-y-6">
            <div className="h-64 bg-slate-200 rounded-2xl w-full" />
            <div className="h-8 bg-slate-200 rounded w-1/2" />
            <div className="h-4 bg-slate-200 rounded w-3/4" />
          </div>
        ) : error || !data ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <BookOpen size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Course Unavailable</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{error || 'Could not find this course'}</p>
            <Link
              href="/student/courses"
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
            >
              Return to Courses
            </Link>
          </div>
        ) : (
          <>
            {/* 1. Course Overview Banner */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 md:p-8">
                {/* Left: Thumbnail & Badges */}
                <div className="lg:col-span-4 flex flex-col justify-between">
                  <div className="relative h-56 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center overflow-hidden shadow-md">
                    {data.course.coverImage ? (
                      <img
                        src={data.course.coverImage}
                        alt={data.course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <BookOpen size={56} className="text-white/80" />
                    )}
                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-slate-900 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                      {data.course.category}
                    </span>
                    <span className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md text-white text-[10px] font-medium px-2.5 py-1 rounded-md">
                      {data.course.level} Level
                    </span>
                  </div>

                  {/* Batch / Cohort info */}
                  {data.enrolment.batchName && (
                    <div className="mt-3.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200/60 text-xs text-slate-600 flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Assigned Cohort:</span>
                      <span className="font-semibold text-slate-900">{data.enrolment.batchName}</span>
                    </div>
                  )}
                </div>

                {/* Right: Details & Resume CTA */}
                <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-bold mb-2">
                      <Sparkles size={12} />
                      <span>Enrolled Curriculum</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                      {data.course.title}
                    </h1>
                    <p className="text-xs md:text-sm text-slate-600 mt-2.5 leading-relaxed font-normal">
                      {data.course.description ||
                        'A deep theological and exegetical study curriculum covering scripture hermeneutics, doctrinal foundations, and pastoral leadership.'}
                    </p>

                    {/* Metadata bar */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-slate-400" />
                        <span className="font-medium text-slate-700">{data.course.instructor}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers size={14} className="text-slate-400" />
                        <span>{data.course.totalModules} Modules</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-400" />
                        <span>{data.course.totalLessons} Lessons</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress & Jump to Lesson */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Course Completion</span>
                      <span className="font-bold text-blue-600">{data.enrolment.progressPct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#2563EB] h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, data.enrolment.progressPct)}%` }}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-slate-500">
                        Completed <strong className="text-slate-900">{data.course.completedLessons}</strong> of{' '}
                        <strong className="text-slate-900">{data.course.totalLessons}</strong> lessons
                      </div>

                      {data.nextLesson && (
                        <Link
                          href={`/student/courses/${courseId}/lessons/${data.nextLesson.id}`}
                          className="inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-sm transition"
                        >
                          <PlayCircle size={16} />
                          <span>Resume: {data.nextLesson.title}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Five-Level Curriculum Structure */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Course Curriculum</h3>
                <span className="text-xs text-slate-500 font-medium">
                  {data.curriculum.length} Modules • {data.course.totalLessons} Lessons
                </span>
              </div>

              {data.curriculum.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500 text-xs">
                  Syllabus content is being uploaded for this course. Please check back shortly.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.curriculum.map((module, mIdx) => {
                    const isExpanded = expandedModules[module.id] !== false;

                    return (
                      <div
                        key={module.id}
                        className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
                      >
                        {/* Module Header Accordion */}
                        <button
                          onClick={() => toggleModule(module.id)}
                          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100/70 transition border-b border-slate-100 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              M{mIdx + 1}
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{module.title}</h4>
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                {module.chapters.length} Chapters •{' '}
                                {module.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0)} Lessons
                              </p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp size={18} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={18} className="text-slate-400" />
                          )}
                        </button>

                        {/* Module Chapters & Lessons */}
                        {isExpanded && (
                          <div className="divide-y divide-slate-100">
                            {module.chapters.map((chapter, chIdx) => (
                              <div key={chapter.id} className="p-4 sm:p-5 space-y-3">
                                {/* Chapter Title */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Chapter {chIdx + 1}:
                                  </span>
                                  <h5 className="text-xs font-bold text-slate-800">{chapter.title}</h5>
                                </div>

                                {/* Lessons List */}
                                <div className="space-y-2 pl-2 sm:pl-4 border-l-2 border-slate-100">
                                  {chapter.lessons.map((lesson) => {
                                    return (
                                      <div
                                        key={lesson.id}
                                        className={`flex items-center justify-between p-3 rounded-xl transition ${
                                          lesson.isLocked
                                            ? 'bg-slate-50/50 text-slate-400'
                                            : 'bg-white hover:bg-blue-50/60 border border-slate-100 hover:border-blue-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          {/* Status Indicator */}
                                          {lesson.isCompleted ? (
                                            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                              <CheckCircle2 size={16} />
                                            </div>
                                          ) : lesson.isLocked ? (
                                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                              <Lock size={14} />
                                            </div>
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                              <PlayCircle size={16} />
                                            </div>
                                          )}

                                          {/* Lesson Info */}
                                          <div>
                                            <div className="flex items-center gap-2">
                                              {getLessonIcon(lesson.type)}
                                              <span
                                                className={`text-xs font-bold ${
                                                  lesson.isLocked ? 'text-slate-400' : 'text-slate-900'
                                                }`}
                                              >
                                                {lesson.title}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                              <span>{lesson.type}</span>
                                              <span>•</span>
                                              <span>{formatDuration(lesson.durationSec)}</span>
                                              {lesson.resourceCount > 0 && (
                                                <>
                                                  <span>•</span>
                                                  <span>{lesson.resourceCount} Resources</span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Action Button */}
                                        {lesson.isLocked ? (
                                          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                                            <Lock size={12} />
                                            <span>Locked</span>
                                          </span>
                                        ) : (
                                          <Link
                                            href={`/student/courses/${courseId}/lessons/${lesson.id}`}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline px-3 py-1 rounded-lg"
                                          >
                                            <span>{lesson.isCompleted ? 'Review' : 'Start'}</span>
                                          </Link>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </StudentShell>
  );
}

