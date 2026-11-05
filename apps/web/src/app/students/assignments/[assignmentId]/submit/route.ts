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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params;
    const body = await request.json();
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
      return NextResponse.json({ message: 'Only active STUDENT accounts may submit assignments.' }, { status: 403 });
    }

    const membershipRows = await queryDb(
      `SELECT m.id as "membershipId", m."instituteId",
              sp.id as "studentProfileId"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
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

    // Verify assignment exists
    const assignmentRows = await queryDb(
      `SELECT id, "courseId", "batchId" FROM "Assignment"
       WHERE id = $1 AND "instituteId" = $2 LIMIT 1`,
      [assignmentId, resolvedInstituteId]
    );

    if (assignmentRows.length === 0) {
      return NextResponse.json({ message: 'Assignment not found in your institute.' }, { status: 404 });
    }

    const a = assignmentRows[0];

    // Verify student is enrolled in course
    const enrolmentRows = await queryDb(
      `SELECT id FROM "Enrolment"
       WHERE "studentProfileId" = $1 AND "courseId" = $2 AND status IN ('ACTIVE', 'COMPLETED') LIMIT 1`,
      [studentProfileId, a.courseId]
    );

    if (enrolmentRows.length === 0) {
      return NextResponse.json({ message: 'Access denied: You are not enrolled in the course for this assignment.' }, { status: 403 });
    }

    // Check existing submission status
    const existingSubmission = await queryDb(
      `SELECT id, status FROM "Submission"
       WHERE "assignmentId" = $1 AND "studentProfileId" = $2 LIMIT 1`,
      [assignmentId, studentProfileId]
    );

    if (existingSubmission.length > 0 && existingSubmission[0].status === 'GRADED') {
      return NextResponse.json({ message: 'This assignment has already been evaluated and cannot be resubmitted.' }, { status: 403 });
    }

    const now = new Date();
    const answerText = body.answerText || null;
    const fileUrl = body.fileUrl || null;

    let submissionId: string;
    if (existingSubmission.length > 0) {
      submissionId = existingSubmission[0].id;
      await queryDb(
        `UPDATE "Submission"
         SET "answerText" = COALESCE($1, "answerText"),
             "fileUrl" = COALESCE($2, "fileUrl"),
             "submittedAt" = $3,
             status = 'SUBMITTED'
         WHERE id = $4`,
        [answerText, fileUrl, now, submissionId]
      );
    } else {
      submissionId = crypto.randomUUID();
      await queryDb(
        `INSERT INTO "Submission" (id, "instituteId", "assignmentId", "studentProfileId", "answerText", "fileUrl", "submittedAt", status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'SUBMITTED')`,
        [submissionId, resolvedInstituteId, assignmentId, studentProfileId, answerText, fileUrl, now]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment submitted successfully.',
      submission: {
        id: submissionId,
        submittedAt: now.toISOString(),
        status: 'SUBMITTED',
      },
    });
  } catch (error: any) {
    console.error('Error in POST /students/assignments/[assignmentId]/submit:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

