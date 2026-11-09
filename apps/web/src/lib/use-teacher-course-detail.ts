'use client';

import { useState, useEffect, useCallback } from 'react';

export interface LessonResourceItem {
  id: string;
  lessonId: string;
  mediaAssetId: string;
  storageKey: string;
  kind: string;
  mimeType: string;
  sizeBytes: string;
  downloadable: boolean;
  createdAt: string;
}

export interface LessonItem {
  id: string;
  title: string;
  type: string;
  body: string | null;
  durationSec: number;
  isPreview: boolean;
  isMandatory: boolean;
  position: number;
  resources: LessonResourceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChapterItem {
  id: string;
  title: string;
  position: number;
  lessons: LessonItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ModuleItem {
  id: string;
  title: string;
  position: number;
  chapters: ChapterItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CourseDetailData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  level: string;
  language: string;
  pricing: string;
  price: number;
  salePrice: number | null;
  status: string;
  category: string;
  categoryId: string | null;
  role: string;
  instructors: Array<{
    id: string;
    role: string;
    teacherProfileId: string;
    fullName: string;
    email: string | null;
    avatarUrl: string | null;
  }>;
  assignedBatches: Array<{
    id: string;
    name: string;
    code: string | null;
    studentCount: number;
  }>;
  summary: {
    moduleCount: number;
    chapterCount: number;
    lessonCount: number;
    resourceCount: number;
    totalDurationMinutes: number;
  };
  modules: ModuleItem[];
  createdAt: string;
  updatedAt: string;
}

export function useTeacherCourseDetail(courseId: string) {
  const [course, setCourse] = useState<CourseDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teachers/courses/${courseId}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.course) {
        setCourse(json.course);
      } else {
        throw new Error(json.error || 'Failed to load course details');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading course curriculum');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  return {
    course,
    isLoading,
    error,
    refresh: fetchCourse,
  };
}
