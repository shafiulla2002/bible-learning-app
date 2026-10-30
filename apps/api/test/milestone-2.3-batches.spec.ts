import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { BatchesService } from '../src/modules/batches/batches.service';

describe('Milestone 2.3 — Batches, Academic Terms & Scheduling Audit', () => {
  let service: BatchesService;
  let mockPrisma: any;

  const instituteA = 'inst-alpha-111';
  const instituteB = 'inst-bravo-222';
  const teacherA = 'teach-prof-111';
  const teacherB = 'teach-prof-222';
  const studentA = 'stud-prof-111';

  beforeEach(() => {
    let lockQueue: Promise<void> = Promise.resolve();
    const acquireAdvisoryLock = async () => {
      const current = lockQueue;
      let release: () => void;
      lockQueue = new Promise((resolve) => {
        release = resolve;
      });
      await current;
      return release!;
    };

    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        const release = await acquireAdvisoryLock();
        try {
          return await cb(mockPrisma);
        } finally {
          release();
        }
      }),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ 1: 1 }]),
      academicYear: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      academicTerm: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      batch: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      course: {
        findFirst: jest.fn(),
      },
      teacherProfile: {
        findFirst: jest.fn(),
      },
      studentProfile: {
        findFirst: jest.fn(),
      },
      batchTeacher: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      enrolment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      batchTransferLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      liveSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new BatchesService(mockPrisma);
  });

  // ===========================================================================
  // 1. ACADEMIC PERIODS (YEARS & TERMS)
  // ===========================================================================
  describe('Academic Period Management', () => {
    it('creates an academic year successfully', async () => {
      mockPrisma.academicYear.create.mockResolvedValue({
        id: 'ay-1',
        instituteId: instituteA,
        name: '2026-2027',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
        isCurrent: true,
      });

      mockPrisma.academicYear.findFirst.mockResolvedValue(null);

      const result = await service.createAcademicYear(instituteA, {
        name: '2026-2027',
        startDate: '2026-06-01',
        endDate: '2027-05-31',
        isCurrent: true,
      });

      expect(result.id).toBe('ay-1');
      expect(mockPrisma.academicYear.updateMany).toHaveBeenCalledWith({
        where: { instituteId: instituteA },
        data: { isCurrent: false },
      });
    });

    it('rejects academic year if dates overlap with an existing period in the same institute', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-existing',
        name: '2026-2027 Existing',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
      });

      await expect(
        service.createAcademicYear(instituteA, {
          name: '2026-2027 Overlapping',
          startDate: '2026-10-01',
          endDate: '2027-09-30',
          isCurrent: false,
        }),
      ).rejects.toThrow(/overlap with existing period/);
    });

    it('rejects academic year if startDate >= endDate', async () => {
      await expect(
        service.createAcademicYear(instituteA, {
          name: 'Invalid Year',
          startDate: '2027-06-01',
          endDate: '2026-06-01',
          isCurrent: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces academic term to fall strictly within its Academic Year boundaries (Requirement 6)', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-1',
        instituteId: instituteA,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
      });

      // Term ends after academic year ends
      await expect(
        service.createAcademicTerm(instituteA, {
          academicYearId: 'ay-1',
          name: 'Spring 2027',
          startDate: '2027-01-01',
          endDate: '2027-06-30', // Outside May 31
          isCurrent: false,
        }),
      ).rejects.toThrow(BadRequestException);

      // Term starts before academic year starts
      await expect(
        service.createAcademicTerm(instituteA, {
          academicYearId: 'ay-1',
          name: 'Early Fall',
          startDate: '2026-05-01', // Before June 1
          endDate: '2026-10-31',
          isCurrent: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates academic term within valid boundary', async () => {
      mockPrisma.academicYear.findFirst.mockResolvedValue({
        id: 'ay-1',
        instituteId: instituteA,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
      });

      mockPrisma.academicTerm.create.mockResolvedValue({
        id: 'term-1',
        instituteId: instituteA,
        academicYearId: 'ay-1',
        name: 'Fall Semester',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-12-20'),
        isCurrent: true,
      });

      const term = await service.createAcademicTerm(instituteA, {
        academicYearId: 'ay-1',
        name: 'Fall Semester',
        startDate: '2026-08-01',
        endDate: '2026-12-20',
        isCurrent: true,
      });

      expect(term.id).toBe('term-1');
    });
  });

  // ===========================================================================
  // 2. BATCH CREATION & MULTI-TENANT ISOLATION
  // ===========================================================================
  describe('Batch Creation & Tenancy', () => {
    it('blocks batch creation for non-existent or cross-tenant course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      await expect(
        service.createBatch(instituteA, {
          courseId: 'cross-tenant-course-id',
          name: 'Batch 2026',
          startDate: '2026-07-01',
          endDate: '2026-12-31',
          capacity: 40,
          status: 'ACTIVE',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks batch creation for archived course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({
        id: 'course-archived',
        instituteId: instituteA,
        status: 'ARCHIVED',
      });

      await expect(
        service.createBatch(instituteA, {
          courseId: 'course-archived',
          name: 'Batch 2026',
          startDate: '2026-07-01',
          endDate: '2026-12-31',
          capacity: 40,
          status: 'ACTIVE',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('supports one Lead Teacher and multiple Assistant Teachers (Requirement 5)', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        title: 'Biblical Hermeneutics',
        instituteId: instituteA,
        status: 'PUBLISHED',
      });

      mockPrisma.teacherProfile.findFirst
        .mockResolvedValueOnce({ id: 'teacher-lead', instituteId: instituteA }) // Lead
        .mockResolvedValueOnce({ id: 'teacher-asst-1', instituteId: instituteA }) // Asst 1
        .mockResolvedValueOnce({ id: 'teacher-asst-2', instituteId: instituteA }); // Asst 2

      mockPrisma.batch.create.mockResolvedValue({
        id: 'batch-1',
        instituteId: instituteA,
        name: 'Hermeneutics Cohort A',
        capacity: 35,
      });

      const batch = await service.createBatch(instituteA, {
        courseId: 'course-1',
        name: 'Hermeneutics Cohort A',
        startDate: '2026-07-01',
        endDate: '2026-12-31',
        capacity: 35,
        status: 'ACTIVE',
        leadTeacherProfileId: 'teacher-lead',
        assistantTeacherProfileIds: ['teacher-asst-1', 'teacher-asst-2'],
      });

      expect(batch.id).toBe('batch-1');
      expect(mockPrisma.batchTeacher.create).toHaveBeenCalledTimes(3);
      expect(mockPrisma.batchTeacher.create).toHaveBeenCalledWith({
        data: {
          instituteId: instituteA,
          batchId: 'batch-1',
          teacherProfileId: 'teacher-lead',
          role: 'LEAD',
        },
      });
      expect(mockPrisma.batchTeacher.create).toHaveBeenCalledWith({
        data: {
          instituteId: instituteA,
          batchId: 'batch-1',
          teacherProfileId: 'teacher-asst-1',
          role: 'ASSISTANT',
        },
      });
    });

    it('rejects assigning same teacher as both Lead and Assistant', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({
        id: 'course-1',
        title: 'Theology',
        instituteId: instituteA,
      });

      mockPrisma.teacherProfile.findFirst.mockResolvedValue({
        id: 'teacher-lead',
        instituteId: instituteA,
      });

      await expect(
        service.createBatch(instituteA, {
          courseId: 'course-1',
          name: 'Theology Batch A',
          startDate: '2026-07-01',
          endDate: '2026-12-31',
          capacity: 35,
          status: 'ACTIVE',
          leadTeacherProfileId: 'teacher-lead',
          assistantTeacherProfileIds: ['teacher-lead'], // Duplicate assignment
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===========================================================================
  // 3. BATCH CAPACITY & ENROLMENT LOCKING
  // ===========================================================================
  describe('Batch Capacity Protection (Requirement 3)', () => {
    it('enforces backend capacity limit and rejects over-enrolment', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({
        id: studentA,
        instituteId: instituteA,
      });

      // Batch with capacity 2 and currently has 2 enrolments
      mockPrisma.batch.findFirst.mockResolvedValue({
        id: 'batch-full',
        instituteId: instituteA,
        capacity: 2,
        status: 'ACTIVE',
        _count: { enrolments: 2 },
      });

      await expect(
        service.enrollStudent(instituteA, 'batch-full', studentA),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows enrolment when under capacity', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({
        id: studentA,
        instituteId: instituteA,
      });

      mockPrisma.batch.findFirst.mockResolvedValue({
        id: 'batch-open',
        courseId: 'course-1',
        instituteId: instituteA,
        capacity: 50,
        status: 'ACTIVE',
        _count: { enrolments: 49 },
      });

      mockPrisma.enrolment.findFirst.mockResolvedValue(null);
      mockPrisma.enrolment.create.mockResolvedValue({
        id: 'enrol-new',
        studentProfileId: studentA,
        batchId: 'batch-open',
        courseId: 'course-1',
      });

      const res = await service.enrollStudent(instituteA, 'batch-open', studentA);
      expect(res.id).toBe('enrol-new');
    });

    it('rejects enrolment in archived or cancelled batches', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({
        id: studentA,
        instituteId: instituteA,
      });

      mockPrisma.batch.findFirst.mockResolvedValue({
        id: 'batch-archived',
        instituteId: instituteA,
        status: 'ARCHIVED',
        capacity: 50,
        _count: { enrolments: 0 },
      });

      await expect(
        service.enrollStudent(instituteA, 'batch-archived', studentA),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ===========================================================================
  // 4. STUDENT BATCH TRANSFERS (Requirement 2)
  // ===========================================================================
  describe('Student Batch Transfers with Audit Trail', () => {
    it('verifies source and target batches belong to same institute and course', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({
        id: studentA,
        instituteId: instituteA,
      });

      mockPrisma.batch.findFirst
        .mockResolvedValueOnce({
          id: 'batch-src',
          instituteId: instituteA,
          courseId: 'course-A',
        })
        .mockResolvedValueOnce({
          id: 'batch-tgt',
          instituteId: instituteA,
          courseId: 'course-B', // Different course!
          status: 'ACTIVE',
          capacity: 30,
          _count: { enrolments: 10 },
        });

      await expect(
        service.transferStudent(
          instituteA,
          {
            studentProfileId: studentA,
            sourceBatchId: 'batch-src',
            targetBatchId: 'batch-tgt',
            reason: 'Relocating to evening batch',
          },
          'admin-user-id',
        ),
      ).rejects.toThrow(/same course/);
    });

    it('executes atomic transfer and records immutable transfer log', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({
        id: studentA,
        instituteId: instituteA,
      });

      mockPrisma.batch.findFirst
        .mockResolvedValueOnce({
          id: 'batch-src',
          instituteId: instituteA,
          courseId: 'course-A',
        })
        .mockResolvedValueOnce({
          id: 'batch-tgt',
          instituteId: instituteA,
          courseId: 'course-A', // Same course
          status: 'ACTIVE',
          capacity: 30,
          _count: { enrolments: 12 },
        });

      mockPrisma.enrolment.findFirst.mockResolvedValue({
        id: 'enrol-1',
        studentProfileId: studentA,
        batchId: 'batch-src',
      });

      mockPrisma.enrolment.update.mockResolvedValue({
        id: 'enrol-1',
        studentProfileId: studentA,
        batchId: 'batch-tgt',
      });

      mockPrisma.batchTransferLog.create.mockResolvedValue({
        id: 'log-1',
        instituteId: instituteA,
        studentProfileId: studentA,
        sourceBatchId: 'batch-src',
        targetBatchId: 'batch-tgt',
        reason: 'Schedule conflict resolution',
        transferredBy: 'admin-user-id',
      });

      const res = await service.transferStudent(
        instituteA,
        {
          studentProfileId: studentA,
          sourceBatchId: 'batch-src',
          targetBatchId: 'batch-tgt',
          reason: 'Schedule conflict resolution',
        },
        'admin-user-id',
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.batchTransferLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          instituteId: instituteA,
          studentProfileId: studentA,
          sourceBatchId: 'batch-src',
          targetBatchId: 'batch-tgt',
          reason: 'Schedule conflict resolution',
          transferredBy: 'admin-user-id',
        }),
      });
    });

    it('blocks transfer if student is not enrolled in source batch', async () => {
      mockPrisma.studentProfile.findFirst.mockResolvedValue({
        id: studentA,
        instituteId: instituteA,
      });

      mockPrisma.batch.findFirst
        .mockResolvedValueOnce({ id: 'batch-src', courseId: 'c-1', instituteId: instituteA })
        .mockResolvedValueOnce({
          id: 'batch-tgt',
          courseId: 'c-1',
          instituteId: instituteA,
          status: 'ACTIVE',
          capacity: 30,
          _count: { enrolments: 5 },
        });

      mockPrisma.enrolment.findFirst.mockResolvedValue(null);

      await expect(
        service.transferStudent(
          instituteA,
          {
            studentProfileId: studentA,
            sourceBatchId: 'batch-src',
            targetBatchId: 'batch-tgt',
            reason: 'Test transfer',
          },
          'admin-1',
        ),
      ).rejects.toThrow(/not currently enrolled/);
    });
  });

  // ===========================================================================
  // 5. SCHEDULING CONFLICT PROTECTION (Requirement 1)
  // ===========================================================================
  describe('Concurrency-Safe Scheduling Conflict Detection', () => {
    it('detects Teacher double-booking conflict and rejects scheduling with 409 Conflict', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'b-1', instituteId: instituteA });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: teacherA, instituteId: instituteA });

      // LiveSession existing for teacherA overlapping with 10:00 - 11:30
      mockPrisma.liveSession.findFirst.mockResolvedValue({
        id: 'sess-existing',
        title: 'New Testament Greek I',
        startsAt: new Date('2026-09-01T10:00:00Z'),
        endsAt: new Date('2026-09-01T11:30:00Z'),
        teacherProfile: {
          membership: { user: { fullName: 'Dr. John Doe' } },
        },
        batch: { name: 'Greek Cohort 2026' },
      });

      await expect(
        service.createSchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherA,
          title: 'Old Testament Survey',
          startsAt: '2026-09-01T10:30:00Z',
          endsAt: '2026-09-01T12:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('detects Room double-booking conflict', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'b-1', instituteId: instituteA });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: teacherA, instituteId: instituteA });

      // Teacher has no conflict, but Room 101 has overlap
      mockPrisma.liveSession.findFirst
        .mockResolvedValueOnce(null) // Teacher check: free
        .mockResolvedValueOnce({
          id: 'sess-room-conflict',
          title: 'Church History Lecture',
          startsAt: new Date('2026-09-01T14:00:00Z'),
          endsAt: new Date('2026-09-01T15:30:00Z'),
          room: 'Main Sanctuary Hall',
          batch: { name: 'Theology 101' },
        }); // Room check: booked!

      await expect(
        service.createSchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherA,
          room: 'Main Sanctuary Hall',
          title: 'Christian Ethics',
          startsAt: '2026-09-01T14:30:00Z',
          endsAt: '2026-09-01T16:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('detects Batch double-booking conflict', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'b-1', instituteId: instituteA });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: teacherA, instituteId: instituteA });

      mockPrisma.liveSession.findFirst
        .mockResolvedValueOnce(null) // Teacher check: free
        .mockResolvedValueOnce({
          id: 'sess-batch-conflict',
          title: 'Theology Discussion',
          startsAt: new Date('2026-09-01T09:00:00Z'),
          endsAt: new Date('2026-09-01T10:00:00Z'),
          batch: { name: 'Cohort Alpha' },
        }); // Batch check: booked!

      await expect(
        service.createSchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherA,
          title: 'Systematic Theology',
          startsAt: '2026-09-01T09:00:00Z',
          endsAt: '2026-09-01T10:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows scheduling when no teacher, room, or batch conflicts exist', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'b-1', instituteId: instituteA });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: teacherA, instituteId: instituteA });

      mockPrisma.liveSession.findFirst.mockResolvedValue(null); // No conflicts
      mockPrisma.liveSession.create.mockResolvedValue({
        id: 'sess-new',
        title: 'Biblical Exegesis',
        startsAt: new Date('2026-09-01T14:00:00Z'),
        endsAt: new Date('2026-09-01T15:30:00Z'),
        status: 'SCHEDULED',
      });

      const session = await service.createSchedule(instituteA, {
        batchId: 'b-1',
        teacherProfileId: teacherA,
        title: 'Biblical Exegesis',
        startsAt: '2026-09-01T14:00:00Z',
        endsAt: '2026-09-01T15:30:00Z',
      });

      expect(session.id).toBe('sess-new');
    });
  });

  // ===========================================================================
  // 6. RECURRING SCHEDULING (Requirement 4)
  // ===========================================================================
  describe('Recurring Weekly Scheduling with Exception Filtering', () => {
    it('generates multiple weekly occurrences skipping exceptions and validating each for conflicts', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'b-1', instituteId: instituteA });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: teacherA, instituteId: instituteA });

      mockPrisma.liveSession.findFirst.mockResolvedValue(null); // No conflicts on any occurrence
      mockPrisma.liveSession.create.mockImplementation((args: any) =>
        Promise.resolve({ id: `sess-${Math.random()}`, ...args.data }),
      );

      // Generate 2 weeks of Mon/Wed from 2026-09-01 (Tue) to 2026-09-14 (Mon)
      // Mon = 1, Wed = 3
      // Wed Sep 02, Mon Sep 07, Wed Sep 09, Mon Sep 14 = 4 occurrences
      // Exception on 2026-09-09 -> Should result in 3 occurrences
      const res = await service.generateRecurringWeeklySchedule(instituteA, {
        batchId: 'b-1',
        teacherProfileId: teacherA,
        title: 'Weekly Greek Syntax',
        daysOfWeek: [1, 3],
        startTime: '10:00',
        endTime: '11:30',
        startDate: '2026-09-01',
        endDate: '2026-09-14',
        exceptions: ['2026-09-09'], // Public Holiday exception
      });

      expect(res.generatedCount).toBe(3);
      expect(mockPrisma.liveSession.create).toHaveBeenCalledTimes(3);
    });

    it('aborts recurring series if ANY occurrence has a scheduling conflict', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'b-1', instituteId: instituteA });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: teacherA, instituteId: instituteA });

      // First check passes, second check hits a teacher conflict
      mockPrisma.liveSession.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'sess-conflict',
          title: 'Guest Lecture',
          startsAt: new Date('2026-09-07T10:00:00Z'),
          endsAt: new Date('2026-09-07T11:30:00Z'),
          teacherProfile: { membership: { user: { fullName: 'Dr. John' } } },
          batch: { name: 'Batch 2' },
        });

      await expect(
        service.generateRecurringWeeklySchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherA,
          title: 'Weekly Greek Syntax',
          daysOfWeek: [1, 3],
          startTime: '10:00',
          endTime: '11:30',
          startDate: '2026-09-01',
          endDate: '2026-09-14',
        }),
      ).rejects.toThrow(ConflictException);

      // Verify no orphan sessions were saved
      expect(mockPrisma.liveSession.create).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 7. CONCURRENCY & DATA INTEGRITY VERIFICATION SUITE
  // ===========================================================================
  describe('Concurrency & Data Integrity Verification', () => {
    it('concurrent enrolment: when only 1 seat remains, exactly 1 succeeds and capacity is never exceeded', async () => {
      let activeEnrolments = 49;
      const maxCapacity = 50;

      mockPrisma.studentProfile.findFirst.mockResolvedValue({
        id: 'stud',
        instituteId: instituteA,
      });

      // Simulates real-time DB state under transactional exclusive lock
      mockPrisma.batch.findFirst.mockImplementation(async () => ({
        id: 'batch-concurrent',
        courseId: 'c1',
        instituteId: instituteA,
        capacity: maxCapacity,
        status: 'ACTIVE',
        _count: { enrolments: activeEnrolments },
      }));

      mockPrisma.enrolment.count = jest.fn(async () => activeEnrolments);
      mockPrisma.enrolment.findFirst.mockResolvedValue(null);
      mockPrisma.enrolment.create.mockImplementation(async (args: any) => {
        activeEnrolments++;
        return { id: `enrol-${Math.random()}`, ...args.data };
      });

      // Send 2 simultaneous enrolment requests for the 1 remaining seat
      const [req1, req2] = await Promise.allSettled([
        service.enrollStudent(instituteA, 'batch-concurrent', 'student-alpha'),
        service.enrollStudent(instituteA, 'batch-concurrent', 'student-beta'),
      ]);

      const fulfilled = [req1, req2].filter((r) => r.status === 'fulfilled');
      const rejected = [req1, req2].filter((r) => r.status === 'rejected');

      // Exactly 1 request must succeed
      expect(fulfilled.length).toBe(1);
      // Exactly 1 request must be rejected
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('Batch capacity reached');

      // Crucial verification: Active enrolments NEVER exceeded batch.capacity
      expect(activeEnrolments).toBe(maxCapacity);
    });

    it('concurrent scheduling: same teacher overlapping sessions cannot both succeed', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'b-1', instituteId: instituteA });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: teacherA, instituteId: instituteA });

      let committedSession: any = null;

      mockPrisma.liveSession.findFirst.mockImplementation(async (query: any) => {
        if (committedSession && query?.where?.teacherProfileId === teacherA) {
          return committedSession;
        }
        return null;
      });

      mockPrisma.liveSession.create.mockImplementation(async (args: any) => {
        committedSession = {
          id: 'sess-first-committed',
          ...args.data,
          startsAt: new Date(args.data.startsAt),
          endsAt: new Date(args.data.endsAt),
          teacherProfile: { membership: { user: { fullName: 'Dr. John' } } },
          batch: { name: 'Batch 1' },
        };
        return committedSession;
      });

      // Two concurrent requests attempt to book Teacher A at overlapping times
      const [sched1, sched2] = await Promise.allSettled([
        service.createSchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherA,
          title: 'Morning Hermeneutics',
          startsAt: '2026-10-01T10:00:00Z',
          endsAt: '2026-10-01T11:00:00Z',
        }),
        service.createSchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherA,
          title: 'Advanced Exegesis',
          startsAt: '2026-10-01T10:30:00Z',
          endsAt: '2026-10-01T11:30:00Z',
        }),
      ]);

      const fulfilled = [sched1, sched2].filter((r) => r.status === 'fulfilled');
      const rejected = [sched1, sched2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });

    it('concurrent scheduling: same physical room overlapping sessions cannot both succeed', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'b-1', instituteId: instituteA });
      mockPrisma.teacherProfile.findFirst
        .mockResolvedValueOnce({ id: teacherA, instituteId: instituteA })
        .mockResolvedValueOnce({ id: teacherB, instituteId: instituteA });

      let committedSession: any = null;

      mockPrisma.liveSession.findFirst.mockImplementation(async (query: any) => {
        if (committedSession && query?.where?.room === 'Main Sanctuary') {
          return committedSession;
        }
        return null;
      });

      mockPrisma.liveSession.create.mockImplementation(async (args: any) => {
        committedSession = {
          id: 'sess-room-committed',
          ...args.data,
          startsAt: new Date(args.data.startsAt),
          endsAt: new Date(args.data.endsAt),
          batch: { name: 'Batch 1' },
        };
        return committedSession;
      });

      // Two concurrent requests attempt to reserve the same room at overlapping times
      const [sched1, sched2] = await Promise.allSettled([
        service.createSchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherA,
          room: 'Main Sanctuary',
          title: 'Biblical Archaeology',
          startsAt: '2026-10-01T14:00:00Z',
          endsAt: '2026-10-01T15:00:00Z',
        }),
        service.createSchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherB,
          room: 'Main Sanctuary',
          title: 'Choir & Worship Practicum',
          startsAt: '2026-10-01T14:30:00Z',
          endsAt: '2026-10-01T15:30:00Z',
        }),
      ]);

      const fulfilled = [sched1, sched2].filter((r) => r.status === 'fulfilled');
      const rejected = [sched1, sched2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });

    it('concurrent scheduling: same batch overlapping sessions cannot both succeed', async () => {
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'b-1', instituteId: instituteA });
      mockPrisma.teacherProfile.findFirst.mockResolvedValue({ id: teacherA, instituteId: instituteA });

      let committedSession: any = null;

      mockPrisma.liveSession.findFirst.mockImplementation(async (query: any) => {
        if (committedSession && query?.where?.batchId === 'b-1') {
          return committedSession;
        }
        return null;
      });

      mockPrisma.liveSession.create.mockImplementation(async (args: any) => {
        committedSession = {
          id: 'sess-batch-committed',
          ...args.data,
          startsAt: new Date(args.data.startsAt),
          endsAt: new Date(args.data.endsAt),
          batch: { name: 'Batch 1' },
        };
        return committedSession;
      });

      // Two concurrent requests attempt to schedule classes for the same batch at overlapping times
      const [sched1, sched2] = await Promise.allSettled([
        service.createSchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherA,
          title: 'Systematic Theology I',
          startsAt: '2026-10-01T09:00:00Z',
          endsAt: '2026-10-01T10:00:00Z',
        }),
        service.createSchedule(instituteA, {
          batchId: 'b-1',
          teacherProfileId: teacherB,
          title: 'Church History I',
          startsAt: '2026-10-01T09:30:00Z',
          endsAt: '2026-10-01T10:30:00Z',
        }),
      ]);

      const fulfilled = [sched1, sched2].filter((r) => r.status === 'fulfilled');
      const rejected = [sched1, sched2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });
  });
});

