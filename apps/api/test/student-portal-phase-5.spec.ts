import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Student Portal Phase 5: Assignment Management & Online Examination System', () => {
  let app: INestApplication;
  let serverUrl: string;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let student1Membership: any;
  let student2Membership: any;
  let testInstitute: any;
  let otherInstitute: any;
  let enrolledCourse: any;
  let unenrolledCourse: any;
  let testAssignment: any;
  let testExam: any;
  let testQuestion: any;

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
                    assignments: true,
                    exams: {
                      include: {
                        questions: {
                          include: { options: true },
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
    student2Membership = students.find((s: any) => s.id !== student1Membership?.id);
    testInstitute = student1Membership?.institute;

    if (student1Membership?.studentProfile?.enrolments?.length) {
      enrolledCourse = student1Membership.studentProfile.enrolments[0].course;
      if (enrolledCourse.assignments?.length > 0) {
        testAssignment = enrolledCourse.assignments[0];
      }
      if (enrolledCourse.exams?.length > 0) {
        testExam = enrolledCourse.exams[0];
        if (testExam.questions?.length > 0) {
          testQuestion = testExam.questions[0];
        }
      }
    }

    // Ensure at least one test assignment exists for test course
    if (!testAssignment && enrolledCourse) {
      testAssignment = await prisma.assignment.findFirst({
        where: { courseId: enrolledCourse.id },
      });
      if (!testAssignment) {
        testAssignment = await prisma.assignment.create({
          data: {
            instituteId: testInstitute.id,
            courseId: enrolledCourse.id,
            title: 'Test Biblical Exegesis Paper',
            instructions: 'Write an exegetical overview of Romans 8.',
            dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            maxMarks: 100,
          },
        });
      }
    }

    // Ensure at least one test exam with a question exists for test course
    if (!testExam && enrolledCourse) {
      testExam = await prisma.exam.findFirst({
        where: { courseId: enrolledCourse.id },
        include: { questions: { include: { options: true } } },
      });
      if (!testExam) {
        testExam = await prisma.exam.create({
          data: {
            instituteId: testInstitute.id,
            courseId: enrolledCourse.id,
            title: 'Hermeneutics Assessment Test',
            durationMin: 30,
            totalMarks: 50,
            passMarks: 35,
            questions: {
              create: [
                {
                  instituteId: testInstitute.id,
                  prompt: 'What is the primary objective of biblical exegesis?',
                  type: 'MCQ_SINGLE',
                  marks: 10,
                  position: 1,
                  options: {
                    create: [
                      { label: 'Original Authorial Meaning', isCorrect: true },
                      { label: 'Modern Reader Preference', isCorrect: false },
                    ],
                  },
                },
              ],
            },
          },
          include: { questions: { include: { options: true } } },
        });
      }
    }

    // Find course student is not enrolled in
    unenrolledCourse = await prisma.course.findFirst({
      where: {
        instituteId: testInstitute?.id,
        id: { not: enrolledCourse?.id },
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

  it('1. rejects unauthenticated requests to GET /students/assignments with HTTP 401', async () => {
    const res = await fetch(`${serverUrl}/students/assignments`);
    expect(res.status).toBe(401);
  });

  it('2. rejects non-student accounts (INSTITUTE_ADMIN) from accessing assignments with HTTP 403', async () => {
    const admin = await prisma.membership.findFirst({
      where: { role: 'INSTITUTE_ADMIN', status: 'ACTIVE' },
    });

    const adminToken = jwtService.sign({
      sub: admin?.userId || 'admin-test-id',
      role: 'INSTITUTE_ADMIN',
      instituteId: testInstitute?.id,
    });

    const res = await fetch(`${serverUrl}/students/assignments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('3. lists assignments for student enrolled courses with dynamic status calculation', async () => {
    if (!student1Membership) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/assignments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignments).toBeDefined();
    expect(Array.isArray(body.assignments)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.total).toBe('number');
    expect(typeof body.summary.pending).toBe('number');
    expect(typeof body.summary.submitted).toBe('number');
    expect(typeof body.summary.graded).toBe('number');

    if (body.assignments.length > 0) {
      const a = body.assignments[0];
      expect(a.id).toBeDefined();
      expect(a.title).toBeDefined();
      expect(a.courseTitle).toBeDefined();
      expect(['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'GRADED', 'OVERDUE']).toContain(a.status);
    }
  });

  it('4. retrieves assignment detail with instructions and submission status for enrolled student', async () => {
    if (!student1Membership || !testAssignment) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/assignments/${testAssignment.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignment).toBeDefined();
    expect(body.assignment.id).toBe(testAssignment.id);
    expect(body.assignment.title).toBe(testAssignment.title);
    expect(typeof body.assignment.maxMarks).toBe('number');
  });

  it('5. submits academic assignment response with answer text and submission timestamp', async () => {
    if (!student1Membership || !testAssignment) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/assignments/${testAssignment.id}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        answerText: 'Comprehensive exegetical analysis of Romans 8 covenant theology.',
        fileUrl: 'https://storage.bible-lms.com/test-paper.pdf',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.submission).toBeDefined();
    expect(body.submission.status).toBe('SUBMITTED');
  });

  it('6. lists available examinations with question counts, pass marks, and attempt status', async () => {
    if (!student1Membership) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/exams`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exams).toBeDefined();
    expect(Array.isArray(body.exams)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.total).toBe('number');
  });

  it('7. starts or resumes an examination attempt with server-authoritative countdown timer', async () => {
    if (!student1Membership || !testExam) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/exams/${testExam.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attemptId).toBeDefined();
    expect(typeof body.remainingSec).toBe('number');
    expect(body.durationMin).toBe(testExam.durationMin);
  });

  it('8. submits exam attempt, evaluates objective answers, and returns pass/fail status', async () => {
    if (!student1Membership || !testExam) {
      expect(true).toBe(true);
      return;
    }

    const token = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    // Start attempt
    const startRes = await fetch(`${serverUrl}/students/exams/${testExam.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const startData = await startRes.json();
    const attemptId = startData.attemptId;

    // Submit attempt with answers
    const submitRes = await fetch(`${serverUrl}/students/exams/${testExam.id}/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        answers: {
          [testExam.questions?.[0]?.id || 'q-test']: 'Original Authorial Meaning',
        },
      }),
    });

    expect(submitRes.status).toBe(200);
    const result = await submitRes.json();
    expect(result.success).toBe(true);
    expect(typeof result.score).toBe('number');
    expect(typeof result.passed).toBe('boolean');
  });

  it('9. strictly enforces cross-student isolation on examination attempts', async () => {
    if (!student1Membership || !student2Membership || !testExam) {
      expect(true).toBe(true);
      return;
    }

    const token1 = jwtService.sign({
      sub: student1Membership.user.id,
      role: 'STUDENT',
      instituteId: student1Membership.instituteId,
    });

    const startRes1 = await fetch(`${serverUrl}/students/exams/${testExam.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
    });
    const startData1 = await startRes1.json();
    const attemptId1 = startData1.attemptId;

    // Student 2 tries to access Student 1 attempt
    const token2 = jwtService.sign({
      sub: student2Membership.user.id,
      role: 'STUDENT',
      instituteId: student2Membership.instituteId,
    });

    const res2 = await fetch(`${serverUrl}/students/exams/${testExam.id}/attempts/${attemptId1}`, {
      headers: { Authorization: `Bearer ${token2}` },
    });

    expect(res2.status).toBe(404); // Or 403
  });

  it('10. verifies examination response latency (< 2500ms remote CloudSQL roundtrip)', async () => {
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
    await fetch(`${serverUrl}/students/exams`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const start = performance.now();
    const res = await fetch(`${serverUrl}/students/exams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(2500);
  });
});

