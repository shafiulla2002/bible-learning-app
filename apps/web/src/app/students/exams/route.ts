import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function verifyJwtToken(token: string, secret: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const [headerB64, payloadB64, signatureB64] = parts;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${headerB64}.${payloadB64}`);
  const expectedSig = hmac.digest('base64url');

  const sigBuf = Buffer.from(signatureB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const devUserId = request.headers.get('x-dev-user-id');
    const devRole = request.headers.get('x-dev-role');
    const devInstituteId = request.headers.get('x-dev-institute-id');

    let userId: string | null = null;
    let role: string | null = null;
    let instituteId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyJwtToken(
          token,
          process.env.JWT_SECRET || 'dev-secret-key-bible-institute-lms-12345'
        );
        userId = decoded.sub || decoded.userId;
        role = decoded.role;
        instituteId = decoded.instituteId;
      } catch {
        return NextResponse.json({ message: 'Invalid or expired authentication token' }, { status: 401 });
      }
    } else if (devRole) {
      userId = devUserId || 'dev-student-user';
      role = devRole;
      instituteId = devInstituteId;
    } else {
      return NextResponse.json({ message: 'Authentication token required' }, { status: 401 });
    }

    if (role && role !== 'STUDENT') {
      return NextResponse.json({ message: 'Only active STUDENT accounts may access examinations.' }, { status: 403 });
    }

    const membershipRows = await queryDb(
      `SELECT m.id as "membershipId", m."instituteId", m.role, m.status,
              sp.id as "studentProfileId", sp."admissionNo",
              u.id as "userId", u."fullName", u."avatarUrl"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       JOIN "User" u ON m."userId" = u.id
       WHERE m."userId" = $1 AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
       ${instituteId ? 'AND m."instituteId" = $2' : ''}
       LIMIT 1`,
      instituteId ? [userId, instituteId] : [userId]
    );

    if (membershipRows.length === 0) {
      return NextResponse.json({ message: 'No active student profile found for this account.' }, { status: 403 });
    }

    const studentMembership = membershipRows[0];
    const resolvedInstituteId = studentMembership.instituteId;
    const studentProfileId = studentMembership.studentProfileId;

    const enrolments = await queryDb(
      `SELECT e."courseId", c.title as "courseTitle"
       FROM "Enrolment" e
       JOIN "Course" c ON e."courseId" = c.id
       WHERE e."studentProfileId" = $1 AND e.status IN ('ACTIVE', 'COMPLETED')`,
      [studentProfileId]
    );

    const enrolledCourseIds = enrolments.map((e: any) => e.courseId);

    if (enrolledCourseIds.length === 0) {
      return NextResponse.json({
        exams: [],
        summary: { total: 0, available: 0, inProgress: 0, completed: 0 },
        courses: [],
      });
    }

    const url = new URL(request.url);
    const filterStatus = url.searchParams.get('status') || 'ALL';
    const filterCourseId = url.searchParams.get('courseId');
    const filterQuery = url.searchParams.get('q');

    const params: any[] = [studentProfileId, resolvedInstituteId, enrolledCourseIds];
    let extraFilter = '';

    if (filterCourseId) {
      extraFilter += ` AND ex."courseId" = $${params.length + 1}`;
      params.push(filterCourseId);
    }

    const examRows = await queryDb(
      `SELECT ex.id, ex.title, ex.type, ex."durationMin", ex."totalMarks", ex."passMarks",
              ex."courseId", c.title as "courseTitle",
              (SELECT COUNT(*) FROM "Question" q WHERE q."examId" = ex.id)::int as "totalQuestions",
              att.id as "attemptId", att."startedAt", att."submittedAt", att.score, att.status as "attemptStatus"
       FROM "Exam" ex
       JOIN "Course" c ON ex."courseId" = c.id
       LEFT JOIN LATERAL (
         SELECT a.id, a."startedAt", a."submittedAt", a.score, a.status
         FROM "ExamAttempt" a
         WHERE a."examId" = ex.id AND a."studentProfileId" = $1
         ORDER BY a."startedAt" DESC LIMIT 1
       ) att ON true
       WHERE ex."instituteId" = $2 AND ex."courseId" = ANY($3::text[]) ${extraFilter}
       ORDER BY ex."createdAt" DESC`,
      params
    );

    let availableCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    let mapped = examRows.map((ex: any) => {
      let dynamicStatus: 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'EVALUATED';

      if (ex.attemptId) {
        if (ex.attemptStatus === 'SUBMITTED' || ex.attemptStatus === 'EVALUATED') {
          dynamicStatus = 'COMPLETED';
          completedCount++;
        } else {
          dynamicStatus = 'IN_PROGRESS';
          inProgressCount++;
        }
      } else {
        dynamicStatus = 'AVAILABLE';
        availableCount++;
      }

      return {
        id: ex.id,
        title: ex.title,
        type: ex.type,
        courseId: ex.courseId,
        courseTitle: ex.courseTitle,
        durationMin: ex.durationMin,
        totalMarks: ex.totalMarks,
        passMarks: ex.passMarks,
        totalQuestions: ex.totalQuestions,
        status: dynamicStatus,
        latestAttempt: ex.attemptId
          ? {
              id: ex.attemptId,
              startedAt: new Date(ex.startedAt).toISOString(),
              submittedAt: ex.submittedAt ? new Date(ex.submittedAt).toISOString() : null,
              score: ex.score,
              status: ex.attemptStatus,
              passed: ex.score !== null ? ex.score >= ex.passMarks : null,
            }
          : null,
      };
    });

    if (filterStatus && filterStatus !== 'ALL') {
      mapped = mapped.filter((ex: any) => ex.status === filterStatus);
    }

    if (filterQuery) {
      const qLower = filterQuery.toLowerCase();
      mapped = mapped.filter(
        (ex: any) =>
          ex.title.toLowerCase().includes(qLower) ||
          ex.courseTitle.toLowerCase().includes(qLower)
      );
    }

    const courses = Array.from(
      new Map(enrolments.map((e: any) => [e.courseId, { id: e.courseId, title: e.courseTitle }])).values()
    );

    return NextResponse.json({
      exams: mapped,
      summary: {
        total: examRows.length,
        available: availableCount,
        inProgress: inProgressCount,
        completed: completedCount,
      },
      courses,
    });
  } catch (error: any) {
    console.error('Error in GET /students/exams:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

