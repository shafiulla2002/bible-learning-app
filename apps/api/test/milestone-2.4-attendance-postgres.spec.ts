import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { AttendanceService } from '../src/modules/attendance/attendance.service';

function getTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const l of lines) {
      if (l.startsWith('TEST_DATABASE_URL=')) {
        return l.slice('TEST_DATABASE_URL='.length).trim().replace(/^"|"$/g, '');
      }
    }
  }
  throw new Error('TEST_DATABASE_URL not found in process.env or apps/api/.env');
}

describe('Milestone 2.4 — Attendance PostgreSQL Constraints & Integration Suite', () => {
  let prisma: PrismaClient;
  let service: AttendanceService;

  const testSuffix = Date.now().toString().slice(-6);
  const testInstituteSlug = `pg-att-inst-${testSuffix}`;
  let instituteId: string;
  let teacherUser1Id: string;
  let teacherUser2Id: string;
  let teacherProfile1Id: string;
  let studentUser1Id: string;
  let studentUser2Id: string;
  let studentProfile1Id: string;
  let studentProfile2Id: string;
  let courseId: string;
  let batchId: string;
  let enrolment1Id: string;
  let enrolment2Id: string;
  let liveSession1Id: string;
  let liveSession2Id: string;

  beforeAll(async () => {
    const url = getTestDbUrl();
    prisma = new PrismaClient({
      datasources: { db: { url } },
    });
    await prisma.$connect();
    service = new AttendanceService(prisma as any);

    // 1. Institute
    const institute = await prisma.institute.create({
      data: {
        name: `PostgreSQL Attendance Test Institute ${testSuffix}`,
        slug: testInstituteSlug,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
      },
    });
    instituteId = institute.id;

    // 2. Category & Course
    const category = await prisma.courseCategory.create({
      data: {
        instituteId,
        name: `Theology ${testSuffix}`,
        slug: `theology-${testSuffix}`,
      },
    });

    const course = await prisma.course.create({
      data: {
        instituteId,
        categoryId: category.id,
        title: `Theology & Biblical Languages ${testSuffix}`,
        slug: `theo-lang-${testSuffix}`,
        description: 'Comprehensive theological foundation',
        status: 'PUBLISHED',
      },
    });
    courseId = course.id;

    // 3. Batch
    const batch = await prisma.batch.create({
      data: {
        instituteId,
        courseId: course.id,
        name: `Cohort Gamma ${testSuffix}`,
        code: `GAMMA-${testSuffix}`,
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-15'),
        capacity: 50,
      },
    });
    batchId = batch.id;

    // 4. Teacher 1 (assigned to batch)
    const teacher1 = await prisma.user.create({
      data: {
        fullName: `Prof. Assigned Teacher ${testSuffix}`,
        phoneE164: `+91971${testSuffix}01`,
        email: `teacher1.${testSuffix}@example.com`,
        memberships: {
          create: {
            instituteId,
            role: 'TEACHER',
            teacherProfile: {
              create: {
                instituteId,
                employeeCode: `EMP-A-${testSuffix}`,
                specialization: 'Hermeneutics',
              },
            },
          },
        },
      },
      include: {
        memberships: {
          include: { teacherProfile: true },
        },
      },
    });
    teacherUser1Id = teacher1.id;
    teacherProfile1Id = teacher1.memberships[0].teacherProfile!.id;

    // Assign Teacher 1 to Batch
    await prisma.batchTeacher.create({
      data: {
        instituteId,
        batchId,
        teacherProfileId: teacherProfile1Id,
        role: 'LEAD',
      },
    });

    // 5. Teacher 2 (NOT assigned to batch)
    const teacher2 = await prisma.user.create({
      data: {
        fullName: `Prof. Unassigned Teacher ${testSuffix}`,
        phoneE164: `+91971${testSuffix}02`,
        email: `teacher2.${testSuffix}@example.com`,
        memberships: {
          create: {
            instituteId,
            role: 'TEACHER',
            teacherProfile: {
              create: {
                instituteId,
                employeeCode: `EMP-B-${testSuffix}`,
                specialization: 'Systematic Theology',
              },
            },
          },
        },
      },
    });
    teacherUser2Id = teacher2.id;

    // 6. Student 1
    const student1 = await prisma.user.create({
      data: {
        fullName: `Student Alpha ${testSuffix}`,
        phoneE164: `+91971${testSuffix}03`,
        email: `student1.${testSuffix}@example.com`,
        memberships: {
          create: {
            instituteId,
            role: 'STUDENT',
            studentProfile: {
              create: {
                instituteId,
                admissionNo: `ADM-A-${testSuffix}`,
              },
            },
          },
        },
      },
      include: {
        memberships: {
          include: { studentProfile: true },
        },
      },
    });
    studentUser1Id = student1.id;
    studentProfile1Id = student1.memberships[0].studentProfile!.id;

    // 7. Student 2
    const student2 = await prisma.user.create({
      data: {
        fullName: `Student Beta ${testSuffix}`,
        phoneE164: `+91971${testSuffix}04`,
        email: `student2.${testSuffix}@example.com`,
        memberships: {
          create: {
            instituteId,
            role: 'STUDENT',
            studentProfile: {
              create: {
                instituteId,
                admissionNo: `ADM-B-${testSuffix}`,
              },
            },
          },
        },
      },
      include: {
        memberships: {
          include: { studentProfile: true },
        },
      },
    });
    studentUser2Id = student2.id;
    studentProfile2Id = student2.memberships[0].studentProfile!.id;

    // Enrol students in Course & Batch
    const e1 = await prisma.enrolment.create({
      data: {
        instituteId,
        courseId,
        batchId,
        studentProfileId: studentProfile1Id,
        status: 'ACTIVE',
      },
    });
    enrolment1Id = e1.id;

    const e2 = await prisma.enrolment.create({
      data: {
        instituteId,
        courseId,
        batchId,
        studentProfileId: studentProfile2Id,
        status: 'ACTIVE',
      },
    });
    enrolment2Id = e2.id;

    // Live Sessions for batch
    const ls1 = await prisma.liveSession.create({
      data: {
        instituteId,
        batchId,
        teacherProfileId: teacherProfile1Id,
        title: `Morning Biblical Exegesis ${testSuffix}`,
        startsAt: new Date('2026-11-01T09:00:00Z'),
        endsAt: new Date('2026-11-01T10:00:00Z'),
      },
    });
    liveSession1Id = ls1.id;

    const ls2 = await prisma.liveSession.create({
      data: {
        instituteId,
        batchId,
        teacherProfileId: teacherProfile1Id,
        title: `Afternoon Biblical Hermeneutics ${testSuffix}`,
        startsAt: new Date('2026-11-01T14:00:00Z'),
        endsAt: new Date('2026-11-01T15:00:00Z'),
      },
    });
    liveSession2Id = ls2.id;
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (instituteId) {
        try {
          await prisma.institute.delete({ where: { id: instituteId } });
        } catch {
          // Best effort cleanup
        }
      }
      await prisma.$disconnect();
    }
  });

  describe('PostgreSQL Partial Unique Indexes Verification', () => {
    it('enforces Attendance_daily_batch_unique: rejects duplicate DAILY_BATCH on same date at DB level', async () => {
      const calDate = new Date('2026-11-05T00:00:00Z');

      // First daily batch attendance insertion
      await prisma.attendance.create({
        data: {
          instituteId,
          batchId,
          studentProfileId: studentProfile1Id,
          enrolmentId: enrolment1Id,
          date: calDate,
          mode: 'DAILY_BATCH',
          status: 'PRESENT',
          markedById: teacherUser1Id,
          markedByRole: 'TEACHER',
        },
      });

      // Second attempt with same student, batch, and date -> DB UNIQUE CONSTRAINT REJECTION
      await expect(
        prisma.attendance.create({
          data: {
            instituteId,
            batchId,
            studentProfileId: studentProfile1Id,
            enrolmentId: enrolment1Id,
            date: calDate,
            mode: 'DAILY_BATCH',
            status: 'LATE',
            markedById: teacherUser1Id,
            markedByRole: 'TEACHER',
          },
        }),
      ).rejects.toThrow();

      // Insertion on a DIFFERENT calendar date succeeds cleanly
      const diffDate = new Date('2026-11-06T00:00:00Z');
      const diffRec = await prisma.attendance.create({
        data: {
          instituteId,
          batchId,
          studentProfileId: studentProfile1Id,
          enrolmentId: enrolment1Id,
          date: diffDate,
          mode: 'DAILY_BATCH',
          status: 'PRESENT',
          markedById: teacherUser1Id,
          markedByRole: 'TEACHER',
        },
      });
      expect(diffRec.id).toBeDefined();
    });

    it('enforces Attendance_live_session_unique: allows multiple live sessions on same date, rejects duplicate on same session', async () => {
      const sessionDate = new Date('2026-11-01T00:00:00Z');

      // Attendance for Live Session 1
      const rec1 = await prisma.attendance.create({
        data: {
          instituteId,
          batchId,
          studentProfileId: studentProfile1Id,
          enrolmentId: enrolment1Id,
          date: sessionDate,
          mode: 'LIVE_SESSION',
          liveSessionId: liveSession1Id,
          status: 'PRESENT',
          markedById: teacherUser1Id,
          markedByRole: 'TEACHER',
        },
      });
      expect(rec1.id).toBeDefined();

      // Attendance for Live Session 2 on SAME calendar date - MUST SUCCEED!
      const rec2 = await prisma.attendance.create({
        data: {
          instituteId,
          batchId,
          studentProfileId: studentProfile1Id,
          enrolmentId: enrolment1Id,
          date: sessionDate,
          mode: 'LIVE_SESSION',
          liveSessionId: liveSession2Id,
          status: 'PRESENT',
          markedById: teacherUser1Id,
          markedByRole: 'TEACHER',
        },
      });
      expect(rec2.id).toBeDefined();

      // Duplicate attendance for Live Session 1 - MUST BE REJECTED!
      await expect(
        prisma.attendance.create({
          data: {
            instituteId,
            batchId,
            studentProfileId: studentProfile1Id,
            enrolmentId: enrolment1Id,
            date: sessionDate,
            mode: 'LIVE_SESSION',
            liveSessionId: liveSession1Id,
            status: 'ABSENT',
            markedById: teacherUser1Id,
            markedByRole: 'TEACHER',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Attendance Service Multi-Tenant & Teacher Scoping', () => {
    it('allows assigned teacher to fetch roster and rejects unassigned teacher with 403', async () => {
      // Assigned teacher
      const roster = await service.getBatchRosterForDate(
        instituteId,
        batchId,
        '2026-11-10',
        undefined,
        { userId: teacherUser1Id, role: 'TEACHER' },
      );
      expect(roster.batchId).toBe(batchId);
      expect(roster.roster.length).toBe(2);

      // Unassigned teacher
      await expect(
        service.getBatchRosterForDate(
          instituteId,
          batchId,
          '2026-11-10',
          undefined,
          { userId: teacherUser2Id, role: 'TEACHER' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('executes atomic bulk attendance marking and updates existing records with audit trail', async () => {
      const markDate = '2026-11-12';

      // Mark initial attendance
      const result = await service.markBulkAttendance(
        instituteId,
        {
          batchId,
          date: markDate,
          mode: 'DAILY_BATCH',
          records: [
            { studentProfileId: studentProfile1Id, status: 'PRESENT', remarks: 'On time' },
            { studentProfileId: studentProfile2Id, status: 'LATE', remarks: '5 mins late' },
          ],
        },
        { sub: teacherUser1Id, role: 'TEACHER' },
      );

      expect(result.createdCount).toBe(2);

      // Verify records in DB
      const history = await service.getBatchAttendanceHistory(instituteId, batchId, {
        startDate: markDate,
        endDate: markDate,
      });
      expect(history.data.length).toBe(2);

      const student1Record = history.data.find((r) => r.studentProfileId === studentProfile1Id);
      expect(student1Record?.status).toBe('PRESENT');

      // Update student 1 record to EXCUSED with audit trail
      const updated = await service.updateIndividualAttendance(
        instituteId,
        student1Record!.id,
        {
          status: 'EXCUSED',
          remarks: 'Approved medical absence',
        },
        { sub: teacherUser1Id, role: 'TEACHER' },
      );

      expect(updated.status).toBe('EXCUSED');

      // Verify Audit Log entry was recorded in PostgreSQL
      const auditLogs = await prisma.attendanceAuditLog.findMany({
        where: { attendanceId: student1Record!.id },
      });
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].previousStatus).toBe('PRESENT');
      expect(auditLogs[0].newStatus).toBe('EXCUSED');
      expect(auditLogs[0].newRemarks).toBe('Approved medical absence');
      expect(auditLogs[0].changedById).toBe(teacherUser1Id);
    });
  });

  describe('Student Access Control & Accuracy Policy', () => {
    it('permits student to view own history and blocks student from viewing another student', async () => {
      // Student 1 views own history
      const myHistory = await service.getStudentAttendanceHistory(
        instituteId,
        studentProfile1Id,
        {},
        { userId: studentUser1Id, role: 'STUDENT' },
      );
      expect(myHistory.student.id).toBe(studentProfile1Id);
      expect(myHistory.records.length).toBeGreaterThan(0);

      // Student 1 attempts to view Student 2's history
      await expect(
        service.getStudentAttendanceHistory(
          instituteId,
          studentProfile2Id,
          {},
          { userId: studentUser1Id, role: 'STUDENT' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('calculates institute attendance KPI overview according to policy formula', async () => {
      const overview = await service.getOverview(instituteId, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      });

      expect(overview.summary.totalRecords).toBeGreaterThan(0);
      expect(overview.batches.length).toBe(1);
      expect(overview.batches[0].batchId).toBe(batchId);

      // Verified formula: ((Present + Late) / (Total - Excused)) * 100
      const applicable = overview.summary.totalRecords - overview.summary.excusedCount;
      if (applicable > 0) {
        const expectedRate = Math.round(
          ((overview.summary.presentCount + overview.summary.lateCount) / applicable) * 100,
        );
        expect(overview.summary.attendancePercentage).toBe(expectedRate);
      }
    });

    it('exports well-formed CSV report for the institute', async () => {
      const csv = await service.exportAttendanceReport(instituteId, {
        batchId,
      });

      expect(csv).toContain('Date,Batch,Course,Admission No,Student Name,Mode,Status,Remarks,Session Title,Marked At');
      expect(csv).toContain('Cohort Gamma');
    });
  });
});
