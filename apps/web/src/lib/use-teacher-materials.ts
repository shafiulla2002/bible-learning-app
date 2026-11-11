'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TeacherMaterialItem {
  id: string;
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  chapterTitle: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  mediaAssetId: string;
  title: string;
  storageKey: string;
  videoStreamId?: string | null;
  kind: string;
  mimeType: string;
  sizeBytes: string;
  downloadable: boolean;
  createdAt: string;
}

export function useTeacherMaterials(initialLimit = 20) {
  const [items, setItems] = useState<TeacherMaterialItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('ALL');
  const [kind, setKind] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (search.trim()) params.set('search', search.trim());
      if (courseId && courseId !== 'ALL') params.set('courseId', courseId);
      if (kind && kind !== 'ALL') params.set('kind', kind);

      const res = await fetch(`/api/teachers/materials?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setItems(json.data || []);
        if (json.meta) {
          setTotalCount(json.meta.total || 0);
          setTotalPages(json.meta.totalPages || 1);
        }
      } else {
        throw new Error(json.error || 'Failed to fetch learning materials');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading learning materials');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, courseId, kind]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const uploadMaterial = async (payload: {
    courseId: string;
    lessonId: string;
    kind: string;
    storageKey: string;
    mimeType?: string;
    sizeBytes?: number;
    downloadable?: boolean;
  }) => {
    const res = await fetch('/api/teachers/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to upload material');
    }

    const json = await res.json();
    await fetchMaterials();
    return json;
  };

  return {
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
    setLimit,
    setSearch,
    setCourseId,
    setKind,
    refresh: fetchMaterials,
    uploadMaterial,
  };
}
