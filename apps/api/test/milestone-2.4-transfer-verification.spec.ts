import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { BatchesService } from '../src/modules/batches/batches.service';

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

describe('Milestone 2.4 — Verification Check 1: Attendance Calculation After Batch Transfer', () => {
  let prisma: PrismaClient;
  let attendanceService: AttendanceService;
  let batchesService: BatchesService;

  const testSuffix = Date.now().toString().slice(-6);
  const testInstituteSlug = `trans-inst-${testSuffix}`;
  let instituteId: string;
  let courseId: string;
  let batchAId: string;
  let batchBId: string;
  let batchCId: string;
  let studentProfileId: string;
  let otherStudentProfileId: string;
  let teacherUserId: string;

  beforeAll(async () => {
    const url = getTestDbUrl();
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    attendanceService = new AttendanceService(prisma as any);
    batchesService = new BatchesService(prisma as any);

    // 1. Create Institute
    const institute = await prisma.institute.create({
      data: {
        name: `Transfer Verification Institute ${testSuffix}`,
        slug: testInstituteSlug,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
      },
    });
    instituteId = institute.id;

    // 2. Course
    const category = await prisma.courseCategory.create({
      data: {
        instituteId,
        name: `Biblical Exegesis ${testSuffix}`,
        slug: `bib-exegesis-${testSuffix}`,
      },
    });

    const course = await prisma.course.create({
      data: {
        instituteId,
        categoryId: category.id,
        title: `Pauline Epistles & Theology ${testSuffix}`,
        slug: `pauline-theo-${testSuffix}`,
        description: 'In-depth study of Romans and Galatians',
        status: 'PUBLISHED',
      },
    });
    courseId = course.id;

    // 3. Batch A (Starts June 1, 2026)
    const batchA = await prisma.batch.create({
      data: {
        instituteId,
        courseId: course.id,
        name: `Cohort Alpha (Morning) ${testSuffix}`,
        code: `ALPHA-${testSuffix}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-11-30'),
        capacity: 30,
      },
    });
    batchAId = batchA.id;

    // 4. Batch B (Starts June 1, 2026)
    const batchB = await prisma.batch.create({
      data: {
        instituteId,
        courseId: course.id,
        name: `Cohort Beta (Evening) ${testSuffix}`,
        code: `BETA-${testSuffix}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-11-30'),
        capacity: 30,
      },
    });
    batchBId = batchB.id;

    // 5. Batch C (For multiple transfer test)
    const batchC = await prisma.batch.create({
      data: {
        instituteId,
        courseId: course.id,
        name: `Cohort Gamma (Weekend) ${testSuffix}`,
        code: `GAMMA-${testSuffix}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-11-30'),
        capacity: 30,
      },
    });
    batchCId = batchC.id;

    // 6. Teacher User & Assignment to Batch A, B, and C
    const teacherUser = await prisma.user.create({
      data: {
        fullName: `Prof. Nicholas Thomas ${testSuffix}`,
        phoneE164: `+91983${testSuffix}01`,
        email: `teacher.${testSuffix}@example.com`,
        memberships: {
          create: {
            instituteId,
            role: 'TEACHER',
            teacherProfile: {
              create: {
                instituteId,
                employeeCode: `TCHR-${testSuffix}`,
              },
            },
          },
        },
      },
      include: {
        memberships: { include: { teacherProfile: true } },
      },
    });
    teacherUserId = teacherUser.id;
    const teacherProfileId = teacherUser.memberships[0].teacherProfile!.id;

    await prisma.batchTeacher.createMany({
      data: [
        { instituteId, batchId: batchAId, teacherProfileId, role: 'LEAD' },
        { instituteId, batchId: batchBId, teacherProfileId, role: 'LEAD' },
        { instituteId, batchId: batchCId, teacherProfileId, role: 'LEAD' },
      ],
    });

    // 7. Test Student User
    const studentUser = await prisma.user.create({
      data: {
        fullName: `Barnabas Collins ${testSuffix}`,
        phoneE164: `+91983${testSuffix}02`,
        email: `barnabas.${testSuffix}@example.com`,
        memberships: {
          create: {
            instituteId,
            role: 'STUDENT',
            studentProfile: {
              create: {
                instituteId,
                admissionNo: `ADM-BAR-${testSuffix}`,
              },
            },
          },
        },
      },
      include: {
        memberships: { include: { studentProfile: true } },
      },
    });
    studentProfileId = studentUser.memberships[0].studentProfile!.id;

    // 8. Other Student User (remains in Batch A the entire time)
    const otherStudentUser = await prisma.user.create({
      data: {
        fullName: `Timothy Titus ${testSuffix}`,
        phoneE164: `+91983${testSuffix}03`,
        email: `timothy.${testSuffix}@example.com`,
        memberships: {
          create: {
            instituteId,
            role: 'STUDENT',
            studentProfile: {
              create: {
                instituteId,
                admissionNo: `ADM-TIM-${testSuffix}`,
              },
            },
          },
        },
      },
      include: {
        memberships: { include: { studentProfile: true } },
      },
    });
    otherStudentProfileId = otherStudentUser.memberships[0].studentProfile!.id;

    // Enrol other student permanently in Batch A
    await prisma.enrolment.create({
      data: {
        instituteId,
        courseId,
        batchId: batchAId,
        studentProfileId: otherStudentProfileId,
        status: 'ACTIVE',
      },
    });
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (instituteId) {
        try {
          await prisma.institute.delete({ where: { id: instituteId } });
        } catch {
          // Best effort
        }
      }
      await prisma.$disconnect();
    }
  });

  describe('Scenario Execution: June 1 Join Batch A -> Sept 1 Transfer to Batch B', () => {
    let enrolmentId: string;

    it('Step 1: Student joins Batch A on June 1, 2026', async () => {
      const enrolment = await prisma.enrolment.create({
        data: {
          instituteId,
          courseId,
          batchId: batchAId,
          studentProfileId,
          status: 'ACTIVE',
          createdAt: new Date('2026-06-01T08:00:00Z'),
        },
      });
      enrolmentId = enrolment.id;
      expect(enrolment.batchId).toBe(batchAId);
    });

    it('Step 2: Attendance recorded for Batch A during June, July, and August', async () => {
      // 4 sessions marked in Batch A for this student:
      // June 15: PRESENT
      // July 10: PRESENT
      // August 05: LATE
      // August 25: EXCUSED
      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchAId,
          date: '2026-06-15',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId, status: 'PRESENT', remarks: 'Good discussion' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );

      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchAId,
          date: '2026-07-10',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId, status: 'PRESENT', remarks: 'Punctual' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );

      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchAId,
          date: '2026-08-05',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId, status: 'LATE', remarks: 'Transit delay' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );

      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchAId,
          date: '2026-08-25',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId, status: 'EXCUSED', remarks: 'Approved medical leave' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );

      // Verify Batch A attendance before transfer:
      // Applicable = 4 - 1 (excused) = 3. Attended = 2 Present + 1 Late = 3.
      // Expected Rate = round(3/3 * 100) = 100%
      const historyBeforeTransfer = await attendanceService.getStudentAttendanceHistory(
        instituteId,
        studentProfileId,
        { batchId: batchAId },
      );
      expect(historyBeforeTransfer.summary.totalSessions).toBe(4);
      expect(historyBeforeTransfer.summary.presentCount).toBe(2);
      expect(historyBeforeTransfer.summary.lateCount).toBe(1);
      expect(historyBeforeTransfer.summary.excusedCount).toBe(1);
      expect(historyBeforeTransfer.summary.attendancePercentage).toBe(100);
    });

    it('Step 3: Student transfers from Batch A to Batch B on September 1, 2026', async () => {
      // Execute transfer using BatchesService
      const transferResult = await batchesService.transferStudent(
        instituteId,
        {
          studentProfileId,
          sourceBatchId: batchAId,
          targetBatchId: batchBId,
          reason: 'Work schedule shifted to evening cohort',
        },
        teacherUserId,
      );

      expect(transferResult.success).toBe(true);
      expect(transferResult.enrolment.batchId).toBe(batchBId);
      expect(transferResult.transferLog.sourceBatchId).toBe(batchAId);
      expect(transferResult.transferLog.targetBatchId).toBe(batchBId);

      // Verify student is no longer on Batch A active roster for September
      const rosterBatchA = await attendanceService.getBatchRosterForDate(
        instituteId,
        batchAId,
        '2026-09-10',
      );
      const studentInBatchA = rosterBatchA.roster.find((r) => r.studentProfileId === studentProfileId);
      expect(studentInBatchA).toBeUndefined();

      // Verify student IS on Batch B active roster for September
      const rosterBatchB = await attendanceService.getBatchRosterForDate(
        instituteId,
        batchBId,
        '2026-09-10',
      );
      const studentInBatchB = rosterBatchB.roster.find((r) => r.studentProfileId === studentProfileId);
      expect(studentInBatchB).toBeDefined();
    });

    it('Step 4: Attendance is recorded for Batch B during September and October, and Batch A holds separate sessions', async () => {
      // Batch A holds sessions on Sept 10 and Oct 10 for other students
      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchAId,
          date: '2026-09-10',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId: otherStudentProfileId, status: 'PRESENT' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );
      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchAId,
          date: '2026-10-10',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId: otherStudentProfileId, status: 'PRESENT' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );

      // Attempting to mark attendance for transferred student in Batch A is rejected
      await expect(
        attendanceService.markBulkAttendance(
          instituteId,
          {
            batchId: batchAId,
            date: '2026-09-10',
            mode: 'DAILY_BATCH',
            records: [{ studentProfileId, status: 'PRESENT' }],
          },
          { id: teacherUserId, role: 'TEACHER' },
        ),
      ).rejects.toThrow(BadRequestException);

      // 3 sessions recorded in Batch B for the transferred student:
      // Sept 15: PRESENT
      // Oct 05: ABSENT
      // Oct 20: PRESENT
      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchBId,
          date: '2026-09-15',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId, status: 'PRESENT', remarks: 'Active in evening lecture' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );

      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchBId,
          date: '2026-10-05',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId, status: 'ABSENT', remarks: 'Unexcused absence' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );

      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchBId,
          date: '2026-10-20',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId, status: 'PRESENT', remarks: 'On time' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );
    });

    it('Verification A: Batch A attendance includes only applicable sessions before transfer', async () => {
      const historyA = await attendanceService.getStudentAttendanceHistory(
        instituteId,
        studentProfileId,
        { batchId: batchAId },
      );

      // Student has exactly 4 sessions in Batch A (June, July, August)
      expect(historyA.summary.totalSessions).toBe(4);
      expect(historyA.summary.presentCount).toBe(2);
      expect(historyA.summary.lateCount).toBe(1);
      expect(historyA.summary.absentCount).toBe(0);
      expect(historyA.summary.excusedCount).toBe(1);

      // Batch A sessions after transfer (Sept 10, Oct 10) did NOT touch this student:
      // Percentage in Batch A remains exactly round((2+1)/(4-1)*100) = 100%!
      expect(historyA.summary.attendancePercentage).toBe(100);
    });

    it('Verification B: Batch B attendance includes only applicable sessions after transfer', async () => {
      const historyB = await attendanceService.getStudentAttendanceHistory(
        instituteId,
        studentProfileId,
        { batchId: batchBId },
      );

      // Student has exactly 3 sessions in Batch B (Sept 15, Oct 5, Oct 20)
      expect(historyB.summary.totalSessions).toBe(3);
      expect(historyB.summary.presentCount).toBe(2);
      expect(historyB.summary.lateCount).toBe(0);
      expect(historyB.summary.absentCount).toBe(1);
      expect(historyB.summary.excusedCount).toBe(0);

      // Percentage in Batch B = round((2+0)/(3-0)*100) = round(66.666%) = 67%
      expect(historyB.summary.attendancePercentage).toBe(67);
    });

    it('Verification C: Overall student attendance does not double-count sessions and preserves historical access', async () => {
      const overallHistory = await attendanceService.getStudentAttendanceHistory(
        instituteId,
        studentProfileId,
        {},
      );

      // Total records across student's entire journey = 4 (from Batch A) + 3 (from Batch B) = 7
      expect(overallHistory.summary.totalSessions).toBe(7);
      expect(overallHistory.summary.presentCount).toBe(4);
      expect(overallHistory.summary.lateCount).toBe(1);
      expect(overallHistory.summary.absentCount).toBe(1);
      expect(overallHistory.summary.excusedCount).toBe(1);

      // Overall attendance percentage:
      // Applicable denominator = 7 - 1 (excused) = 6
      // Attended = 4 Present + 1 Late = 5
      // Rate = round(5 / 6 * 100) = round(83.333%) = 83%
      expect(overallHistory.summary.attendancePercentage).toBe(83);

      // Historical records remain fully accessible from both batches
      expect(overallHistory.records.length).toBe(7);
      const batchARecords = overallHistory.records.filter((r) => r.batchName.includes('Cohort Alpha'));
      const batchBRecords = overallHistory.records.filter((r) => r.batchName.includes('Cohort Beta'));
      expect(batchARecords.length).toBe(4);
      expect(batchBRecords.length).toBe(3);

      // Batch breakdowns are clearly partitioned
      expect(overallHistory.batchBreakdowns).toBeDefined();
      expect(overallHistory.batchBreakdowns.length).toBe(2);

      const bA = overallHistory.batchBreakdowns.find((b) => b.batchId === batchAId);
      const bB = overallHistory.batchBreakdowns.find((b) => b.batchId === batchBId);
      expect(bA?.attendancePercentage).toBe(100);
      expect(bB?.attendancePercentage).toBe(67);

      // Transfer log is present in student response
      expect(overallHistory.transfers.length).toBe(1);
      expect(overallHistory.transfers[0].sourceBatchId).toBe(batchAId);
      expect(overallHistory.transfers[0].targetBatchId).toBe(batchBId);
      expect(overallHistory.transfers[0].reason).toContain('evening cohort');
    });

    it('Verification D: Multiple transfers (Batch A -> Batch B -> Batch C) preserves complete chain', async () => {
      // Transfer student from Batch B to Batch C
      const transfer2 = await batchesService.transferStudent(
        instituteId,
        {
          studentProfileId,
          sourceBatchId: batchBId,
          targetBatchId: batchCId,
          reason: 'Relocated to weekend intensive',
        },
        teacherUserId,
      );
      expect(transfer2.success).toBe(true);

      // Mark 1 session in Batch C on Nov 10: PRESENT
      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchCId,
          date: '2026-11-10',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId, status: 'PRESENT', remarks: 'Weekend session' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );

      const chainHistory = await attendanceService.getStudentAttendanceHistory(
        instituteId,
        studentProfileId,
        {},
      );

      // Total sessions = 4 (Batch A) + 3 (Batch B) + 1 (Batch C) = 8
      expect(chainHistory.summary.totalSessions).toBe(8);
      expect(chainHistory.summary.presentCount).toBe(5); // 2 (A) + 2 (B) + 1 (C)
      expect(chainHistory.batchBreakdowns.length).toBe(3);

      // Transfer chain has 2 records
      expect(chainHistory.transfers.length).toBe(2);
      expect(chainHistory.transfers[0].sourceBatchId).toBe(batchAId);
      expect(chainHistory.transfers[0].targetBatchId).toBe(batchBId);
      expect(chainHistory.transfers[1].sourceBatchId).toBe(batchBId);
      expect(chainHistory.transfers[1].targetBatchId).toBe(batchCId);
    });

    it('Verification E: Student with no applicable sessions or only EXCUSED returns null rate', async () => {
      // Create student with only EXCUSED session
      const excusedStudent = await prisma.user.create({
        data: {
          fullName: `Lydia Seller ${testSuffix}`,
          phoneE164: `+91983${testSuffix}04`,
          email: `lydia.${testSuffix}@example.com`,
          memberships: {
            create: {
              instituteId,
              role: 'STUDENT',
              studentProfile: {
                create: {
                  instituteId,
                  admissionNo: `ADM-LYD-${testSuffix}`,
                },
              },
            },
          },
        },
        include: { memberships: { include: { studentProfile: true } } },
      });
      const excusedProfileId = excusedStudent.memberships[0].studentProfile!.id;

      await prisma.enrolment.create({
        data: {
          instituteId,
          courseId,
          batchId: batchCId,
          studentProfileId: excusedProfileId,
          status: 'ACTIVE',
        },
      });

      await attendanceService.markBulkAttendance(
        instituteId,
        {
          batchId: batchCId,
          date: '2026-11-15',
          mode: 'DAILY_BATCH',
          records: [{ studentProfileId: excusedProfileId, status: 'EXCUSED', remarks: 'Medical leave' }],
        },
        { id: teacherUserId, role: 'TEACHER' },
      );

      const excusedHistory = await attendanceService.getStudentAttendanceHistory(
        instituteId,
        excusedProfileId,
        {},
      );

      // Total = 1, Excused = 1 -> Applicable = 0
      expect(excusedHistory.summary.totalSessions).toBe(1);
      expect(excusedHistory.summary.excusedCount).toBe(1);
      // Policy requirement: return null, not 0% or NaN!
      expect(excusedHistory.summary.attendancePercentage).toBeNull();
    });
  });
});
