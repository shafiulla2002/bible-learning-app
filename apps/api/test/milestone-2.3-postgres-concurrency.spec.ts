import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BatchesService } from '../src/modules/batches/batches.service';

// Resolve TEST_DATABASE_URL from apps/api/.env if not in process.env
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

describe('Milestone 2.3 — Real PostgreSQL Concurrency & Integrity Integration Suite', () => {
  let prisma: PrismaClient;
  let service: BatchesService;
  jest.setTimeout(60000);

  const testSuffix = Date.now().toString().slice(-6);
  const testInstituteSlug = `pg-test-inst-${testSuffix}`;
  let instituteId: string;
  let teacherProfileId: string;
  let studentProfile1Id: string;
  let studentProfile2Id: string;
  let courseId: string;

  beforeAll(async () => {
    const url = getTestDbUrl();
    prisma = new PrismaClient({
      datasources: { db: { url } },
    });
    await prisma.$connect();
    service = new BatchesService(prisma as any);

    // Seed test institute
    const institute = await prisma.institute.create({
      data: {
        name: `PostgreSQL Concurrency Test Institute ${testSuffix}`,
        slug: testInstituteSlug,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
      },
    });
    instituteId = institute.id;

    // Seed test teacher
    const teacherUser = await prisma.user.create({
      data: {
        fullName: `Dr. Teacher ${testSuffix}`,
        phoneE164: `+91981${testSuffix}01`,
        email: `teacher.${testSuffix}@example.com`,
        memberships: {
          create: {
            instituteId,
            role: 'TEACHER',
            teacherProfile: {
              create: {
                instituteId,
                specialization: 'Systematic Theology',
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
    teacherProfileId = teacherUser.memberships[0].teacherProfile!.id;

    // Seed test students
    const student1User = await prisma.user.create({
      data: {
        fullName: `Student Alpha ${testSuffix}`,
        phoneE164: `+91981${testSuffix}02`,
        email: `student.alpha.${testSuffix}@example.com`,
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
    studentProfile1Id = student1User.memberships[0].studentProfile!.id;

    const student2User = await prisma.user.create({
      data: {
        fullName: `Student Beta ${testSuffix}`,
        phoneE164: `+91981${testSuffix}03`,
        email: `student.beta.${testSuffix}@example.com`,
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
    studentProfile2Id = student2User.memberships[0].studentProfile!.id;

    // Seed test category and course
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
        title: `Biblical Greek Syntax ${testSuffix}`,
        slug: `greek-syntax-${testSuffix}`,
        description: 'Comprehensive study of Greek syntax for testing',
        status: 'PUBLISHED',
      },
    });
    courseId = course.id;
  }, 30000);

  afterAll(async () => {
    // Clean up test institute and all cascading records
    if (instituteId) {
      try {
        await prisma.institute.delete({ where: { id: instituteId } });
      } catch {
        // Best-effort cleanup
      }
    }
    await prisma.$disconnect();
  });

  // ===========================================================================
  // 1. ACADEMIC YEARS CONCURRENCY & INTEGRITY
  // ===========================================================================
  describe('Academic Years Real PostgreSQL Concurrency', () => {
    it('concurrent current academic year creation guarantees only ONE current year', async () => {
      // Two concurrent requests attempt to create different academic years both marked isCurrent = true
      const [res1, res2] = await Promise.allSettled([
        service.createAcademicYear(instituteId, {
          name: `AY 2026-2027 ${testSuffix}`,
          startDate: '2026-06-01',
          endDate: '2027-05-31',
          isCurrent: true,
        }),
        service.createAcademicYear(instituteId, {
          name: `AY 2028-2029 ${testSuffix}`,
          startDate: '2028-06-01',
          endDate: '2029-05-31',
          isCurrent: true,
        }),
      ]);

      // Both can succeed serially or one succeeds, but in the DB exactly ONE must be current
      const currentYears = await prisma.academicYear.findMany({
        where: { instituteId, isCurrent: true },
      });
      expect(currentYears.length).toBe(1);
    });

    it('rejects overlapping academic years via PostgreSQL exclusion constraint', async () => {
      // Attempts to create a year overlapping with 2026-06-01..2027-05-31
      await expect(
        service.createAcademicYear(instituteId, {
          name: `AY Overlap ${testSuffix}`,
          startDate: '2026-11-01',
          endDate: '2027-10-31',
          isCurrent: false,
        }),
      ).rejects.toThrow();
    });

    it('atomic setCurrentAcademicYear switches current year and preserves state on failure', async () => {
      let years = await prisma.academicYear.findMany({ where: { instituteId } });
      if (years.length < 2) {
        await service.createAcademicYear(instituteId, {
          name: `AY 2028-2029 ${testSuffix}`,
          startDate: '2028-06-01',
          endDate: '2029-05-31',
          isCurrent: false,
        });
        years = await prisma.academicYear.findMany({ where: { instituteId } });
      }
      expect(years.length).toBeGreaterThanOrEqual(2);

      const targetYear = years.find((y) => !y.isCurrent)!;
      const initialCurrentYear = years.find((y) => y.isCurrent)!;

      // Switch current year
      const updated = await service.setCurrentAcademicYear(instituteId, targetYear.id);
      expect(updated.isCurrent).toBe(true);

      const currentYears = await prisma.academicYear.findMany({
        where: { instituteId, isCurrent: true },
      });
      expect(currentYears.length).toBe(1);
      expect(currentYears[0].id).toBe(targetYear.id);

      // Failed switch on non-existent year preserves previous current year
      await expect(
        service.setCurrentAcademicYear(instituteId, 'non-existent-year-id'),
      ).rejects.toThrow();

      const preservedCurrent = await prisma.academicYear.findMany({
        where: { instituteId, isCurrent: true },
      });
      expect(preservedCurrent.length).toBe(1);
      expect(preservedCurrent[0].id).toBe(targetYear.id);
    });
  });

  // ===========================================================================
  // 2. ACADEMIC TERMS CONCURRENCY & ISOLATION
  // ===========================================================================
  describe('Academic Terms Real PostgreSQL Rules', () => {
    let year1Id: string;
    let year2Id: string;
    let term1Year1Id: string;
    let term2Year1Id: string;
    let term1Year2Id: string;

    beforeAll(async () => {
      let y1 = await prisma.academicYear.findFirst({
        where: { instituteId, name: `AY 2026-2027 ${testSuffix}` },
      });
      let y2 = await prisma.academicYear.findFirst({
        where: { instituteId, name: `AY 2028-2029 ${testSuffix}` },
      });
      if (!y1) {
        y1 = await service.createAcademicYear(instituteId, {
          name: `AY 2026-2027 ${testSuffix}`,
          startDate: '2026-06-01',
          endDate: '2027-05-31',
          isCurrent: true,
        });
      }
      if (!y2) {
        y2 = await service.createAcademicYear(instituteId, {
          name: `AY 2028-2029 ${testSuffix}`,
          startDate: '2028-06-01',
          endDate: '2029-05-31',
          isCurrent: false,
        });
      }
      year1Id = y1!.id;
      year2Id = y2!.id;
    });

    it('enforces terms fall within academic year date range', async () => {
      await expect(
        service.createAcademicTerm(instituteId, {
          academicYearId: year1Id,
          name: `Term Out of Bounds ${testSuffix}`,
          startDate: '2026-05-01', // Before year start (2026-06-01)
          endDate: '2026-10-31',
          isCurrent: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects overlapping terms within the same academic year', async () => {
      // Create Term 1 in Year 1: 2026-07-01 to 2026-11-30
      const term1 = await service.createAcademicTerm(instituteId, {
        academicYearId: year1Id,
        name: `Term 1 ${testSuffix}`,
        startDate: '2026-07-01',
        endDate: '2026-11-30',
        isCurrent: true,
      });
      term1Year1Id = term1.id;

      // Attempt to create overlapping term in Year 1: 2026-10-01 to 2027-02-28
      await expect(
        service.createAcademicTerm(instituteId, {
          academicYearId: year1Id,
          name: `Term Overlap ${testSuffix}`,
          startDate: '2026-10-01',
          endDate: '2027-02-28',
          isCurrent: false,
        }),
      ).rejects.toThrow();
    });

    it('supports one current term per academic year independently', async () => {
      // Create non-overlapping Term 2 in Year 1: 2026-12-01 to 2027-04-30 (not current)
      const term2 = await service.createAcademicTerm(instituteId, {
        academicYearId: year1Id,
        name: `Term 2 ${testSuffix}`,
        startDate: '2026-12-01',
        endDate: '2027-04-30',
        isCurrent: false,
      });
      term2Year1Id = term2.id;

      // Create Term 1 in Year 2: 2028-07-01 to 2028-11-30 (marked isCurrent = true)
      const termY2 = await service.createAcademicTerm(instituteId, {
        academicYearId: year2Id,
        name: `Year 2 Term 1 ${testSuffix}`,
        startDate: '2028-07-01',
        endDate: '2028-11-30',
        isCurrent: true,
      });
      term1Year2Id = termY2.id;

      // Both Year 1 and Year 2 must each have their OWN current term!
      const currentTermsY1 = await prisma.academicTerm.findMany({
        where: { academicYearId: year1Id, isCurrent: true },
      });
      const currentTermsY2 = await prisma.academicTerm.findMany({
        where: { academicYearId: year2Id, isCurrent: true },
      });

      expect(currentTermsY1.length).toBe(1);
      expect(currentTermsY1[0].id).toBe(term1Year1Id);

      expect(currentTermsY2.length).toBe(1);
      expect(currentTermsY2[0].id).toBe(term1Year2Id);

      // Switching current term in Year 1 does NOT touch Year 2's current term!
      await service.setCurrentAcademicTerm(instituteId, term2Year1Id);

      const updatedY1 = await prisma.academicTerm.findMany({
        where: { academicYearId: year1Id, isCurrent: true },
      });
      const unchangedY2 = await prisma.academicTerm.findMany({
        where: { academicYearId: year2Id, isCurrent: true },
      });

      expect(updatedY1[0].id).toBe(term2Year1Id);
      expect(unchangedY2[0].id).toBe(term1Year2Id);
    });
  });

  // ===========================================================================
  // 3. BATCH CAPACITY CONCURRENT ENROLMENT ON REAL POSTGRESQL
  // ===========================================================================
  describe('Batch Capacity Real PostgreSQL Concurrency', () => {
    let batchId: string;

    beforeAll(async () => {
      // Create batch with capacity = 2
      const batch = await service.createBatch(instituteId, {
        courseId,
        name: `Greek Cohort Capacity Test ${testSuffix}`,
        code: `GRK-${testSuffix}`,
        startDate: '2026-07-01',
        endDate: '2026-11-30',
        capacity: 2,
      });
      batchId = batch.id;

      // Seed 1 existing student enrolment -> Exactly 1 seat remains!
      await service.enrollStudent(instituteId, batchId, studentProfile1Id);
    });

    it('when only 1 seat remains, simultaneous enrolment requests allow exactly 1 and reject the other', async () => {
      // Create a 3rd student profile for concurrent enrolment
      const student3User = await prisma.user.create({
        data: {
          fullName: `Student Gamma ${testSuffix}`,
          phoneE164: `+91981${testSuffix}04`,
          email: `student.gamma.${testSuffix}@example.com`,
          memberships: {
            create: {
              instituteId,
              role: 'STUDENT',
              studentProfile: {
                create: {
                  instituteId,
                  admissionNo: `ADM-G-${testSuffix}`,
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
      const studentProfile3Id = student3User.memberships[0].studentProfile!.id;

      // Two simultaneous enrolment requests for the 1 remaining seat
      const [req1, req2] = await Promise.allSettled([
        service.enrollStudent(instituteId, batchId, studentProfile2Id),
        service.enrollStudent(instituteId, batchId, studentProfile3Id),
      ]);

      const fulfilled = [req1, req2].filter((r) => r.status === 'fulfilled');
      const rejected = [req1, req2].filter((r) => r.status === 'rejected');

      // Exactly 1 request succeeds
      expect(fulfilled.length).toBe(1);
      // Exactly 1 request fails
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('Batch capacity reached');

      // Verification in PostgreSQL: Total enrolments never exceed capacity (2)
      const actualCount = await prisma.enrolment.count({
        where: { batchId, instituteId },
      });
      expect(actualCount).toBe(2);
    });
  });

  // ===========================================================================
  // 4. TIMETABLE CONCURRENT SCHEDULING ON REAL POSTGRESQL
  // ===========================================================================
  describe('Timetable Scheduling Real PostgreSQL Concurrency', () => {
    let batchAId: string;
    let batchBId: string;

    beforeAll(async () => {
      const bA = await service.createBatch(instituteId, {
        courseId,
        name: `Schedule Batch A ${testSuffix}`,
        code: `SBA-${testSuffix}`,
        startDate: '2026-07-01',
        endDate: '2026-11-30',
        capacity: 30,
      });
      const bB = await service.createBatch(instituteId, {
        courseId,
        name: `Schedule Batch B ${testSuffix}`,
        code: `SBB-${testSuffix}`,
        startDate: '2026-07-01',
        endDate: '2026-11-30',
        capacity: 30,
      });
      batchAId = bA.id;
      batchBId = bB.id;
    });

    it('concurrent scheduling: same teacher overlapping sessions cannot both succeed', async () => {
      const [sched1, sched2] = await Promise.allSettled([
        service.createSchedule(instituteId, {
          batchId: batchAId,
          teacherProfileId,
          title: `Greek Grammar 1 ${testSuffix}`,
          startsAt: '2026-09-10T09:00:00Z',
          endsAt: '2026-09-10T10:30:00Z',
        }),
        service.createSchedule(instituteId, {
          batchId: batchBId,
          teacherProfileId,
          title: `Greek Grammar 2 ${testSuffix}`,
          startsAt: '2026-09-10T09:30:00Z', // Overlaps
          endsAt: '2026-09-10T11:00:00Z',
        }),
      ]);

      const fulfilled = [sched1, sched2].filter((r) => r.status === 'fulfilled');
      const rejected = [sched1, sched2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });

    it('concurrent scheduling: same physical room overlapping sessions cannot both succeed', async () => {
      // Create a 2nd teacher
      const teacher2User = await prisma.user.create({
        data: {
          fullName: `Dr. Teacher Two ${testSuffix}`,
          phoneE164: `+91981${testSuffix}05`,
          email: `teacher2.${testSuffix}@example.com`,
          memberships: {
            create: {
              instituteId,
              role: 'TEACHER',
              teacherProfile: {
                create: {
                  instituteId,
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
      const teacherProfile2Id = teacher2User.memberships[0].teacherProfile!.id;

      const [sched1, sched2] = await Promise.allSettled([
        service.createSchedule(instituteId, {
          batchId: batchAId,
          teacherProfileId,
          room: `Auditorium-${testSuffix}`,
          title: `Class A in Room ${testSuffix}`,
          startsAt: '2026-09-11T14:00:00Z',
          endsAt: '2026-09-11T15:30:00Z',
        }),
        service.createSchedule(instituteId, {
          batchId: batchBId,
          teacherProfileId: teacherProfile2Id,
          room: `Auditorium-${testSuffix}`,
          title: `Class B in Room ${testSuffix}`,
          startsAt: '2026-09-11T14:30:00Z', // Overlaps
          endsAt: '2026-09-11T16:00:00Z',
        }),
      ]);

      const fulfilled = [sched1, sched2].filter((r) => r.status === 'fulfilled');
      const rejected = [sched1, sched2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });

    it('concurrent scheduling: same batch overlapping sessions cannot both succeed', async () => {
      // 2 different teachers schedule classes for Batch A at overlapping times
      const teachers = await prisma.teacherProfile.findMany({ where: { instituteId } });
      expect(teachers.length).toBeGreaterThanOrEqual(2);

      const [sched1, sched2] = await Promise.allSettled([
        service.createSchedule(instituteId, {
          batchId: batchAId,
          teacherProfileId: teachers[0].id,
          title: `Batch A Class 1 ${testSuffix}`,
          startsAt: '2026-09-12T10:00:00Z',
          endsAt: '2026-09-12T11:30:00Z',
        }),
        service.createSchedule(instituteId, {
          batchId: batchAId,
          teacherProfileId: teachers[1].id,
          title: `Batch A Class 2 ${testSuffix}`,
          startsAt: '2026-09-12T10:45:00Z', // Overlaps
          endsAt: '2026-09-12T12:00:00Z',
        }),
      ]);

      const fulfilled = [sched1, sched2].filter((r) => r.status === 'fulfilled');
      const rejected = [sched1, sched2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });

    it('recurring schedule atomic rollback: leaves zero partial sessions when a conflict exists', async () => {
      // Seed a single existing session on 2026-09-16
      await service.createSchedule(instituteId, {
        batchId: batchBId,
        teacherProfileId,
        title: `Existing Pre-booked Session ${testSuffix}`,
        startsAt: '2026-09-16T10:00:00Z',
        endsAt: '2026-09-16T11:00:00Z',
      });

      const countBefore = await prisma.liveSession.count({
        where: { instituteId, batchId: batchAId },
      });

      // Attempt to schedule recurring series on Wednesdays (day 3) at 10:00-11:00 for Teacher
      // 2026-09-09 (Wed) -> no conflict
      // 2026-09-16 (Wed) -> CONFLICT with Teacher's pre-booked session!
      // 2026-09-23 (Wed) -> no conflict
      await expect(
        service.generateRecurringWeeklySchedule(instituteId, {
          batchId: batchAId,
          teacherProfileId,
          title: `Recurring Greek Syntax ${testSuffix}`,
          daysOfWeek: [3],
          startTime: '10:00',
          endTime: '11:00',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
        }),
      ).rejects.toThrow(ConflictException);

      // Verify ZERO partial or orphaned sessions were created for Batch A!
      const countAfter = await prisma.liveSession.count({
        where: { instituteId, batchId: batchAId },
      });
      expect(countAfter).toBe(countBefore);
    });
  });
});
