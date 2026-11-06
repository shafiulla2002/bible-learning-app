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
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await context.params;
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

    // Verify student membership and enrolment in course
    const enrolmentRows = await queryDb(
      `SELECT
        e.id as "enrolmentId",
        e.status as "enrolmentStatus",
        e."progressPct",
        e."createdAt" as "enrolledAt",
        b.name as "batchName",
        m."instituteId",
        sp.id as "studentProfileId"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       JOIN "Enrolment" e ON e."studentProfileId" = sp.id
       LEFT JOIN "Batch" b ON b.id = e."batchId"
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

    // Fetch Course Details
    const courseRows = await queryDb(
      `SELECT
        c.id,
        c.title,
        c.slug,
        c.description,
        c."coverImage",
        c.level,
        cc.name as "categoryName",
        (SELECT u."fullName"
         FROM "CourseInstructor" ci
         JOIN "TeacherProfile" tp ON tp.id = ci."teacherProfileId"
         JOIN "Membership" m2 ON m2.id = tp."membershipId"
         JOIN "User" u ON u.id = m2."userId"
         WHERE ci."courseId" = c.id
         LIMIT 1) as "instructorName"
       FROM "Course" c
       LEFT JOIN "CourseCategory" cc ON cc.id = c."categoryId"
       WHERE c.id = $1 AND c."instituteId" = $2
       LIMIT 1`,
      [courseId, resolvedInstituteId]
    );

    if (courseRows.length === 0) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }

    const course = courseRows[0];

    // Fetch Modules, Chapters and Lessons
    const moduleRows = await queryDb(
      `SELECT id, title, position
       FROM "Module"
       WHERE "courseId" = $1 AND "instituteId" = $2
       ORDER BY position ASC`,
      [courseId, resolvedInstituteId]
    );

    const chapterRows = await queryDb(
      `SELECT ch.id, ch.title, ch.position, ch."moduleId"
       FROM "Chapter" ch
       JOIN "Module" mod ON mod.id = ch."moduleId"
       WHERE mod."courseId" = $1 AND ch."instituteId" = $2
       ORDER BY ch.position ASC`,
      [courseId, resolvedInstituteId]
    );

    const lessonRows = await queryDb(
      `SELECT
        l.id,
        l.title,
        l.type,
        l."durationSec",
        l."isMandatory",
        l.position,
        l."chapterId",
        lp."isCompleted",
        lp."lastPosSec",
        lp."completedAt",
        (SELECT count(*)::int FROM "LessonResource" lr WHERE lr."lessonId" = l.id) as "resourceCount"
       FROM "Lesson" l
       JOIN "Chapter" ch ON ch.id = l."chapterId"
       JOIN "Module" mod ON mod.id = ch."moduleId"
       LEFT JOIN "LessonProgress" lp ON lp."lessonId" = l.id AND lp."enrolmentId" = $3
       WHERE mod."courseId" = $1 AND l."instituteId" = $2
       ORDER BY l.position ASC`,
      [courseId, resolvedInstituteId, enrolment.enrolmentId]
    );

    // Group curriculum into 5-level structure
    let totalLessonsCount = lessonRows.length;
    let completedLessonsCount = 0;
    let nextIncompleteLesson: any = null;
    let prevCompleted = true; // First lesson is unlocked

    const modules = moduleRows.map((mod: any) => {
      const chapters = chapterRows
        .filter((ch: any) => ch.moduleId === mod.id)
        .map((ch: any) => {
          const lessons = lessonRows
            .filter((l: any) => l.chapterId === ch.id)
            .map((l: any) => {
              const isCompleted = Boolean(l.isCompleted);
              if (isCompleted) completedLessonsCount++;

              const isLocked = !prevCompleted && !isCompleted;
              if (!isCompleted && !nextIncompleteLesson) {
                nextIncompleteLesson = {
                  id: l.id,
                  title: l.title,
                  type: l.type,
                  chapterTitle: ch.title,
                  moduleTitle: mod.title,
                };
              }
              prevCompleted = isCompleted;

              return {
                id: l.id,
                title: l.title,
                type: l.type,
                durationSec: l.durationSec || 0,
                isMandatory: l.isMandatory,
                position: l.position,
                isCompleted,
                isLocked,
                lastPosSec: l.lastPosSec || 0,
                completedAt: l.completedAt,
                resourceCount: l.resourceCount || 0,
              };
            });

          return {
            id: ch.id,
            title: ch.title,
            position: ch.position,
            lessons,
          };
        });

      return {
        id: mod.id,
        title: mod.title,
        position: mod.position,
        chapters,
      };
    });

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        coverImage: course.coverImage,
        level: course.level,
        category: course.categoryName || 'Biblical Studies',
        instructor: course.instructorName || 'Faculty Instructor',
        totalModules: modules.length,
        totalLessons: totalLessonsCount,
        completedLessons: completedLessonsCount,
      },
      enrolment: {
        id: enrolment.enrolmentId,
        status: enrolment.enrolmentStatus,
        progressPct: enrolment.progressPct || 0,
        batchName: enrolment.batchName || null,
        enrolledAt: enrolment.enrolledAt,
      },
      curriculum: modules,
      nextLesson: nextIncompleteLesson || modules[0]?.chapters[0]?.lessons[0] || null,
    });
  } catch (error: any) {
    console.error('Error in GET /students/courses/[courseId]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

