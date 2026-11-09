import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const examRows = await queryDb<any>(
      `SELECT 
        e.id,
        e.title,
        e.instructions,
        e.type,
        e."durationMin",
        e."totalMarks",
        e."passMarks",
        e.status,
        e."startAt",
        e."endAt",
        e."courseId",
        e."batchId",
        c.title as "courseTitle",
        b.name as "batchName"
      FROM "Exam" e
      JOIN "Course" c ON c.id = e."courseId"
      LEFT JOIN "Batch" b ON b.id = e."batchId"
      WHERE e.id = $1 AND e."instituteId" = $2
      LIMIT 1`,
      [examId, instituteId]
    );

    if (examRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Examination not found in your institute' },
        { status: 404 }
      );
    }

    const exam = examRows[0];

    // Verify teacher authorization
    const authCheck = await queryDb<{ role: string }>(
      `SELECT role FROM (
        SELECT ci.role, 1 as priority
        FROM "CourseInstructor" ci
        WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
        UNION ALL
        SELECT bt.role, 2 as priority
        FROM "BatchTeacher" bt
        JOIN "Batch" b ON b.id = bt."batchId"
        WHERE (b.id = $4 OR b."courseId" = $1)
          AND bt."teacherProfileId" = $2
          AND bt."instituteId" = $3
      ) a ORDER BY priority ASC LIMIT 1`,
      [exam.courseId, teacherProfileId, instituteId, exam.batchId || exam.courseId]
    );

    if (authCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to view results for this examination.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status') || 'ALL';
    const searchQuery = searchParams.get('search')?.trim() || '';

    // Fetch enrolled students
    let enrolmentRows: any[] = [];
    if (exam.batchId) {
      enrolmentRows = await queryDb<any>(
        `SELECT 
          enr.id as "enrolmentId",
          enr."studentProfileId",
          sp."admissionNo",
          u.id as "userId",
          u."fullName" as "studentName",
          u.email,
          u."phoneE164" as phone,
          u."avatarUrl",
          b.name as "batchName"
        FROM "Enrolment" enr
        JOIN "StudentProfile" sp ON sp.id = enr."studentProfileId"
        JOIN "Membership" m ON m.id = sp."membershipId"
        JOIN "User" u ON u.id = m."userId"
        LEFT JOIN "Batch" b ON b.id = enr."batchId"
        WHERE enr."batchId" = $1 AND enr."instituteId" = $2 AND enr.status = 'ACTIVE'
        ORDER BY u."fullName" ASC`,
        [exam.batchId, instituteId]
      );
    } else {
      enrolmentRows = await queryDb<any>(
        `SELECT 
          enr.id as "enrolmentId",
          enr."studentProfileId",
          sp."admissionNo",
          u.id as "userId",
          u."fullName" as "studentName",
          u.email,
          u."phoneE164" as phone,
          u."avatarUrl",
          b.name as "batchName"
        FROM "Enrolment" enr
        JOIN "StudentProfile" sp ON sp.id = enr."studentProfileId"
        JOIN "Membership" m ON m.id = sp."membershipId"
        JOIN "User" u ON u.id = m."userId"
        LEFT JOIN "Batch" b ON b.id = enr."batchId"
        WHERE enr."courseId" = $1 AND enr."instituteId" = $2 AND enr.status = 'ACTIVE'
        ORDER BY u."fullName" ASC`,
        [exam.courseId, instituteId]
      );
    }

    // Fetch attempts for this exam
    const attempts = await queryDb<any>(
      `SELECT 
        att.id,
        att."studentProfileId",
        att."startedAt",
        att."submittedAt",
        att.score,
        att.status,
        att.feedback
      FROM "ExamAttempt" att
      WHERE att."examId" = $1 AND att."instituteId" = $2
      ORDER BY att."startedAt" DESC`,
      [examId, instituteId]
    );

    const attemptsByStudent = new Map<string, any>();
    attempts.forEach((att) => {
      if (!attemptsByStudent.has(att.studentProfileId)) {
        attemptsByStudent.set(att.studentProfileId, att);
      }
    });

    let results = enrolmentRows.map((enr) => {
      const att = attemptsByStudent.get(enr.studentProfileId);
      const isAttempted = Boolean(att);
      const score = att?.score !== null && att?.score !== undefined ? att.score : null;
      const percentage = score !== null ? Math.round((score / exam.totalMarks) * 100) : null;
      const passed = score !== null ? score >= exam.passMarks : null;

      let evaluationStatus: 'NOT_ATTEMPTED' | 'IN_PROGRESS' | 'PENDING_EVALUATION' | 'EVALUATED' = 'NOT_ATTEMPTED';
      if (!isAttempted) {
        evaluationStatus = 'NOT_ATTEMPTED';
      } else if (att.status === 'IN_PROGRESS') {
        evaluationStatus = 'IN_PROGRESS';
      } else if (att.status === 'SUBMITTED') {
        evaluationStatus = 'PENDING_EVALUATION';
      } else if (att.status === 'EVALUATED') {
        evaluationStatus = 'EVALUATED';
      }

      return {
        studentProfileId: enr.studentProfileId,
        admissionNo: enr.admissionNo || 'N/A',
        studentName: enr.studentName || 'Enrolled Student',
        email: enr.email || '',
        phone: enr.phone || '',
        avatarUrl: enr.avatarUrl || null,
        batchName: enr.batchName || exam.batchName || 'All Batches',
        attemptId: att?.id || null,
        attemptStatus: att?.status || 'NOT_ATTEMPTED',
        evaluationStatus,
        startedAt: att?.startedAt ? new Date(att.startedAt).toISOString() : null,
        submittedAt: att?.submittedAt ? new Date(att.submittedAt).toISOString() : null,
        score,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        percentage,
        passed,
        feedback: att?.feedback || null,
      };
    });

    // Apply filtering
    if (filterStatus && filterStatus !== 'ALL') {
      results = results.filter((r) => r.evaluationStatus === filterStatus || r.attemptStatus === filterStatus);
    }
    if (searchQuery) {
      const qLower = searchQuery.toLowerCase();
      results = results.filter(
        (r) =>
          r.studentName.toLowerCase().includes(qLower) ||
          r.admissionNo.toLowerCase().includes(qLower) ||
          r.email.toLowerCase().includes(qLower)
      );
    }

    const totalStudents = enrolmentRows.length;
    const attemptedCount = results.filter((r) => r.attemptId !== null).length;
    const evaluatedCount = results.filter((r) => r.evaluationStatus === 'EVALUATED').length;
    const pendingEvaluationCount = results.filter((r) => r.evaluationStatus === 'PENDING_EVALUATION').length;
    const passedCount = results.filter((r) => r.passed === true).length;
    const passRate = attemptedCount > 0 ? Math.round((passedCount / attemptedCount) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          courseId: exam.courseId,
          courseTitle: exam.courseTitle,
          batchId: exam.batchId,
          batchName: exam.batchName || 'All Batches',
          totalMarks: exam.totalMarks,
          passMarks: exam.passMarks,
          durationMin: exam.durationMin,
        },
        summary: {
          totalStudents,
          attemptedCount,
          evaluatedCount,
          pendingEvaluationCount,
          passedCount,
          passRate,
        },
        results,
      },
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching teacher exam results:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
