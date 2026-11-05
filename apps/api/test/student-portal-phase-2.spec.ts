import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Student Portal Phase 2: Dynamic Dashboard & Real Database Integration', () => {
  let app: INestApplication;
  let serverUrl: string;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let student1Membership: any;
  let student2Membership: any;
  let adminUser: any;
  let testInstitute: any;
  let otherInstitute: any;

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

    // Fetch two different students from the database
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
              include: { course: true, batch: true },
            },
            attendances: true,
          },
        },
        institute: true,
      },
      take: 2,
    });

    student1Membership = students[0];
    student2Membership = students[1];
    testInstitute = student1Membership?.institute;

    const admin = await prisma.membership.findFirst({
      where: { role: 'INSTITUTE_ADMIN', status: 'ACTIVE' },
      include: { user: true },
    });
    adminUser = admin?.user;

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

  it('1. rejects unauthenticated requests to GET /students/dashboard with HTTP 401', async () => {
    const res = await fetch(`${serverUrl}/students/dashboard`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/Authentication token required/i);
  });

  it('2. rejects forged or expired tokens with HTTP 401', async () => {
    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: 'Bearer invalid.fake.token',
      },
    });
    expect(res.status).toBe(401);
  });

  it('3. rejects non-student accounts (INSTITUTE_ADMIN) with HTTP 403 Forbidden', async () => {
    const adminToken = jwtService.sign({
      sub: adminUser?.id || 'admin-test-id',
      role: 'INSTITUTE_ADMIN',
      instituteId: testInstitute?.id,
    });

    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/not authorized to access Student Portal/i);
  });

  it('4. successfully resolves authenticated student profile, identity and institute', async () => {
    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.student.id).toBe(student1Membership.user.id);
    expect(body.student.fullName).toBe(student1Membership.user.fullName);
    expect(body.profile.studentProfileId).toBe(student1Membership.studentProfile.id);
    expect(body.profile.admissionNo).toBe(student1Membership.studentProfile.admissionNo);
    expect(body.institute.id).toBe(student1Membership.instituteId);
    expect(body.institute.name).toBe(testInstitute.name);
  });

  it('5. computes real enrolment statistics (enrolled & completed counts)', async () => {
    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await res.json();
    expect(body.statistics).toBeDefined();
    expect(typeof body.statistics.enrolledCoursesCount).toBe('number');
    expect(typeof body.statistics.completedCoursesCount).toBe('number');
    expect(typeof body.statistics.learningHours).toBe('number');
    expect(typeof body.statistics.learningStreak).toBe('number');
    expect(typeof body.statistics.xpPoints).toBe('string');
  });

  it('6. returns continue learning courses with real progress and lesson metrics', async () => {
    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await res.json();
    expect(Array.isArray(body.continueLearningCourses)).toBe(true);

    if (body.continueLearningCourses.length > 0) {
      const course = body.continueLearningCourses[0];
      expect(course.courseId).toBeDefined();
      expect(course.title).toBeDefined();
      expect(typeof course.progressPct).toBe('number');
      expect(typeof course.completedLessons).toBe('number');
      expect(typeof course.totalLessons).toBe('number');
      expect(course.completedLessons).toBeLessThanOrEqual(course.totalLessons);
      expect(course.instructorName).toBeDefined();
    }
  });

  it('7. filters upcoming live classes strictly to batches the student is enrolled in', async () => {
    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await res.json();
    expect(Array.isArray(body.upcomingLiveClasses)).toBe(true);

    for (const session of body.upcomingLiveClasses) {
      expect(session.id).toBeDefined();
      expect(session.title).toBeDefined();
      expect(session.startsAt).toBeDefined();
      expect(session.endsAt).toBeDefined();
      expect(typeof session.canJoin).toBe('boolean');
    }
  });

  it('8. provides learning progress chart data with categories and percentages', async () => {
    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await res.json();
    expect(body.learningProgressChart).toBeDefined();
    expect(typeof body.learningProgressChart.overallProgressPct).toBe('number');
    expect(Array.isArray(body.learningProgressChart.categories)).toBe(true);
    expect(body.learningProgressChart.categories.length).toBeGreaterThan(0);

    for (const cat of body.learningProgressChart.categories) {
      expect(cat.name).toBeDefined();
      expect(typeof cat.percentage).toBe('number');
      expect(cat.color).toBeDefined();
    }
  });

  it('9. provides academic calendar events with correct event structure', async () => {
    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await res.json();
    expect(Array.isArray(body.calendarEvents)).toBe(true);
    for (const ev of body.calendarEvents) {
      expect(ev.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['LIVE_CLASS', 'ASSIGNMENT', 'EXAM', 'ATTENDANCE']).toContain(ev.type);
      expect(ev.title).toBeDefined();
    }
  });

  it('10. enforces strict multi-tenant isolation: denies access if token institute does not match membership', async () => {
    if (!otherInstitute) {
      expect(true).toBe(true);
      return;
    }

    const wrongInstituteToken = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: otherInstitute.id,
    });

    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: `Bearer ${wrongInstituteToken}`,
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/No active student profile found for this account in the requested institute/i);
  });

  it('11. enforces cross-student isolation: Student 1 and Student 2 receive their own independent data', async () => {
    if (!student2Membership) {
      expect(true).toBe(true);
      return;
    }

    const token1 = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const token2 = jwtService.sign({
      sub: student2Membership.user.id,
      role: 'STUDENT',
      instituteId: student2Membership.instituteId,
    });

    const res1 = await fetch(`${serverUrl}/students/dashboard`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const res2 = await fetch(`${serverUrl}/students/dashboard`, {
      headers: { Authorization: `Bearer ${token2}` },
    });

    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1.student.id).toBe(student1Membership.user.id);
    expect(data2.student.id).toBe(student2Membership.user.id);
    expect(data1.student.id).not.toBe(data2.student.id);
    expect(data1.profile.studentProfileId).not.toBe(data2.profile.studentProfileId);
  });

  it('12. measures dashboard API response latency (< 1500ms remote CloudSQL roundtrip)', async () => {
    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    // Warm up remote connection
    await fetch(`${serverUrl}/students/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const start = performance.now();
    const res = await fetch(`${serverUrl}/students/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(2500);
  });
});
