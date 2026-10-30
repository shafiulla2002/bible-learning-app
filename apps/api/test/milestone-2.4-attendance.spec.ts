import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { PrismaService } from '../src/core/prisma/prisma.service';

describe('Milestone 2.4 — Attendance Management Unit Suite', () => {
  let service: AttendanceService;
  let mockPrisma: any;

  const instituteId = 'inst-alpha-01';
  const batchId = 'batch-alpha-101';
  const teacherUserId = 'user-teacher-01';
  const teacherProfileId = 'teacher-prof-01';
  const studentProfile1 = 'stud-prof-01';
  const studentProfile2 = 'stud-prof-02';

  beforeEach(async () => {
    mockPrisma = {
      attendance: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      attendanceAuditLog: {
        create: jest.fn(),
      },
      batch: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      enrolment: {
        findMany: jest.fn(),
      },
      studentProfile: {
        findFirst: jest.fn(),
      },
      teacherProfile: {
        findFirst: jest.fn(),
      },
      batchTeacher: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  // ===========================================================================
  // 1. ATTENDANCE PERCENTAGE CALCULATIONS & POLICIES
  // ===========================================================================
  describe('Attendance Percentage Calculation Policy', () => {
    it('calculates attendance percentage as ((Present + Late) / (Total - Excused)) * 100', async () => {
      // 10 Present, 2 Late, 3 Absent, 1 Excused -> Total = 16
      // Applicable Denominator = 16 - 1 = 15
      // Attended = 10 + 2 = 12
      // Rate = (12 / 15) * 100 = 80%
      mockPrisma.attendance.groupBy.mockResolvedValueOnce([
        { status: 'PRESENT', _count: { _all: 10 } },
        { status: 'LATE', _count: { _all: 2 } },
        { status: 'ABSENT', _count: { _all: 3 } },
        { status: 'EXCUSED', _count: { _all: 1 } },
      ]);
      mockPrisma.attendance.count.mockResolvedValueOnce(16);
      mockPrisma.batch.findMany.mockResolvedValueOnce([]);

      const res = await service.getOverview(instituteId, {});

      expect(res.summary.totalRecords).toBe(16);
      expect(res.summary.presentCount).toBe(10);
      expect(res.summary.lateCount).toBe(2);
      expect(res.summary.absentCount).toBe(3);
      expect(res.summary.excusedCount).toBe(1);
      expect(res.summary.attendancePercentage).toBe(80);
    });

    it('returns null (no misleading percentage) when all records are EXCUSED or 0 records exist', async () => {
      // 0 Present, 0 Late, 0 Absent, 2 Excused -> Applicable denominator = 0
      mockPrisma.attendance.groupBy.mockResolvedValueOnce([
        { status: 'EXCUSED', _count: { _all: 2 } },
      ]);
      mockPrisma.attendance.count.mockResolvedValueOnce(2);
      mockPrisma.batch.findMany.mockResolvedValueOnce([]);

      const res = await service.getOverview(instituteId, {});

      expect(res.summary.attendancePercentage).toBeNull();
    });
  });

  // ===========================================================================
  // 2. TEACHER BATCH RESTRICTIONS
  // ===========================================================================
  describe('Teacher Batch Access Boundaries', () => {
    it('allows an assigned teacher to load batch roster and mark attendance', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({
        id: batchId,
        instituteId,
        name: 'Greek Syntax Cohort',
        course: { id: 'c1', title: 'Greek I' },
      });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({
        id: teacherProfileId,
        instituteId,
      });
      mockPrisma.batchTeacher.findFirst.mockResolvedValue({
        batchId,
        teacherProfileId,
        role: 'LEAD',
      });
      mockPrisma.enrolment.findMany.mockResolvedValue([
        {
          id: 'enr-1',
          status: 'ACTIVE',
          createdAt: new Date('2026-06-01'),
          studentProfile: {
            id: studentProfile1,
            admissionNo: 'ADM-001',
            membership: { user: { fullName: 'Hannah', email: 'hannah@test.com' } },
          },
        },
      ]);
      mockPrisma.attendance.findMany.mockResolvedValue([]);

      const roster = await service.getBatchRosterForDate(
        instituteId,
        batchId,
        '2026-09-01',
        undefined,
        { role: 'TEACHER', userId: teacherUserId },
      );

      expect(roster.totalEnrolled).toBe(1);
      expect(roster.roster[0].fullName).toBe('Hannah');
    });

    it('rejects an unassigned teacher attempting to load roster with 403 Forbidden', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({
        id: batchId,
        instituteId,
        name: 'Greek Syntax Cohort',
        course: { id: 'c1', title: 'Greek I' },
      });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({
        id: teacherProfileId,
        instituteId,
      });
      // Not assigned in BatchTeacher!
      mockPrisma.batchTeacher.findFirst.mockResolvedValue(null);

      await expect(
        service.getBatchRosterForDate(
          instituteId,
          batchId,
          '2026-09-01',
          undefined,
          { role: 'TEACHER', userId: teacherUserId },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ===========================================================================
  // 3. ATOMIC BULK ATTENDANCE & AUDIT LOGGING
  // ===========================================================================
  describe('Bulk Attendance Atomic Operations & Audit Trail', () => {
    it('creates attendance records for enrolled students and records audit logs on status updates', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: batchId, instituteId });
      mockPrisma.enrolment.findMany.mockResolvedValue([
        { id: 'enr-1', studentProfileId: studentProfile1 },
      ]);

      // Student 1 already has attendance marked as PRESENT
      mockPrisma.attendance.findFirst.mockResolvedValueOnce({
        id: 'att-1',
        instituteId,
        batchId,
        studentProfileId: studentProfile1,
        status: 'PRESENT',
        remarks: null,
      });

      // Teacher changes status from PRESENT to LATE with remarks
      const res = await service.markBulkAttendance(
        instituteId,
        {
          batchId,
          date: '2026-09-02',
          mode: 'DAILY_BATCH',
          records: [
            {
              studentProfileId: studentProfile1,
              status: 'LATE',
              remarks: 'Arrived 15 minutes late due to traffic',
            },
          ],
        },
        { sub: teacherUserId, role: 'ADMIN' },
      );

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(1);

      // Verify immutable audit log was created with previous and new values
      expect(mockPrisma.attendanceAuditLog.create).toHaveBeenCalledWith({
        data: {
          attendanceId: 'att-1',
          previousStatus: 'PRESENT',
          newStatus: 'LATE',
          previousRemarks: null,
          newRemarks: 'Arrived 15 minutes late due to traffic',
          changedById: teacherUserId,
          changedByRole: 'ADMIN',
        },
      });

      // Verify attendance record was updated
      expect(mockPrisma.attendance.update).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        data: {
          status: 'LATE',
          remarks: 'Arrived 15 minutes late due to traffic',
          updatedById: teacherUserId,
        },
      });
    });

    it('rejects bulk marking if a student is not actively enrolled in the batch', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: batchId, instituteId });
      // No active enrolment found for studentProfile2
      mockPrisma.enrolment.findMany.mockResolvedValue([]);

      await expect(
        service.markBulkAttendance(
          instituteId,
          {
            batchId,
            date: '2026-09-02',
            mode: 'DAILY_BATCH',
            records: [{ studentProfileId: studentProfile2, status: 'PRESENT' }],
          },
          { sub: 'admin-id', role: 'ADMIN' },
        ),
      ).rejects.toThrow(BadRequestException);

      // Verify transaction aborted and no attendance or audit record was saved
      expect(mockPrisma.attendance.create).not.toHaveBeenCalled();
      expect(mockPrisma.attendanceAuditLog.create).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 4. STUDENT PERSONAL ACCESS RESTRICTION
  // ===========================================================================
  describe('Student Access Restrictions', () => {
    it('allows a student to view their own attendance history', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({
        id: studentProfile1,
        admissionNo: 'ADM-001',
        membership: { userId: 'student-user-1', user: { fullName: 'Hannah' } },
        enrolments: [],
      });
      mockPrisma.attendance.findMany.mockResolvedValue([
        {
          id: 'att-1',
          date: new Date('2026-09-01'),
          status: 'PRESENT',
          mode: 'DAILY_BATCH',
          batch: { name: 'Batch Alpha' },
        },
      ]);
      mockPrisma.attendance.groupBy.mockResolvedValue([
        { status: 'PRESENT', _count: { _all: 1 } },
      ]);

      const history = await service.getStudentAttendanceHistory(
        instituteId,
        studentProfile1,
        {},
        { role: 'STUDENT', userId: 'student-user-1' },
      );

      expect(history.student.fullName).toBe('Hannah');
      expect(history.summary.attendancePercentage).toBe(100);
      expect(history.records.length).toBe(1);
    });

    it('rejects a student trying to inspect another student attendance with 403 Forbidden', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({
        id: studentProfile2,
        admissionNo: 'ADM-002',
        membership: { userId: 'other-user', user: { fullName: 'Other' } },
        enrolments: [],
      });

      await expect(
        service.getStudentAttendanceHistory(
          instituteId,
          studentProfile2,
          {},
          { role: 'STUDENT', userId: 'attacker-student-user' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ===========================================================================
  // 5. CSV EXPORT FORMATTING
  // ===========================================================================
  describe('Attendance CSV Export', () => {
    it('generates properly formatted CSV string with headers and escaped fields', async () => {
      mockPrisma.attendance.findMany.mockResolvedValue([
        {
          date: new Date('2026-09-01'),
          mode: 'DAILY_BATCH',
          status: 'PRESENT',
          remarks: 'On time, active participant',
          markedAt: new Date('2026-09-01T10:00:00Z'),
          studentProfile: {
            admissionNo: 'ADM-001',
            membership: { user: { fullName: 'John Doe' } },
          },
          batch: {
            name: 'Cohort Alpha, 2026',
            course: { title: 'Biblical Studies' },
          },
          liveSession: null,
        },
      ]);

      const csv = await service.exportAttendanceReport(instituteId, {}, { role: 'ADMIN', userId: 'u1' });

      expect(csv).toContain('Date,Batch,Course,Admission No,Student Name,Mode,Status,Remarks,Session Title,Marked At');
      expect(csv).toContain('"Cohort Alpha, 2026"');
      expect(csv).toContain('"John Doe"');
      expect(csv).toContain('PRESENT');
    });
  });
});
