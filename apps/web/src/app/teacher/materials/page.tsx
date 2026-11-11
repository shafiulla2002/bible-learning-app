'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Search,
  Filter,
  Download,
  Lock,
  BookOpen,
  Layers,
  Clock,
  Plus,
  RefreshCw,
  AlertCircle,
  Video,
  Music,
  Image as ImageIcon,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  X,
  FilePlus,
  PlayCircle,
  Eye,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherMaterials, TeacherMaterialItem } from '@/lib/use-teacher-materials';
import { useTeacherCourses } from '@/lib/use-teacher-courses';
import { MediaPlayerModal } from '@/components/shared/MediaPlayerModal';

function TeacherMaterialsContent() {
  const searchParams = useSearchParams();
  const initialCourseId = searchParams.get('courseId') || 'ALL';

  const {
    items,
    totalCount,
    totalPages,
    page,
    limit,
    search,
    courseId,
    kind,
    isLoading,
    error,
    setPage,
    setSearch,
    setCourseId,
    setKind,
    refresh,
    uploadMaterial,
  } = useTeacherMaterials();

  const { courses: assignedCourses } = useTeacherCourses(100);

  const [searchInput, setSearchInput] = useState(search);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadCourseId, setUploadCourseId] = useState('');
  const [uploadLessonId, setUploadLessonId] = useState('');
  const [courseLessons, setCourseLessons] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    storageKey: '',
    kind: 'PDF',
    mimeType: 'application/pdf',
    sizeBytes: 1048576,
    downloadable: true,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Stream / Video Player Modal state
  const [activeVideoMaterial, setActiveVideoMaterial] = useState<TeacherMaterialItem | null>(null);

  useEffect(() => {
    if (initialCourseId && initialCourseId !== 'ALL') {
      setCourseId(initialCourseId);
    }
  }, [initialCourseId, setCourseId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCourseId('ALL');
    setKind('ALL');
    setPage(1);
  };

  const formatFileSize = (bytesStr: string) => {
    const bytes = parseInt(bytesStr, 10) || 0;
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getKindIcon = (k: string) => {
    switch (k.toUpperCase()) {
      case 'PDF':
        return <FileText size={18} className="text-rose-500" />;
      case 'VIDEO':
        return <Video size={18} className="text-blue-500" />;
      case 'AUDIO':
        return <Music size={18} className="text-purple-500" />;
      case 'IMAGE':
        return <ImageIcon size={18} className="text-amber-500" />;
      default:
        return <FolderOpen size={18} className="text-slate-500" />;
    }
  };

  // When course changes in upload modal, fetch its lessons
  const handleCourseSelectionChange = async (cId: string) => {
    setUploadCourseId(cId);
    setUploadLessonId('');
    if (!cId) {
      setCourseLessons([]);
      return;
    }
    setLoadingLessons(true);
    try {
      const res = await fetch(`/api/teachers/courses/${cId}`);
      if (res.ok) {
        const json = await res.json();
        const extracted: Array<{ id: string; title: string }> = [];
        for (const m of json.course?.modules || []) {
          for (const ch of m.chapters || []) {
            for (const l of ch.lessons || []) {
              extracted.push({ id: l.id, title: `${m.title} › ${l.title}` });
            }
          }
        }
        setCourseLessons(extracted);
        if (extracted.length > 0) {
          setUploadLessonId(extracted[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load lessons for course', err);
    } finally {
      setLoadingLessons(false);
    }
  };

  const handleOpenUpload = () => {
    setUploadError(null);
    setUploadSuccess(null);
    const firstCourseId = assignedCourses[0]?.id || '';
    setUploadCourseId(firstCourseId);
    setUploadForm({
      storageKey: `materials/${Date.now()}-reading.pdf`,
      kind: 'PDF',
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
      downloadable: true,
    });
    setUploadModalOpen(true);
    if (firstCourseId) {
      handleCourseSelectionChange(firstCourseId);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadCourseId || !uploadLessonId || !uploadForm.storageKey) {
      setUploadError('Please select a course, lesson, and specify a storage key');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await uploadMaterial({
        courseId: uploadCourseId,
        lessonId: uploadLessonId,
        kind: uploadForm.kind,
        storageKey: uploadForm.storageKey.trim(),
        mimeType: uploadForm.mimeType,
        sizeBytes: uploadForm.sizeBytes,
        downloadable: uploadForm.downloadable,
      });

      setUploadSuccess('Study material successfully uploaded and indexed!');
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
    <TeacherShell pageTitle="Study Materials Repository">
      <div className="space-y-6">

        {/* 1. Header Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-400/20 backdrop-blur-md">
                <FileText size={13} className="text-blue-400" />
                <span>Academic Learning Resources</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Faculty Study Materials
              </h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                Browse, search, and manage syllabus attachments, lecture notes, study PDFs, and media assets attached to your assigned courses.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenUpload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg transition"
              >
                <Plus size={15} />
                Upload Material
              </button>
            </div>
          </div>
        </div>

        {/* 2. Filter & Search Control Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search materials by file name, course or lesson title..."
              className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {/* Course Filter Dropdown */}
            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Assigned Courses</option>
              {assignedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>

            {/* Material Kind Filter */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-medium">
              {[
                { label: 'All', value: 'ALL' },
                { label: 'PDF', value: 'PDF' },
                { label: 'Video', value: 'VIDEO' },
                { label: 'Audio', value: 'AUDIO' },
                { label: 'Other', value: 'FILE' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setKind(tab.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    kind === tab.value
                      ? 'bg-white text-slate-900 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Refresh */}
            <button
              onClick={() => refresh()}
              title="Refresh materials list"
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>

        {/* 3. Error Banner */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
            <button
              onClick={() => refresh()}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4. Materials List / Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-8 bg-slate-50 rounded-lg w-full" />
                <div className="h-4 bg-slate-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileText size={32} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-slate-900">No Learning Materials Found</h3>
              <p className="text-sm text-slate-500">
                {search || courseId !== 'ALL' || kind !== 'ALL'
                  ? 'No study materials matched your active filter criteria. Try resetting filters.'
                  : 'No study materials have been attached to lessons in your assigned courses yet.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              {(search || courseId !== 'ALL' || kind !== 'ALL') && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={handleOpenUpload}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
              >
                Upload First Material
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((mat) => {
              const isVideo = mat.kind?.toUpperCase() === 'VIDEO';
              const isPdf = mat.kind?.toUpperCase() === 'PDF' || mat.mimeType?.toLowerCase().includes('pdf');
              const contentUrl = `/api/teachers/materials/${mat.id}/content`;
              return (
              <div
                key={mat.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group overflow-hidden min-w-0"
              >
                <div className="space-y-3 min-w-0">
                  {/* Top file icon + DRM badge */}
                  <div className="flex items-start justify-between gap-2.5 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                        {getKindIcon(mat.kind)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors"
                          title={mat.title}
                        >
                          {mat.title}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium block truncate">
                          {formatFileSize(mat.sizeBytes)} • {mat.kind}
                        </span>
                      </div>
                    </div>

                    {mat.downloadable ? (
                      <span
                        title="Download Allowed"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 whitespace-nowrap"
                      >
                        <Download size={10} />
                        Downloadable
                      </span>
                    ) : (
                      <span
                        title="DRM Protected (Stream Only)"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0 whitespace-nowrap"
                      >
                        <Lock size={10} />
                        Stream Only
                      </span>
                    )}
                  </div>

                  {/* Course & Lesson Hierarchy Path */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold min-w-0">
                      <BookOpen size={12} className="text-blue-600 shrink-0" />
                      <span className="truncate">{mat.courseTitle}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate pl-4">
                      {mat.moduleTitle} › {mat.lessonTitle}
                    </div>
                  </div>
                </div>

                {/* Footer with Date & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 text-[11px] shrink-0">
                    {new Date(mat.createdAt).toLocaleDateString()}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {isVideo ? (
                      <button
                        type="button"
                        onClick={() => setActiveVideoMaterial(mat)}
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
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold transition"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </a>
                        )}
                        {mat.downloadable && (
                          <a
                            href={`${contentUrl}?download=1`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </a>
                        )}
                      </>
                    )}

                    <Link
                      href={`/teacher/courses/${mat.courseId}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                    >
                      <span>Syllabus</span>
                      <ExternalLink size={11} />
                    </Link>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* 5. Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total resources)
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || isLoading}
                onClick={() => setPage(page - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <button
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* 6. Upload Study Material Modal */}
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <FilePlus size={18} className="text-blue-600" />
                  Upload Faculty Study Material
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
                {/* Course Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Assigned Course
                  </label>
                  <select
                    value={uploadCourseId}
                    onChange={(e) => handleCourseSelectionChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Choose Course --</option>
                    {assignedCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lesson Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Lesson in Syllabus
                  </label>
                  <select
                    value={uploadLessonId}
                    onChange={(e) => setUploadLessonId(e.target.value)}
                    required
                    disabled={loadingLessons || courseLessons.length === 0}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:opacity-50"
                  >
                    {loadingLessons ? (
                      <option>Loading lessons...</option>
                    ) : courseLessons.length === 0 ? (
                      <option value="">No lessons found in this course</option>
                    ) : (
                      courseLessons.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Storage Key */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Resource / File Storage Key
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadForm.storageKey}
                    onChange={(e) => setUploadForm({ ...uploadForm, storageKey: e.target.value })}
                    placeholder="e.g. materials/syllabus-reading.pdf"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
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
                    id="downloadable-toggle-materials"
                    checked={uploadForm.downloadable}
                    onChange={(e) => setUploadForm({ ...uploadForm, downloadable: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <label htmlFor="downloadable-toggle-materials" className="text-xs text-slate-700 font-medium cursor-pointer">
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
                    disabled={isUploading || !uploadLessonId}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Upload & Index'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 7. Video Stream Player Modal */}
        <MediaPlayerModal
          open={Boolean(activeVideoMaterial)}
          onClose={() => setActiveVideoMaterial(null)}
          title={activeVideoMaterial?.title || 'Course Video'}
          subtitle={
            activeVideoMaterial
              ? `${activeVideoMaterial.courseTitle} • ${activeVideoMaterial.lessonTitle}`
              : undefined
          }
          sourceUrlOrKey={
            activeVideoMaterial?.videoStreamId || activeVideoMaterial?.storageKey
          }
          downloadable={Boolean(activeVideoMaterial?.downloadable)}
          canAttachUrl={true}
          downloadHref={
            activeVideoMaterial?.downloadable
              ? `/api/teachers/materials/${activeVideoMaterial.id}/content?download=1`
              : null
          }
          onSaveVideoUrl={async (newUrl) => {
            if (!activeVideoMaterial) return;
            const res = await fetch(
              `/api/teachers/materials/${activeVideoMaterial.id}/content`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
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

      </div>
    </TeacherShell>
  );
}

export default function TeacherMaterialsPage() {
  return (
    <Suspense
      fallback={
        <TeacherShell pageTitle="Study Materials Repository">
          <div className="p-12 text-center text-slate-400">Loading materials repository...</div>
        </TeacherShell>
      }
    >
      <TeacherMaterialsContent />
    </Suspense>
  );
}
