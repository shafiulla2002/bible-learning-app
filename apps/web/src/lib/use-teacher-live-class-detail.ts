'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetchResponse } from '@/lib/api';
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

  const fetchDetail = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [detailRes, attendanceRes] = await Promise.all([
        apiFetchResponse(`/teachers/live-classes/${sessionId}`, { cache: 'no-store' }),
        apiFetchResponse(`/teachers/live-classes/${sessionId}/attendance`, { cache: 'no-store' }),
      ]);

      if (!detailRes.ok) {
        const errJson = await detailRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch class details (${detailRes.status})`);
      }

      const detailJson = await detailRes.json();
      if (detailJson.success) {
        setSession(detailJson.data);
      } else {
        throw new Error(detailJson.message || 'Failed to fetch class details');
      }

      if (attendanceRes.ok) {
        const attendanceJson = await attendanceRes.json();
        if (attendanceJson.success && attendanceJson.data) {
          setRoster(attendanceJson.data.roster || []);
          if (attendanceJson.data.summary) {
            setAttendanceSummary(attendanceJson.data.summary);
          }
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
    refresh: fetchDetail,
  };
}

