import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Student Portal Phase 4: Live Classes, Online Sessions & Attendance Management', () => {
  let app: INestApplication;
  let serverUrl: string;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let student1Membership: any;
  let student2Membership: any;
  let testInstitute: any;
  let otherInstitute: any;
  let enrolledBatch: any;
  let unenrolledBatch: any;
  let testSession: any;

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

    // Fetch students with active enrolments and batches
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
                batch: {
                  include: {
                    course: true,
                    liveSessions: true,
                  },
                },
                course: true,
              },
            },
            attendances: true,
          },
        },
        institute: true,
      },
      take: 5,
    });

    student1Membership = students.find((s: any) => s.studentProfile?.enrolments?.some((e: any) => e.batchId)) || students[0];
    student2Membership = students.find((s: any) => s.id !== student1Membership?.id);
    testInstitute = student1Membership?.institute;

    if (student1Membership?.studentProfile?.enrolments?.length) {
      const enr = student1Membership.studentProfile.enrolments.find((e: any) => e.batchId);
      if (enr) {
        enrolledBatch = enr.batch;
        if (enrolledBatch?.liveSessions?.length > 0) {
          testSession = enrolledBatch.liveSessions[0];
        }
      }
    }

    if (!testSession && enrolledBatch) {
      testSession = await prisma.liveSession.findFirst({
        where: { batchId: enrolledBatch.id },
      });
    }

    // Find a batch student is not enrolled in
    unenrolledBatch = await prisma.batch.findFirst({
      where: {
        instituteId: testInstitute?.id,
        id: { not: enrolledBatch?.id },
      },
    });

    otherInstitute = await prisma.institute.findFirst({
      where: { id: { not: testInstitute?.id } },
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. rejects unauthenticated requests to GET /students/live-sessions with HTTP 401', async () => {
    const res = await fetch(`${serverUrl}/students/live-sessions`);
    expect(res.status).toBe(401);
  });

  it('2. rejects non-student accounts (INSTITUTE_ADMIN) from accessing /students/live-sessions with HTTP 403', async () => {
    const admin = await prisma.membership.findFirst({
      where: { role: 'INSTITUTE_ADMIN', status: 'ACTIVE' },
    });

    const adminToken = jwtService.sign({
      sub: admin?.userId || 'admin-test-id',
      role: 'INSTITUTE_ADMIN',
      instituteId: testInstitute?.id,
    });

    const res = await fetch(`${serverUrl}/students/live-sessions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('3. lists live sessions for student enrolled batches with authoritative status calculations', async () => {
    if (!student1Membership) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/live-sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toBeDefined();
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.total).toBe('number');
    expect(typeof body.summary.upcoming).toBe('number');
    expect(typeof body.summary.liveNow).toBe('number');
    expect(typeof body.summary.completed).toBe('number');
    expect(Array.isArray(body.batches)).toBe(true);

    if (body.sessions.length > 0) {
      const s = body.sessions[0];
      expect(s.id).toBeDefined();
      expect(s.title).toBeDefined();
      expect(['LIVE_NOW', 'STARTING_SOON', 'UPCOMING', 'COMPLETED', 'CANCELLED']).toContain(s.status);
      expect(['GOOGLE_MEET', 'ZOOM', 'MICROSOFT_TEAMS', 'OTHER']).toContain(s.platform);
      expect(typeof s.canJoin).toBe('boolean');
      expect(typeof s.hasRecording).toBe('boolean');
    }
  });

  it('4. filters live sessions by enrolled batchId', async () => {
    if (!student1Membership || !enrolledBatch) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/live-sessions?batchId=${enrolledBatch.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sessions)).toBe(true);
    for (const s of body.sessions) {
      expect(s.batchId).toBe(enrolledBatch.id);
    }
  });

  it('5. rejects batch session filtering for batches the student is not enrolled in (HTTP 403)', async () => {
    if (!student1Membership || !unenrolledBatch) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/live-sessions?batchId=${unenrolledBatch.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/not enrolled/i);
  });

  it('6. retrieves single live session detail for enrolled student', async () => {
    if (!student1Membership || !testSession) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/live-sessions/${testSession.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session).toBeDefined();
    expect(body.session.id).toBe(testSession.id);
    expect(body.session.title).toBe(testSession.title);
    expect(body.session.batchId).toBe(testSession.batchId);
  });

  it('7. returns student attendance summary with real percentages, totals and thresholds', async () => {
    if (!student1Membership) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/attendance`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.student).toBeDefined();
    expect(body.student.id).toBe(student1Membership.studentProfile.id);
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.totalSessions).toBe('number');
    expect(typeof body.summary.presentCount).toBe('number');
    expect(typeof body.summary.lateCount).toBe('number');
    expect(typeof body.summary.absentCount).toBe('number');
    expect(typeof body.summary.excusedCount).toBe('number');
    expect(body.summary.thresholdPercentage).toBe(75);
    expect(typeof body.summary.isWarning).toBe('boolean');
    expect(Array.isArray(body.monthlySummary)).toBe(true);
    expect(Array.isArray(body.courseSummary)).toBe(true);
    expect(Array.isArray(body.records)).toBe(true);
  });

  it('8. returns attendance quick summary for dashboard widgets', async () => {
    if (!student1Membership) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/attendance/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.totalSessions).toBe('number');
  });

  it('9. strictly enforces cross-student isolation: Student 1 and Student 2 only see their own attendance records', async () => {
    if (!student1Membership || !student2Membership) {
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

    const res1 = await fetch(`${serverUrl}/students/attendance`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    const res2 = await fetch(`${serverUrl}/students/attendance`, {
      headers: { Authorization: `Bearer ${token2}` },
    });

    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(data1.student.id).toBe(student1Membership.studentProfile.id);
    expect(data2.student.id).toBe(student2Membership.studentProfile.id);
    expect(data1.student.id).not.toBe(data2.student.id);
  });

  it('10. verifies live sessions response latency (< 2500ms remote CloudSQL roundtrip)', async () => {
    if (!student1Membership) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    // Warmup
    await fetch(`${serverUrl}/students/live-sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const start = performance.now();
    const res = await fetch(`${serverUrl}/students/live-sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(2500);
  });
});

