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

export async function GET(
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
      if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview') {
        const testStudent = await queryDb(
          `SELECT u.id as "userId", m.role, m."instituteId"
           FROM "Membership" m
           JOIN "User" u ON u.id = m."userId"
           JOIN "StudentProfile" sp ON sp."membershipId" = m.id
           WHERE m.role = 'STUDENT' AND m.status = 'ACTIVE'
           ORDER BY CASE WHEN u."fullName" ILIKE '%Shafi%' THEN 0 ELSE 1 END, sp."createdAt" ASC
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

    if (role && role !== 'STUDENT') {
      return NextResponse.json({ message: 'Access denied: Student only' }, { status: 403 });
    }

    // Verify enrollment
    const enrolmentRows = await queryDb(
      `SELECT e.id as "enrolmentId", m."instituteId"
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

    const enrolmentId = enrolmentRows[0].enrolmentId;
    const resolvedInstituteId = enrolmentRows[0].instituteId;

    // Fetch Lesson and verify course/institute relationship
    const lessonRows = await queryDb(
      `SELECT
        l.id,
        l.title,
        l.type,
        l.body,
        l."durationSec",
        l."isMandatory",
        l.position,
        ch.title as "chapterTitle",
        mod.title as "moduleTitle",
        c.title as "courseTitle",
        c.id as "courseId"
       FROM "Lesson" l
       JOIN "Chapter" ch ON ch.id = l."chapterId"
       JOIN "Module" mod ON mod.id = ch."moduleId"
       JOIN "Course" c ON c.id = mod."courseId"
       WHERE l.id = $1 AND c.id = $2 AND l."instituteId" = $3
       LIMIT 1`,
      [lessonId, courseId, resolvedInstituteId]
    );

    if (lessonRows.length === 0) {
      return NextResponse.json({ message: 'Lesson not found' }, { status: 404 });
    }

    const lesson = lessonRows[0];

    // Fetch Progress
    const progressRows = await queryDb(
      `SELECT "isCompleted", "lastPosSec", "completedAt"
       FROM "LessonProgress"
       WHERE "enrolmentId" = $1 AND "lessonId" = $2
       LIMIT 1`,
      [enrolmentId, lessonId]
    );
    const progress = progressRows[0] || {
      isCompleted: false,
      lastPosSec: 0,
      completedAt: null,
    };

    // Sibling lessons for navigation
    const allLessons = await queryDb(
      `SELECT l.id, l.title, l.type
       FROM "Lesson" l
       JOIN "Chapter" ch ON ch.id = l."chapterId"
       JOIN "Module" mod ON mod.id = ch."moduleId"
       WHERE mod."courseId" = $1 AND l."instituteId" = $2
       ORDER BY mod.position ASC, ch.position ASC, l.position ASC`,
      [courseId, resolvedInstituteId]
    );

    const idx = allLessons.findIndex((l: any) => l.id === lessonId);
    const prevLesson = idx > 0 ? allLessons[idx - 1] : null;
    const nextLesson = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

    // Attached resources
    const resourceRows = await queryDb(
      `SELECT lr.id, lr.downloadable, ma.kind, ma."mimeType", ma."sizeBytes", ma."storageKey", ma."videoStreamId"
       FROM "LessonResource" lr
       JOIN "MediaAsset" ma ON ma.id = lr."mediaAssetId"
       WHERE lr."lessonId" = $1 AND lr."instituteId" = $2`,
      [lessonId, resolvedInstituteId]
    );

    const resources = resourceRows.map((r: any) => {
      const fileName = r.storageKey
        ? String(r.storageKey).split('/').pop() || `${r.kind || 'Resource'} Document`
        : `${r.kind || 'Resource'} Document`;
      return {
        id: r.id,
        title: fileName,
        storageKey: r.storageKey || '',
        videoStreamId: r.videoStreamId || null,
        kind: r.kind || 'FILE',
        mimeType: r.mimeType || 'application/pdf',
        sizeBytes: Number(r.sizeBytes || 0),
        downloadable: r.downloadable,
      };
    });

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        body: lesson.body,
        durationSec: lesson.durationSec || 0,
        isMandatory: lesson.isMandatory,
        position: lesson.position,
        chapterTitle: lesson.chapterTitle,
        moduleTitle: lesson.moduleTitle,
      },
      course: {
        id: lesson.courseId,
        title: lesson.courseTitle,
      },
      progress: {
        isCompleted: Boolean(progress.isCompleted),
        lastPosSec: progress.lastPosSec || 0,
        completedAt: progress.completedAt,
      },
      navigation: {
        prevLesson,
        nextLesson,
        currentIndex: idx + 1,
        totalLessons: allLessons.length,
      },
      resources,
    });
  } catch (error: any) {
    console.error('Error in GET /students/courses/[courseId]/lessons/[lessonId]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

