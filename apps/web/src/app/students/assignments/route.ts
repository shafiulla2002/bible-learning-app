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
      return NextResponse.json({ message: 'Only active STUDENT accounts may access assignments.' }, { status: 403 });
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
      `SELECT e."courseId", e."batchId", c.title as "courseTitle"
       FROM "Enrolment" e
       JOIN "Course" c ON e."courseId" = c.id
       WHERE e."studentProfileId" = $1 AND e.status IN ('ACTIVE', 'COMPLETED')`,
      [studentProfileId]
    );

    const enrolledCourseIds = enrolments.map((e: any) => e.courseId);
    const enrolledBatchIds = enrolments.map((e: any) => e.batchId).filter(Boolean);

    if (enrolledCourseIds.length === 0) {
      return NextResponse.json({
        assignments: [],
        summary: { total: 0, pending: 0, submitted: 0, graded: 0, overdue: 0 },
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
      extraFilter += ` AND a."courseId" = $${params.length + 1}`;
      params.push(filterCourseId);
    }

    const assignmentRows = await queryDb(
      `SELECT a.id, a.title, a.instructions, a."dueAt", a."maxMarks", a.status as "assignmentStatus",
              a."courseId", c.title as "courseTitle",
              b.id as "batchId", b.name as "batchName",
              s.id as "submissionId", s."submittedAt", s."answerText", s."fileUrl", s."marksAwarded", s.feedback, s.status as "submissionStatus"
       FROM "Assignment" a
       JOIN "Course" c ON a."courseId" = c.id
       LEFT JOIN "Batch" b ON a."batchId" = b.id
       LEFT JOIN "Submission" s ON s."assignmentId" = a.id AND s."studentProfileId" = $1
       WHERE a."instituteId" = $2 AND a."courseId" = ANY($3::text[]) ${extraFilter}
       ORDER BY a."dueAt" ASC`,
      params
    );

    const now = new Date();
    let pendingCount = 0;
    let submittedCount = 0;
    let gradedCount = 0;
    let overdueCount = 0;

    let mapped = assignmentRows.map((a: any) => {
      const dueAt = new Date(a.dueAt);
      let dynamicStatus: 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'GRADED' | 'OVERDUE';

      if (a.submissionId) {
        if (a.submissionStatus === 'GRADED') {
          dynamicStatus = 'GRADED';
          gradedCount++;
        } else {
          dynamicStatus = 'SUBMITTED';
          submittedCount++;
        }
      } else {
        if (now > dueAt) {
          dynamicStatus = 'OVERDUE';
          overdueCount++;
        } else {
          dynamicStatus = 'PENDING';
          pendingCount++;
        }
      }

      return {
        id: a.id,
        title: a.title,
        instructions: a.instructions,
        courseId: a.courseId,
        courseTitle: a.courseTitle,
        batchId: a.batchId,
        batchName: a.batchName,
        dueAt: dueAt.toISOString(),
        maxMarks: a.maxMarks,
        status: dynamicStatus,
        isOverdue: now > dueAt && !a.submissionId,
        submission: a.submissionId
          ? {
              id: a.submissionId,
              submittedAt: new Date(a.submittedAt).toISOString(),
              answerText: a.answerText,
              fileUrl: a.fileUrl,
              marksAwarded: a.marksAwarded,
              feedback: a.feedback,
              status: a.submissionStatus,
            }
          : null,
      };
    });

    if (filterStatus && filterStatus !== 'ALL') {
      mapped = mapped.filter((a: any) => a.status === filterStatus);
    }

    if (filterQuery) {
      const qLower = filterQuery.toLowerCase();
      mapped = mapped.filter(
        (a: any) =>
          a.title.toLowerCase().includes(qLower) ||
          a.courseTitle.toLowerCase().includes(qLower)
      );
    }

    const courses = Array.from(
      new Map(enrolments.map((e: any) => [e.courseId, { id: e.courseId, title: e.courseTitle }])).values()
    );

    return NextResponse.json({
      assignments: mapped,
      summary: {
        total: assignmentRows.length,
        pending: pendingCount,
        submitted: submittedCount,
        graded: gradedCount,
        overdue: overdueCount,
      },
      courses,
    });
  } catch (error: any) {
    console.error('Error in GET /students/assignments:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

