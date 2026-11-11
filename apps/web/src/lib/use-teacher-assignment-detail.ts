'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetchResponse } from '@/lib/api';

export interface StudentSubmissionItem {
  studentProfileId: string;
  admissionNo: string;
  studentName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  batchName: string;
  submissionId: string | null;
  status: string; // 'PENDING', 'SUBMITTED', 'GRADED'
  submittedAt: string | null;
  isLate: boolean;
  answerText: string | null;
  fileUrl: string | null;
  marksAwarded: number | null;
  maxMarks: number;
  feedback: string | null;
}

export interface AssignmentDetailData {
  id: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxMarks: number;
  status: string;
  courseId: string;
  courseTitle: string;
  batchId: string | null;
  batchName: string;
  createdAt: string;
  updatedAt: string;
  summary: {
    totalStudents: number;
    submittedCount: number;
    gradedCount: number;
    pendingCount: number;
    lateCount: number;
  };
  submissions: StudentSubmissionItem[];
}

export function useTeacherAssignmentDetail(assignmentId: string) {
  const [assignment, setAssignment] = useState<AssignmentDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignment = useCallback(async () => {
    if (!assignmentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetchResponse(`/teachers/assignments/${assignmentId}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.assignment) {
        setAssignment(json.assignment);
      } else {
        throw new Error(json.error || 'Failed to load assignment details');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading assignment');
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const updateAssignment = async (payload: {
    title?: string;
    instructions?: string;
    dueAt?: string;
    maxMarks?: number;
    status?: string;
  }) => {
    const res = await apiFetchResponse(`/teachers/assignments/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to update assignment');
    }

    const json = await res.json();
    await fetchAssignment();
    return json;
  };

  const gradeSubmission = async (submissionId: string, payload: {
    marksAwarded: number;
    feedback?: string;
  }) => {
    const res = await apiFetchResponse(`/teachers/assignments/${assignmentId}/submissions/${submissionId}/grade`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to record grade');
    }

    const json = await res.json();
    await fetchAssignment();
    return json;
  };

  return {
    assignment,
    isLoading,
    error,
    refresh: fetchAssignment,
    updateAssignment,
    gradeSubmission,
  };
}

