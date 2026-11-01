import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Role, AttendanceStatus } from '@prisma/client';
import { TeachersService } from '../src/modules/teachers/teachers.service';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

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

describe('Milestone 2.6 — Teacher Management Integration Suite (Cloud SQL)', () => {
  let prisma: PrismaService;
  let teachersService: TeachersService;
  const testSuffix = Date.now().toString().slice(-6);

  let instituteIdA: string;
  let instituteIdB: string;
  let courseIdA1: string;
  let courseIdB1: string;
  let batchIdA1: string;
  let batchIdB1: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const url = getTestDbUrl();
    prisma = new PrismaClient({ datasources: { db: { url } } }) as unknown as PrismaService;
    await (prisma as any).$connect();
    teachersService = new TeachersService(prisma);

    // 1. Seed Institute A
    const instA = await prisma.institute.create({
      data: {
        name: `Teacher Institute A ${testSuffix}`,
        slug: `teach-inst-a-${testSuffix}`,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
      },
    });
    instituteIdA = instA.id;

    // 2. Seed Institute B
    const instB = await prisma.institute.create({
      data: {
        name: `Teacher Institute B ${testSuffix}`,
        slug: `teach-inst-b-${testSuffix}`,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
      },
    });
    instituteIdB = instB.id;

    // 3. Seed Course Category and Courses
    const catA = await prisma.courseCategory.create({
      data: {
        instituteId: instituteIdA,
        name: `Theology A ${testSuffix}`,
        slug: `theology-a-${testSuffix}`,
      },
    });

    const courseA = await prisma.course.create({
      data: {
        instituteId: instituteIdA,
        categoryId: catA.id,
        title: `Biblical Exegesis ${testSuffix}`,
        slug: `biblical-exegesis-${testSuffix}`,
        description: 'Deep dive into Scripture interpretation.',
      },
    });
    courseIdA1 = courseA.id;

    const catB = await prisma.courseCategory.create({
      data: {
        instituteId: instituteIdB,
        name: `Theology B ${testSuffix}`,
        slug: `theology-b-${testSuffix}`,
      },
    });

    const courseB = await prisma.course.create({
      data: {
        instituteId: instituteIdB,
        categoryId: catB.id,
        title: `Pastoral Ministry ${testSuffix}`,
        slug: `pastoral-ministry-${testSuffix}`,
        description: 'Pastoral training and leadership.',
      },
    });
    courseIdB1 = courseB.id;

    // 4. Seed Batches
    const batchA = await prisma.batch.create({
      data: {
        instituteId: instituteIdA,
        courseId: courseIdA1,
        name: `Morning Cohort 2026 ${testSuffix}`,
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-12-01T00:00:00.000Z'),
        capacity: 40,
      },
    });
    batchIdA1 = batchA.id;

    const batchB = await prisma.batch.create({
      data: {
        instituteId: instituteIdB,
        courseId: courseIdB1,
        name: `Evening Cohort 2026 ${testSuffix}`,
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-12-01T00:00:00.000Z'),
        capacity: 30,
      },
    });
    batchIdB1 = batchB.id;
  });

  afterAll(async () => {
    try {
      await prisma.batchTeacher.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.courseInstructor.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.liveSession.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.attendance.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.teacherProfile.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.membership.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.batch.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.course.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.courseCategory.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.auditLog.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.institute.deleteMany({ where: { id: { in: [instituteIdA, instituteIdB] } } });
    } catch (_) {}
    await (prisma as any).$disconnect();
  });

  describe('1. Teacher Registration & Account Linking', () => {
    it('successfully registers a new teacher with full profile details', async () => {
      const teacher = await teachersService.createTeacher(instituteIdA, {
        fullName: `Dr. Jonathan Edwards ${testSuffix}`,
        phoneE164: `+91981${testSuffix}01`,
        email: `jonathan.edwards.${testSuffix}@example.com`,
        employeeCode: `FAC-JE-${testSuffix}`,
        qualifications: 'Ph.D. in Systematic Theology, Yale',
        specialization: 'Historical Theology & Hermeneutics',
        experienceYears: 15,
        joiningDate: '2026-01-15T00:00:00.000Z',
        address: {
          street: '12 Church Lane',
          city: 'Bangalore',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'India',
        },
        bio: 'Senior lecturer focusing on the Great Awakening and biblical theology.',
        status: 'ACTIVE',
      });

      expect(teacher.id).toBeDefined();
      expect(teacher.instituteId).toBe(instituteIdA);
      expect(teacher.fullName).toBe(`Dr. Jonathan Edwards ${testSuffix}`);
      expect(teacher.employeeCode).toBe(`FAC-JE-${testSuffix}`);
      expect(teacher.specialization).toBe('Historical Theology & Hermeneutics');
      expect(teacher.experienceYears).toBe(15);
      expect(teacher.status).toBe('ACTIVE');

      // Verify PostgreSQL database state
      const dbTeacher = await prisma.teacherProfile.findUnique({
        where: { id: teacher.id },
        include: { membership: { include: { user: true } } },
      });
      expect(dbTeacher).not.toBeNull();
      expect(dbTeacher?.membership.role).toBe(Role.TEACHER);
      expect(dbTeacher?.membership.status).toBe('ACTIVE');
      expect(dbTeacher?.membership.user.phoneE164).toBe(`+91981${testSuffix}01`);
    });

    it('auto-generates sequential employee code when not provided', async () => {
      const teacher = await teachersService.createTeacher(instituteIdA, {
        fullName: `Prof. Charles Hodge ${testSuffix}`,
        phoneE164: `+91981${testSuffix}02`,
        email: `charles.hodge.${testSuffix}@example.com`,
        specialization: 'Systematic Theology',
        status: 'ACTIVE',
      });

      expect(teacher.employeeCode).toMatch(/^FAC-\d{4}-\d{4}$/);
    });

    it('rejects duplicate phone registration within the same institute', async () => {
      await expect(
        teachersService.createTeacher(instituteIdA, {
          fullName: `Duplicate Phone Teacher`,
          phoneE164: `+91981${testSuffix}01`, // already registered in test 1
          email: `unique.email.${testSuffix}@example.com`,
          status: 'ACTIVE',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects duplicate email within the same institute', async () => {
      await expect(
        teachersService.createTeacher(instituteIdA, {
          fullName: `Duplicate Email Teacher`,
          phoneE164: `+91981${testSuffix}99`,
          email: `jonathan.edwards.${testSuffix}@example.com`, // already used in test 1
          status: 'ACTIVE',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects registration when target institute does not exist', async () => {
      await expect(
        teachersService.createTeacher('non-existent-institute-id', {
          fullName: `Ghost Institute Teacher`,
          phoneE164: `+91981${testSuffix}88`,
          status: 'ACTIVE',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Teacher Directory & Filtering', () => {
    let teacherAlphaId: string;
    let teacherBetaId: string;

    beforeAll(async () => {
      const t1 = await teachersService.createTeacher(instituteIdA, {
        fullName: `Alpha Greek Scholar ${testSuffix}`,
        phoneE164: `+91982${testSuffix}11`,
        email: `alpha.${testSuffix}@example.com`,
        specialization: 'Biblical Greek',
        status: 'ACTIVE',
      });
      teacherAlphaId = t1.id;

      const t2 = await teachersService.createTeacher(instituteIdA, {
        fullName: `Beta Hebrew Scholar ${testSuffix}`,
        phoneE164: `+91982${testSuffix}22`,
        email: `beta.${testSuffix}@example.com`,
        specialization: 'Biblical Hebrew',
        status: 'DRAFT',
      });
      teacherBetaId = t2.id;
    });

    it('searches teachers by name, phone, or specialization', async () => {
      const res = await teachersService.findAll(instituteIdA, {
        search: 'Greek Scholar',
        page: 1,
        limit: 10,
      });

      expect(res.data.length).toBeGreaterThanOrEqual(1);
      const found = res.data.find((t) => t.id === teacherAlphaId);
      expect(found).toBeDefined();
      expect(found?.specialization).toBe('Biblical Greek');
    });

    it('filters teachers by status', async () => {
      const res = await teachersService.findAll(instituteIdA, {
        status: 'DRAFT',
        page: 1,
        limit: 10,
      });

      const foundBeta = res.data.find((t) => t.id === teacherBetaId);
      expect(foundBeta).toBeDefined();
      expect(foundBeta?.status).toBe('DRAFT');

      const foundAlpha = res.data.find((t) => t.id === teacherAlphaId);
      expect(foundAlpha).toBeUndefined();
    });

    it('paginates results correctly', async () => {
      const res = await teachersService.findAll(instituteIdA, {
        page: 1,
        limit: 2,
      });

      expect(res.data.length).toBeLessThanOrEqual(2);
      expect(res.meta.page).toBe(1);
      expect(res.meta.limit).toBe(2);
      expect(res.meta.total).toBeGreaterThanOrEqual(4);
      expect(res.meta.totalPages).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Teacher Profile Retrieval & Updates', () => {
    let teacherId: string;

    beforeAll(async () => {
      const t = await teachersService.createTeacher(instituteIdA, {
        fullName: `Augustine of Hippo ${testSuffix}`,
        phoneE164: `+91983${testSuffix}01`,
        email: `augustine.${testSuffix}@example.com`,
        specialization: 'Patristics',
        status: 'ACTIVE',
      });
      teacherId = t.id;
    });

    it('retrieves single teacher with complete details', async () => {
      const detail = await teachersService.findOne(instituteIdA, teacherId);
      expect(detail.id).toBe(teacherId);
      expect(detail.fullName).toBe(`Augustine of Hippo ${testSuffix}`);
      expect(detail.workloadSummary).toBeDefined();
      expect(detail.workloadSummary.totalCourses).toBe(0);
      expect(detail.workloadSummary.totalBatches).toBe(0);
    });

    it('updates personal and professional profile information', async () => {
      const updated = await teachersService.update(instituteIdA, teacherId, {
        fullName: `St. Augustine of Hippo ${testSuffix}`,
        qualifications: 'Doctor of the Church',
        experienceYears: 30,
        bio: 'Bishop of Hippo Regius, champion of divine grace.',
      });

      expect(updated.fullName).toBe(`St. Augustine of Hippo ${testSuffix}`);
      expect(updated.qualifications).toBe('Doctor of the Church');
      expect(updated.experienceYears).toBe(30);
      expect(updated.bio).toBe('Bishop of Hippo Regius, champion of divine grace.');
    });

    it('throws 404 when querying a non-existent teacher', async () => {
      await expect(
        teachersService.findOne(instituteIdA, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Course Assignment & Duplicate Prevention', () => {
    let teacherId: string;

    beforeAll(async () => {
      const t = await teachersService.createTeacher(instituteIdA, {
        fullName: `Course Instructor Teacher ${testSuffix}`,
        phoneE164: `+91984${testSuffix}01`,
        specialization: 'Exegesis',
        status: 'ACTIVE',
      });
      teacherId = t.id;
    });

    it('assigns teacher to a course as LEAD instructor', async () => {
      const assignment = await teachersService.assignCourse(instituteIdA, teacherId, {
        courseId: courseIdA1,
        role: 'LEAD',
      });

      expect(assignment.courseId).toBe(courseIdA1);
      expect(assignment.role).toBe('LEAD');
      expect(assignment.title).toBe(`Biblical Exegesis ${testSuffix}`);
    });

    it('strictly prevents duplicate course assignment for the same teacher', async () => {
      await expect(
        teachersService.assignCourse(instituteIdA, teacherId, {
          courseId: courseIdA1,
          role: 'ASSISTANT',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('unassigns teacher from course successfully', async () => {
      const res = await teachersService.removeCourse(instituteIdA, teacherId, courseIdA1);
      expect(res.success).toBe(true);

      const detail = await teachersService.findOne(instituteIdA, teacherId);
      expect(detail.assignedCourses.length).toBe(0);
    });
  });

  describe('5. Batch Assignment & Attendance Preservation', () => {
    let teacherId: string;

    beforeAll(async () => {
      const t = await teachersService.createTeacher(instituteIdA, {
        fullName: `Batch Instructor Teacher ${testSuffix}`,
        phoneE164: `+91985${testSuffix}01`,
        specialization: 'Pastoral Studies',
        status: 'ACTIVE',
      });
      teacherId = t.id;
    });

    it('assigns teacher to a batch successfully', async () => {
      const assignment = await teachersService.assignBatch(instituteIdA, teacherId, {
        batchId: batchIdA1,
        role: 'LEAD',
      });

      expect(assignment.batchId).toBe(batchIdA1);
      expect(assignment.role).toBe('LEAD');
      expect(assignment.name).toBe(`Morning Cohort 2026 ${testSuffix}`);
    });

    it('prevents duplicate assignment to the same batch', async () => {
      await expect(
        teachersService.assignBatch(instituteIdA, teacherId, {
          batchId: batchIdA1,
          role: 'ASSISTANT',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('removes batch assignment while preserving historical marked attendance records', async () => {
      // 1. Mark dummy attendance by this teacher
      const studentUser = await prisma.user.create({
        data: {
          phoneE164: `+91985${testSuffix}99`,
          fullName: 'History Test Student',
        },
      });
      const studentMembership = await prisma.membership.create({
        data: {
          userId: studentUser.id,
          instituteId: instituteIdA,
          role: Role.STUDENT,
        },
      });
      const student = await prisma.studentProfile.create({
        data: {
          instituteId: instituteIdA,
          membershipId: studentMembership.id,
          admissionNo: `ADM-HIST-${testSuffix}`,
        },
      });

      const attendanceRecord = await prisma.attendance.create({
        data: {
          instituteId: instituteIdA,
          batchId: batchIdA1,
          studentProfileId: student.id,
          date: new Date('2026-10-15T00:00:00.000Z'),
          status: AttendanceStatus.PRESENT,
          markedById: teacherId,
          markedByRole: 'TEACHER',
        },
      });

      // 2. Remove teacher from batch
      const result = await teachersService.removeBatch(instituteIdA, teacherId, batchIdA1);
      expect(result.success).toBe(true);

      // 3. Verify attendance record still exists intact with markedById
      const preserved = await prisma.attendance.findUnique({
        where: { id: attendanceRecord.id },
      });
      expect(preserved).not.toBeNull();
      expect(preserved?.markedById).toBe(teacherId);
    });
  });

  describe('6. Multi-Tenant Isolation Protection', () => {
    let teacherInstAId: string;
    let teacherInstBId: string;

    beforeAll(async () => {
      const tA = await teachersService.createTeacher(instituteIdA, {
        fullName: `Tenant A Teacher ${testSuffix}`,
        phoneE164: `+91986${testSuffix}01`,
        status: 'ACTIVE',
      });
      teacherInstAId = tA.id;

      const tB = await teachersService.createTeacher(instituteIdB, {
        fullName: `Tenant B Teacher ${testSuffix}`,
        phoneE164: `+91986${testSuffix}02`,
        status: 'ACTIVE',
      });
      teacherInstBId = tB.id;
    });

    it('rejects cross-institute teacher lookup with 404', async () => {
      // Attempting to lookup Teacher A using Institute B scope must fail
      await expect(
        teachersService.findOne(instituteIdB, teacherInstAId),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects assigning a teacher from Institute A to a course in Institute B', async () => {
      // Teacher A cannot be assigned to Course B
      await expect(
        teachersService.assignCourse(instituteIdB, teacherInstAId, {
          courseId: courseIdB1,
          role: 'LEAD',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects assigning a teacher from Institute A to a batch in Institute B', async () => {
      // Teacher A cannot be assigned to Batch B
      await expect(
        teachersService.assignBatch(instituteIdB, teacherInstAId, {
          batchId: batchIdB1,
          role: 'LEAD',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects cross-institute update or deletion', async () => {
      await expect(
        teachersService.update(instituteIdB, teacherInstAId, { fullName: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        teachersService.updateStatus(instituteIdB, teacherInstAId, 'INACTIVE'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('7. Workload & Live Session Scheduling Conflict Detection', () => {
    let teacherId: string;

    beforeAll(async () => {
      const t = await teachersService.createTeacher(instituteIdA, {
        fullName: `Schedule Conflict Teacher ${testSuffix}`,
        phoneE164: `+91987${testSuffix}01`,
        status: 'ACTIVE',
      });
      teacherId = t.id;

      // Create an existing live session: 10:00 - 11:30 AM
      await prisma.liveSession.create({
        data: {
          instituteId: instituteIdA,
          batchId: batchIdA1,
          teacherProfileId: teacherId,
          title: 'Systematic Theology Lecture 1',
          startsAt: new Date('2026-11-15T10:00:00.000Z'),
          endsAt: new Date('2026-11-15T11:30:00.000Z'),
          status: 'SCHEDULED',
        },
      });
    });

    it('detects overlapping session conflict for same teacher', async () => {
      // Overlapping session request: 11:00 AM - 12:00 PM (overlaps 10:00-11:30)
      const conflict = await teachersService.checkScheduleConflict(instituteIdA, {
        teacherProfileId: teacherId,
        startsAt: '2026-11-15T11:00:00.000Z',
        endsAt: '2026-11-15T12:00:00.000Z',
      });

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.conflictType).toBe('TEACHER_DOUBLE_BOOKED');
      expect(conflict.conflictingSession?.title).toBe('Systematic Theology Lecture 1');
    });

    it('allows non-overlapping session without conflict', async () => {
      // Non-overlapping session: 14:00 - 15:30 PM
      const conflict = await teachersService.checkScheduleConflict(instituteIdA, {
        teacherProfileId: teacherId,
        startsAt: '2026-11-15T14:00:00.000Z',
        endsAt: '2026-11-15T15:30:00.000Z',
      });

      expect(conflict.hasConflict).toBe(false);
    });

    it('rejects malformed start/end times where start is after end', async () => {
      await expect(
        teachersService.checkScheduleConflict(instituteIdA, {
          teacherProfileId: teacherId,
          startsAt: '2026-11-15T16:00:00.000Z',
          endsAt: '2026-11-15T14:00:00.000Z', // end is before start
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('8. Teacher Account Activation, Deactivation & Audit Trail', () => {
    let teacherId: string;
    let membershipId: string;

    beforeAll(async () => {
      const t = await teachersService.createTeacher(instituteIdA, {
        fullName: `Lifecycle Teacher ${testSuffix}`,
        phoneE164: `+91988${testSuffix}01`,
        status: 'ACTIVE',
      });
      teacherId = t.id;
      membershipId = t.membershipId;
    });

    it('deactivates teacher account and suspends membership', async () => {
      const res = await teachersService.updateStatus(
        instituteIdA,
        teacherId,
        'INACTIVE',
        'Faculty sabbatical leave',
        'admin-user-id',
      );

      expect(res.status).toBe('INACTIVE');

      const dbTeacher = await prisma.teacherProfile.findUnique({
        where: { id: teacherId },
        include: { membership: true },
      });
      expect(dbTeacher?.status).toBe('INACTIVE');
      expect(dbTeacher?.membership.status).toBe('SUSPENDED');
    });

    it('reactivates teacher account and restores active membership', async () => {
      const res = await teachersService.updateStatus(
        instituteIdA,
        teacherId,
        'ACTIVE',
        'Returned from sabbatical',
        'admin-user-id',
      );

      expect(res.status).toBe('ACTIVE');

      const dbTeacher = await prisma.teacherProfile.findUnique({
        where: { id: teacherId },
        include: { membership: true },
      });
      expect(dbTeacher?.status).toBe('ACTIVE');
      expect(dbTeacher?.membership.status).toBe('ACTIVE');
    });

    it('verifies audit logs recorded for teacher lifecycle events', async () => {
      const logs = await prisma.auditLog.findMany({
        where: {
          instituteId: instituteIdA,
          entityId: teacherId,
          entityType: 'TEACHER',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(logs.length).toBeGreaterThanOrEqual(2);
      const statusLogs = logs.filter((l) => l.action === 'TEACHER_STATUS_CHANGED');
      expect(statusLogs.length).toBeGreaterThanOrEqual(2);
    });
  });
});
