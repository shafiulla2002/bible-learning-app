'use client';

import React, { useState, useEffect, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import { apiFetchResponse, resolveApiUrl } from '@/lib/api';
import {
  ArrowLeft,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FileText,
  Headphones,
  Video,
  HelpCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  BookOpen,
  Award,
  Layers,
  AlertCircle,
  PlayCircle,
  Lock,
} from 'lucide-react';
import { MediaPlayerModal } from '@/components/shared/MediaPlayerModal';

interface LessonDetailResponse {
  lesson: {
    id: string;
    title: string;
    type: 'VIDEO' | 'PDF' | 'AUDIO' | 'TEXT' | 'QUIZ';
    body: string | null;
    durationSec: number;
    isMandatory: boolean;
    position: number;
    chapterTitle: string;
    moduleTitle: string;
  };
  course: {
    id: string;
    title: string;
  };
  progress: {
    isCompleted: boolean;
    lastPosSec: number;
    completedAt: string | null;
  };
  navigation: {
    prevLesson: { id: string; title: string; type: string } | null;
    nextLesson: { id: string; title: string; type: string } | null;
    currentIndex: number;
    totalLessons: number;
  };
  resources: Array<{
    id: string;
    title: string;
    storageKey?: string;
    videoStreamId?: string | null;
    kind: string;
    mimeType: string;
    sizeBytes: number;
    downloadable: boolean;
  }>;
}

export default function StudentLessonPlayerPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = use(params);
  const router = useRouter();
  const { student, profile, institute } = useStudentAuth();

  const [data, setData] = useState<LessonDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Playback & Progress State
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [currentPosSec, setCurrentPosSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [savingProgress, setSavingProgress] = useState<boolean>(false);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [activeVideoRes, setActiveVideoRes] = useState<LessonDetailResponse['resources'][number] | null>(null);
  const [quizResult, setQuizResult] = useState<{
    score: number;
    total: number;
    passed: boolean;
    percentage: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedPosRef = useRef<number>(0);

  // 1. Fetch Lesson Data
  useEffect(() => {
    async function fetchLesson() {
      try {
        setIsLoading(true);
        setError(null);

        const headers: Record<string, string> = {};
        const res = await apiFetchResponse(`/students/courses/${courseId}/lessons/${lessonId}`);

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || 'Failed to load lesson');
        }

        const json = await res.json();
        setData(json);
        setIsCompleted(json.progress?.isCompleted || false);
        setCurrentPosSec(json.progress?.lastPosSec || 0);
        lastSavedPosRef.current = json.progress?.lastPosSec || 0;
      } catch (err: any) {
        console.error('Error fetching lesson:', err);
        setError(err.message || 'Failed to load lesson');
      } finally {
        setIsLoading(false);
      }
    }

    if (courseId && lessonId) {
      fetchLesson();
    }
  }, [courseId, lessonId, institute?.id, profile?.studentProfileId, student?.id]);

  // 2. Save Progress API Call
  const saveProgress = useCallback(
    async (posSec: number, markComplete = false) => {
      try {
        setSavingProgress(true);
        const res = await apiFetchResponse(
          `/students/courses/${courseId}/lessons/${lessonId}/progress`,
          {
            method: 'POST',
            body: JSON.stringify({
              lastPosSec: Math.floor(posSec),
              isCompleted: markComplete,
            }),
          }
        );

        if (res.ok) {
          lastSavedPosRef.current = Math.floor(posSec);
          if (markComplete) {
            setIsCompleted(true);
          }
        }
      } catch (err) {
        console.error('Failed to save lesson progress:', err);
      } finally {
        setSavingProgress(false);
      }
    },
    [courseId, lessonId, institute?.id, profile?.studentProfileId, student?.id]
  );

  // 3. Heartbeat: Periodic progress saving every 10 seconds during playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (Math.abs(currentPosSec - lastSavedPosRef.current) >= 5) {
        saveProgress(currentPosSec, false);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isPlaying, currentPosSec, saveProgress]);

  // Handle Mark Complete toggle
  const handleToggleComplete = async () => {
    const nextState = !isCompleted;
    setIsCompleted(nextState);
    await saveProgress(currentPosSec, nextState);
  };

  // Handle Quiz Submission
  const handleQuizSubmit = async () => {
    const answers = quizAnswers;
    const answeredCount = Object.keys(answers).length;
    const score = Object.values(answers).filter((v) => v === 'correct').length;
    const total = 3; // 3 sample quiz items
    const percentage = Math.round((score / total) * 100);
    const passed = percentage >= 70;

    setQuizResult({ score, total, passed, percentage });

    if (passed) {
      setIsCompleted(true);
      await saveProgress(currentPosSec, true);
    }
  };

  // Format time helpers
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <StudentShell pageTitle={data?.lesson.title || 'Lesson Player'}>
      <div className="space-y-5">
        
        {/* Top Navigation & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              href={`/student/courses/${courseId}`}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Back to Course"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                <span>{data?.course.title}</span>
                <span>/</span>
                <span>{data?.lesson.moduleTitle}</span>
                <span>/</span>
                <span className="text-slate-600 font-semibold">{data?.lesson.chapterTitle}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                {data?.lesson.title}
              </h2>
            </div>
          </div>

          {/* Completion Status & Toggle */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {savingProgress && (
              <span className="text-[10px] text-slate-400 animate-pulse">Saving...</span>
            )}
            <button
              onClick={handleToggleComplete}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                isCompleted
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              }`}
            >
              <CheckCircle2 size={15} />
              <span>{isCompleted ? 'Completed ✓' : 'Mark Complete'}</span>
            </button>
          </div>
        </div>

        {/* Main Stage Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left/Center Media Player Stage (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              
              {/* VIDEO LESSON PLAYER */}
              {data?.lesson.type === 'VIDEO' && (
                <div className="relative bg-slate-950 aspect-video flex flex-col justify-between overflow-hidden">
                  {/* Mock Video Canvas with Canvas Texture */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
                    <div className="w-16 h-16 rounded-full bg-blue-600/90 hover:bg-blue-600 text-white flex items-center justify-center shadow-2xl cursor-pointer transition transform hover:scale-110 mb-3"
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                    </div>
                    <h3 className="text-sm font-bold tracking-tight text-white/90 max-w-md">
                      {data.lesson.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {isPlaying ? 'Playing lesson stream...' : 'Click to resume playback from ' + formatTime(currentPosSec)}
                    </p>
                  </div>

                  {/* Player Bottom Control Bar */}
                  <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white space-y-2 mt-auto">
                    {/* Scrub Progress Bar */}
                    <div
                      className="w-full bg-white/20 h-1.5 rounded-full cursor-pointer overflow-hidden"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        const duration = data.lesson.durationSec || 1800;
                        const newPos = Math.floor(pct * duration);
                        setCurrentPosSec(newPos);
                        saveProgress(newPos, false);
                      }}
                    >
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((currentPosSec / (data.lesson.durationSec || 1800)) * 100)
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="hover:text-blue-400 transition"
                        >
                          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className="hover:text-blue-400 transition"
                        >
                          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <span className="text-[11px] text-slate-300">
                          {formatTime(currentPosSec)} / {formatTime(data.lesson.durationSec || 1800)}
                        </span>
                      </div>

                      {/* Speed Control */}
                      <div className="flex items-center gap-1.5">
                        {[1, 1.25, 1.5].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setPlaybackSpeed(speed)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              playbackSpeed === speed
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/10 text-slate-300 hover:bg-white/20'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PDF LESSON VIEWER */}
              {data?.lesson.type === 'PDF' && (
                <div className="p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{data.lesson.title}</h3>
                        <p className="text-xs text-slate-400">PDF Study Syllabus Document</p>
                      </div>
                    </div>
                    <a
                      href={resolveApiUrl(`/students/courses/${courseId}/syllabus`)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                    >
                      <Download size={14} />
                      <span>Download Syllabus PDF</span>
                    </a>
                  </div>

                  {/* Embedded Document Reading Pane */}
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 min-h-[350px] space-y-4 text-xs text-slate-700 leading-relaxed font-serif">
                    <p className="font-bold text-sm text-slate-900 font-sans">
                      Course Syllabus Notes: {data.lesson.title}
                    </p>
                    <p>
                      {data.lesson.body ||
                        'This study handout outlines the primary theological and exegetical methodology for interpreting covenantal themes across the Old and New Testaments. Students are encouraged to cross-reference biblical texts cited in the margins.'}
                    </p>
                    <p>
                      1. Contextual Historical Analysis: The redemptive-historical trajectory establishes how Old Covenant promises are inaugurated and fulfilled in the person and work of Christ.
                    </p>
                    <p>
                      2. Canonical Application: Practical application for church ministry and pastoral leadership.
                    </p>
                  </div>
                </div>
              )}

              {/* AUDIO LESSON PLAYER */}
              {data?.lesson.type === 'AUDIO' && (
                <div className="p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <Headphones size={28} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                        Audio Lecture
                      </span>
                      <h3 className="text-base font-bold text-slate-900">{data.lesson.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Faculty Audio Commentary</p>
                    </div>
                  </div>

                  {/* Audio Controls */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>{formatTime(currentPosSec)}</span>
                      <span>{formatTime(data.lesson.durationSec || 1200)}</span>
                    </div>
                    <div
                      className="w-full bg-slate-200 h-2 rounded-full cursor-pointer overflow-hidden"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        const duration = data.lesson.durationSec || 1200;
                        const newPos = Math.floor(pct * duration);
                        setCurrentPosSec(newPos);
                        saveProgress(newPos, false);
                      }}
                    >
                      <div
                        className="bg-purple-600 h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((currentPosSec / (data.lesson.durationSec || 1200)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-4 pt-2">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-md transition"
                      >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TEXT LESSON */}
              {data?.lesson.type === 'TEXT' && (
                <div className="p-6 md:p-8 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <BookOpen size={14} />
                    <span>Theological Reading Article</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{data.lesson.title}</h3>
                  <div className="prose prose-slate max-w-none text-xs md:text-sm text-slate-700 leading-relaxed space-y-4 pt-2 border-t border-slate-100">
                    <p>
                      {data.lesson.body ||
                        'Hermeneutics provides the foundational discipline through which pastors, teachers, and scholars engage the biblical text in its original historical, literary, and theological context.'}
                    </p>
                    <p>
                      Scripture must be interpreted with fidelity to the original authorial intent, recognizing the overarching narrative of God’s redemptive work across human history.
                    </p>
                  </div>
                </div>
              )}

              {/* QUIZ LESSON */}
              {data?.lesson.type === 'QUIZ' && (
                <div className="p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <HelpCircle size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{data.lesson.title}</h3>
                        <p className="text-xs text-slate-400">Assessment Quiz • 70% required to pass</p>
                      </div>
                    </div>
                    {quizResult && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          quizResult.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {quizResult.passed ? 'PASSED' : 'RETAKE REQUIRED'} ({quizResult.percentage}%)
                      </span>
                    )}
                  </div>

                  {/* Quiz Questions */}
                  <div className="space-y-6">
                    {/* Question 1 */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-900">
                        1. What is the primary objective of biblical exegesis?
                      </p>
                      <div className="space-y-1.5 text-xs text-slate-700">
                        {[
                          { id: 'correct', label: 'To extract the author’s intended meaning from the original context.' },
                          { id: 'incorrect', label: 'To impose contemporary cultural views onto the passage.' },
                        ].map((opt) => (
                          <label
                            key={opt.id}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                              quizAnswers['q1'] === opt.id
                                ? 'bg-blue-50 border-blue-400 font-medium text-blue-900'
                                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name="q1"
                              checked={quizAnswers['q1'] === opt.id}
                              onChange={() => setQuizAnswers({ ...quizAnswers, q1: opt.id })}
                              className="text-blue-600"
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Question 2 */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-900">
                        2. Which covenant establishes God’s promise to make Abraham a great nation?
                      </p>
                      <div className="space-y-1.5 text-xs text-slate-700">
                        {[
                          { id: 'correct', label: 'The Abrahamic Covenant (Genesis 12 & 15)' },
                          { id: 'incorrect', label: 'The Mosaic Covenant at Sinai' },
                        ].map((opt) => (
                          <label
                            key={opt.id}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                              quizAnswers['q2'] === opt.id
                                ? 'bg-blue-50 border-blue-400 font-medium text-blue-900'
                                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name="q2"
                              checked={quizAnswers['q2'] === opt.id}
                              onChange={() => setQuizAnswers({ ...quizAnswers, q2: opt.id })}
                              className="text-blue-600"
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleQuizSubmit}
                      disabled={Object.keys(quizAnswers).length < 2}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      Submit Quiz Answers
                    </button>
                  </div>
                </div>
              )}

              {/* Lesson Overview / Transcript footer */}
              <div className="p-6 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  <span>Duration: {Math.floor((data?.lesson.durationSec || 900) / 60)} minutes</span>
                </div>
                <span>Curriculum Position: Lesson {data?.navigation.currentIndex} of {data?.navigation.totalLessons}</span>
              </div>
            </div>

            {/* Bottom Lesson Navigation Bar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
              {data?.navigation.prevLesson ? (
                <Link
                  href={`/student/courses/${courseId}/lessons/${data.navigation.prevLesson.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                >
                  <ChevronLeft size={16} />
                  <span>Previous: {data.navigation.prevLesson.title}</span>
                </Link>
              ) : (
                <div />
              )}

              {data?.navigation.nextLesson ? (
                <Link
                  href={`/student/courses/${courseId}/lessons/${data.navigation.nextLesson.id}`}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <span>Next: {data.navigation.nextLesson.title}</span>
                  <ChevronRight size={16} />
                </Link>
              ) : (
                <Link
                  href={`/student/courses/${courseId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                >
                  <Award size={16} />
                  <span>Finish Course</span>
                </Link>
              )}
            </div>
          </div>

          {/* Right Resources & Syllabus Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Downloadable Resources Box */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Download size={16} className="text-blue-600" />
                <span>Lesson Resources</span>
              </h4>

              {data?.resources && data.resources.length > 0 ? (
                <div className="space-y-2.5">
                  {data.resources.map((res) => {
                    const isVideo = res.kind?.toUpperCase() === 'VIDEO';
                    return (
                      <div
                        key={res.id}
                        className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-blue-50/50 transition overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {isVideo ? (
                            <Video size={16} className="text-blue-600 shrink-0" />
                          ) : (
                            <FileText size={16} className="text-slate-500 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 truncate" title={res.title}>
                              {res.title}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {res.kind} • {res.downloadable ? 'Downloadable' : 'Stream Only'}
                            </p>
                          </div>
                        </div>

                        {isVideo ? (
                          <button
                            type="button"
                            onClick={() => setActiveVideoRes(res)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-[11px] font-semibold transition shrink-0"
                            title="Stream Video"
                          >
                            <PlayCircle size={13} />
                            <span>Watch</span>
                          </button>
                        ) : res.downloadable ? (
                          <a
                            href={resolveApiUrl(`/students/materials/${res.id}/content?download=1`)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100/60 transition shrink-0"
                            title="Download PDF"
                          >
                            <Download size={15} />
                          </a>
                        ) : (
                          <span
                            className="p-1.5 rounded-lg text-amber-600 shrink-0"
                            title="Stream Only (DRM Protected)"
                          >
                            <Lock size={14} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                  No attachments for this lesson.
                </div>
              )}
            </div>

            {/* Course Progress Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Your Learning Path</h4>
              <p className="text-xs text-slate-500">
                You are on Lesson {data?.navigation.currentIndex} of {data?.navigation.totalLessons}. All progress is auto-saved.
              </p>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      ((data?.navigation.currentIndex || 1) / (data?.navigation.totalLessons || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

        </div>

        <MediaPlayerModal
          open={Boolean(activeVideoRes)}
          onClose={() => setActiveVideoRes(null)}
          title={activeVideoRes?.title || 'Recorded Lesson Video'}
          subtitle={data ? `${data.course.title} • ${data.lesson.title}` : undefined}
          sourceUrlOrKey={activeVideoRes?.videoStreamId || activeVideoRes?.storageKey}
          lessonNotes={data?.lesson.body}
          downloadable={Boolean(activeVideoRes?.downloadable)}
          canAttachUrl={false}
          downloadHref={
            activeVideoRes?.downloadable
              ? resolveApiUrl(`/students/materials/${activeVideoRes.id}/content?download=1`)
              : null
          }
        />

      </div>
    </StudentShell>
  );
}

