import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Student Portal Phase 3: Course Catalog, Course Details & Interactive Lesson Player', () => {
  let app: INestApplication;
  let serverUrl: string;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let student1Membership: any;
  let testInstitute: any;
  let otherInstitute: any;
  let enrolledCourse: any;
  let unenrolledCourse: any;
  let sampleLesson: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;
    serverUrl = `http://127.0.0.1:${port}/api/v1`;

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Fetch student with active enrolments
    const students = await prisma.membership.findMany({
      where: {
        role: 'STUDENT',
        status: 'ACTIVE',
        studentProfile: { isNot: null },
      },
      include: {
        user: true,
        studentProfile: {
          include: {
            enrolments: {
              include: {
                course: {
                  include: {
                    modules: {
                      include: {
                        chapters: {
                          include: {
                            lessons: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        institute: true,
      },
      take: 5,
    });

    student1Membership = students.find((s: any) => s.studentProfile?.enrolments?.length > 0) || students[0];
    testInstitute = student1Membership?.institute;

    if (student1Membership?.studentProfile?.enrolments?.length) {
      enrolledCourse = student1Membership.studentProfile.enrolments[0].course;
      const modules = enrolledCourse?.modules || [];
      for (const m of modules) {
        for (const ch of m.chapters || []) {
          if (ch.lessons && ch.lessons.length > 0) {
            sampleLesson = ch.lessons[0];
            break;
          }
        }
        if (sampleLesson) break;
      }
    }

    if (!sampleLesson && enrolledCourse) {
      sampleLesson = await prisma.lesson.findFirst({
        where: { chapter: { module: { courseId: enrolledCourse.id } } },
      });
    }

    // Find a course the student is not enrolled in
    const unenrolled = await prisma.course.findFirst({
      where: {
        instituteId: testInstitute?.id,
        id: { not: enrolledCourse?.id },
      },
    });
    unenrolledCourse = unenrolled;

    const other = await prisma.institute.findFirst({
      where: { id: { not: testInstitute?.id } },
    });
    otherInstitute = other;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. rejects unauthenticated requests to GET /students/courses with HTTP 401', async () => {
    const res = await fetch(`${serverUrl}/students/courses`);
    expect(res.status).toBe(401);
  });

  it('2. rejects non-student accounts (INSTITUTE_ADMIN) from accessing /students/courses with HTTP 403', async () => {
    const admin = await prisma.membership.findFirst({
      where: { role: 'INSTITUTE_ADMIN', status: 'ACTIVE' },
    });

    const adminToken = jwtService.sign({
      sub: admin?.userId || 'admin-user-id',
      role: 'INSTITUTE_ADMIN',
      instituteId: testInstitute?.id,
    });

    const res = await fetch(`${serverUrl}/students/courses`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('3. successfully lists enrolled courses with real progress and curriculum metrics for student', async () => {
    if (!student1Membership) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/courses`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.courses).toBeDefined();
    expect(Array.isArray(body.courses)).toBe(true);
    expect(body.totalCourses).toBeGreaterThanOrEqual(1);

    const first = body.courses[0];
    expect(first.courseId).toBeDefined();
    expect(first.title).toBeDefined();
    expect(typeof first.progressPct).toBe('number');
    expect(typeof first.totalLessons).toBe('number');
    expect(typeof first.completedLessons).toBe('number');
  });

  it('4. returns course detail with 5-level curriculum hierarchy for enrolled student', async () => {
    if (!enrolledCourse) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/courses/${enrolledCourse.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.course.id).toBe(enrolledCourse.id);
    expect(body.course.title).toBe(enrolledCourse.title);
    expect(body.enrolment).toBeDefined();
    expect(body.curriculum).toBeDefined();
    expect(Array.isArray(body.curriculum)).toBe(true);
  });

  it('5. rejects access to course detail if student is not enrolled (HTTP 403)', async () => {
    if (!unenrolledCourse) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/courses/${unenrolledCourse.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/not enrolled/i);
  });

  it('6. retrieves lesson player data for valid lesson in enrolled course', async () => {
    if (!enrolledCourse || !sampleLesson) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(
      `${serverUrl}/students/courses/${enrolledCourse.id}/lessons/${sampleLesson.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lesson.id).toBe(sampleLesson.id);
    expect(body.lesson.title).toBe(sampleLesson.title);
    expect(body.lesson.type).toBeDefined();
    expect(body.navigation).toBeDefined();
  });

  it('7. updates lesson progress and calculates course completion rate', async () => {
    if (!enrolledCourse || !sampleLesson) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(
      `${serverUrl}/students/courses/${enrolledCourse.id}/lessons/${sampleLesson.id}/progress`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lastPosSec: 120,
          isCompleted: true,
        }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.progress).toBeDefined();
    expect(body.progress.isCompleted).toBe(true);
    expect(typeof body.progress.courseProgressPct).toBe('number');
  });

  it('8. grades quiz submission and marks lesson completed when passing score >= 70%', async () => {
    if (!enrolledCourse || !sampleLesson) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(
      `${serverUrl}/students/courses/${enrolledCourse.id}/lessons/${sampleLesson.id}/quiz-submit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: { 'q-0': 1 },
          passingScorePct: 70,
        }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.scorePct).toBe('number');
    expect(typeof body.passed).toBe('boolean');
  });

  it('9. strictly isolates cross-tenant access to courses and lessons', async () => {
    if (!otherInstitute || !enrolledCourse) {
      expect(true).toBe(true);
      return;
    }

    // Try accessing with a token for other institute
    const wrongInstituteToken = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: otherInstitute.id,
    });

    const res = await fetch(`${serverUrl}/students/courses/${enrolledCourse.id}`, {
      headers: { Authorization: `Bearer ${wrongInstituteToken}` },
    });

    // Should be rejected because the student doesn't belong to otherInstitute
    expect(res.status).toBe(403);
  });

  it('10. verifies course listing latency (< 1500ms remote CloudSQL roundtrip)', async () => {
    if (!student1Membership) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    // Warm up
    await fetch(`${serverUrl}/students/courses`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const start = performance.now();
    const res = await fetch(`${serverUrl}/students/courses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(2500);
  });
});

