'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetchResponse, apiFetchSwr, getStaleCached, resolveApiUrl } from '@/lib/api';
import { TeacherLiveClassItem } from './use-teacher-live-classes';

export interface RosterStudentItem {
  studentProfileId: string;
  admissionNumber: string | null;
  photoUrl: string | null;
  fullName: string;
  email: string | null;
  enrolmentId: string;
  attendanceId: string | null;
  attendanceStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | null;
  remarks: string | null;
  markedAt: string | null;
}

export interface AttendanceSummary {
  totalStudents: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  unmarkedCount: number;
}

export function useTeacherLiveClassDetail(sessionId: string) {
  const [session, setSession] = useState<TeacherLiveClassItem | null>(null);
  const [roster, setRoster] = useState<RosterStudentItem[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>({
    totalStudents: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    excusedCount: 0,
    unmarkedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (forceRefresh = false) => {
    if (!sessionId) return;
    const detailEndpoint = `/teachers/live-classes/${sessionId}`;
    const attEndpoint = `/teachers/live-classes/${sessionId}/attendance`;
    const cachedDetail = !forceRefresh ? getStaleCached<any>(resolveApiUrl(detailEndpoint)) : null;
    const cachedAtt = !forceRefresh ? getStaleCached<any>(resolveApiUrl(attEndpoint)) : null;

    if (cachedDetail?.data?.success) {
      setSession(cachedDetail.data.data);
      if (cachedAtt?.data?.success && cachedAtt.data.data) {
        setRoster(cachedAtt.data.data.roster || []);
        if (cachedAtt.data.data.summary) setAttendanceSummary(cachedAtt.data.data.summary);
      }
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [detailJson, attendanceJson] = await Promise.all([
        apiFetchSwr<any>(detailEndpoint, {
          ttlMs: 15000,
          bypassCache: forceRefresh,
          onRevalidate: (fresh) => {
            if (fresh?.success) setSession(fresh.data);
          },
        }),
        apiFetchSwr<any>(attEndpoint, {
          ttlMs: 15000,
          bypassCache: forceRefresh,
          onRevalidate: (fresh) => {
            if (fresh?.success && fresh?.data) {
              setRoster(fresh.data.roster || []);
              if (fresh.data.summary) setAttendanceSummary(fresh.data.summary);
            }
          },
        }).catch(() => null),
      ]);

      if (detailJson.success) {
        setSession(detailJson.data);
      } else {
        throw new Error(detailJson.message || 'Failed to fetch class details');
      }

      if (attendanceJson?.success && attendanceJson.data) {
        setRoster(attendanceJson.data.roster || []);
        if (attendanceJson.data.summary) {
          setAttendanceSummary(attendanceJson.data.summary);
        }
      }
    } catch (err: any) {
      console.error('fetchDetail error:', err);
      setError(err.message || 'Failed to load live class details');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const updateClass = async (payload: {
    title?: string;
    description?: string;
    room?: string;
    startsAt?: string;
    endsAt?: string;
    joinUrl?: string;
    recordingUrl?: string;
    status?: string;
  }) => {
    try {
      const res = await apiFetchResponse(`/teachers/live-classes/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to update live class (${res.status})`);
      }

      await fetchDetail();
      return json.data;
    } catch (err: any) {
      throw err;
    }
  };

  const cancelClass = async (reason?: string) => {
    try {
      const res = await apiFetchResponse(`/teachers/live-classes/${sessionId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to cancel class (${res.status})`);
      }

      await fetchDetail();
      return json.data;
    } catch (err: any) {
      throw err;
    }
  };

  const markAttendance = async (records: Array<{
    studentProfileId: string;
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
    remarks?: string;
  }>) => {
    try {
      const res = await apiFetchResponse(`/teachers/live-classes/${sessionId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ records }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to mark attendance (${res.status})`);
      }

      await fetchDetail();
      return json.data;
    } catch (err: any) {
      throw err;
    }
  };

  return {
    session,
    roster,
    attendanceSummary,
    isLoading,
    error,
    updateClass,
    cancelClass,
    markAttendance,
    refresh: () => fetchDetail(true),
  };
}

