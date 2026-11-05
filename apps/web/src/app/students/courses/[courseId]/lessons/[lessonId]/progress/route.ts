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
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  try {
    const { courseId, lessonId } = await context.params;
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
        return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
      }
    } else if (devRole) {
      userId = devUserId;
      role = devRole;
      instituteId = devInstituteId;
    } else {
      if (process.env.NODE_ENV !== 'production') {
        const testStudent = await queryDb(
          `SELECT u.id as "userId", m.role, m."instituteId"
           FROM "Membership" m
           JOIN "User" u ON u.id = m."userId"
           JOIN "StudentProfile" sp ON sp."membershipId" = m.id
           WHERE m.role = 'STUDENT' AND m.status = 'ACTIVE'
           ORDER BY sp."createdAt" ASC
           LIMIT 1`
        );
        if (testStudent.length > 0) {
          userId = testStudent[0].userId;
          role = testStudent[0].role;
          instituteId = testStudent[0].instituteId;
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    // Verify student membership and enrollment
    const enrolmentRows = await queryDb(
      `SELECT e.id as "enrolmentId", e.status as "enrolmentStatus", m."instituteId"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       JOIN "Enrolment" e ON e."studentProfileId" = sp.id
       WHERE m."userId" = $1 AND e."courseId" = $2 AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
       LIMIT 1`,
      [userId, courseId]
    );

    if (enrolmentRows.length === 0) {
      return NextResponse.json(
        { message: 'Access denied: You are not enrolled in this course.' },
        { status: 403 }
      );
    }

    const enrolment = enrolmentRows[0];
    const resolvedInstituteId = enrolment.instituteId;

    const body = await request.json().catch(() => ({}));
    const lastPosSec = typeof body.lastPosSec === 'number' ? Math.max(0, Math.floor(body.lastPosSec)) : 0;
    const shouldMarkComplete = Boolean(body.isCompleted);

    // Upsert LessonProgress
    const progressId = crypto.randomUUID();
    await queryDb(
      `INSERT INTO "LessonProgress" (id, "instituteId", "enrolmentId", "lessonId", "lastPosSec", "isCompleted", "completedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("enrolmentId", "lessonId")
       DO UPDATE SET
         "lastPosSec" = $5,
         "isCompleted" = CASE WHEN $6 = true THEN true ELSE "LessonProgress"."isCompleted" END,
         "completedAt" = CASE WHEN $6 = true THEN COALESCE("LessonProgress"."completedAt", NOW()) ELSE "LessonProgress"."completedAt" END`,
      [
        progressId,
        resolvedInstituteId,
        enrolment.enrolmentId,
        lessonId,
        lastPosSec,
        shouldMarkComplete,
        shouldMarkComplete ? new Date() : null,
      ]
    );

    // Recalculate Course Progress
    const totalLessonsRows = await queryDb(
      `SELECT count(*)::int as count
       FROM "Lesson" l
       JOIN "Chapter" ch ON ch.id = l."chapterId"
       JOIN "Module" mod ON mod.id = ch."moduleId"
       WHERE mod."courseId" = $1 AND l."instituteId" = $2`,
      [courseId, resolvedInstituteId]
    );
    const totalLessons = totalLessonsRows[0]?.count || 1;

    const completedLessonsRows = await queryDb(
      `SELECT count(*)::int as count
       FROM "LessonProgress"
       WHERE "enrolmentId" = $1 AND "isCompleted" = true`,
      [enrolment.enrolmentId]
    );
    const completedLessons = completedLessonsRows[0]?.count || 0;

    const progressPct = Math.min(100, Math.round((completedLessons / totalLessons) * 100));
    const isCompletedCourse = progressPct === 100;

    await queryDb(
      `UPDATE "Enrolment"
       SET "progressPct" = $1,
           status = CASE WHEN $2 = true THEN 'COMPLETED'::"EnrolmentStatus" ELSE status END,
           "completedAt" = CASE WHEN $2 = true THEN COALESCE("completedAt", NOW()) ELSE "completedAt" END,
           "updatedAt" = NOW()
       WHERE id = $3`,
      [progressPct, isCompletedCourse, enrolment.enrolmentId]
    );

    return NextResponse.json({
      success: true,
      lessonId,
      isCompleted: shouldMarkComplete,
      lastPosSec,
      completedLessons,
      totalLessons,
      courseProgressPct: progressPct,
      courseStatus: isCompletedCourse ? 'COMPLETED' : enrolment.enrolmentStatus,
    });
  } catch (error: any) {
    console.error('Error in POST /students/courses/[courseId]/lessons/[lessonId]/progress:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

