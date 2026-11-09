import {
  Injectable,
  Optional,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateTeacherInput,
  UpdateTeacherProfileInput,
  TeacherFilterQueryInput,
  AssignTeacherCourseInput,
  AssignTeacherBatchInput,
  CheckScheduleConflictInput,
  TeacherSummaryItem,
  TeacherDetail,
  TeacherAssignedCourse,
  TeacherAssignedBatch,
  TeacherLiveSessionItem,
  TeacherWorkloadSummary,
  ScheduleConflictResult,
  TeacherStatus,
} from '@bible-lms/shared';
import { Role, MembershipStatus, LiveSessionStatus } from '@prisma/client';

@Injectable()
export class TeachersService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * Sequential employee code generator per institute per year
   */
  private async generateEmployeeCode(instituteId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `FAC-${currentYear}-`;

    const lastTeacher = await this.prisma.teacherProfile.findFirst({
      where: {
        instituteId,
        employeeCode: { startsWith: prefix },
      },
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    });

    let nextSeq = 1;
    if (lastTeacher?.employeeCode) {
      const parts = lastTeacher.employeeCode.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        nextSeq = num + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Log administrative audit actions
   */
  private async logAudit(
    instituteId: string,
    action: string,
    entityId: string,
    payload: any,
    actorUserId?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorUserId: actorUserId || 'SYSTEM',
          action,
          entityType: 'TEACHER',
          entityId,
          metadata: payload ? JSON.parse(JSON.stringify(payload)) : {},
        },
      });
    } catch (_) {
      // Audit log failures should not block core business transactions
    }
  }

  /**
   * Register a new teacher inside an institute
   */
  async createTeacher(
    instituteId: string,
    input: CreateTeacherInput,
    actorUserId?: string,
  ): Promise<TeacherSummaryItem> {
    // 1. Verify institute exists
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
    });
    if (!institute) {
      throw new NotFoundException('Institute not found');
    }

    // 2. Check duplicate phone for TEACHER in this institute
    const existingMembership = await this.prisma.membership.findFirst({
      where: {
        instituteId,
        role: Role.TEACHER,
        user: { phoneE164: input.phoneE164 },
      },
      include: { teacherProfile: true },
    });

    if (existingMembership?.teacherProfile) {
      throw new ConflictException(
        `A teacher with phone ${input.phoneE164} is already registered in this institute`,
      );
    }

    // 3. Check duplicate email in this institute if provided
    if (input.email) {
      const existingEmail = await this.prisma.membership.findFirst({
        where: {
          instituteId,
          role: Role.TEACHER,
          user: { email: input.email },
        },
      });
      if (existingEmail) {
        throw new ConflictException(
          `A teacher with email ${input.email} is already registered in this institute`,
        );
      }
    }

    // 4. Employee code resolution
    let employeeCode = input.employeeCode;
    if (employeeCode) {
      const existingCode = await this.prisma.teacherProfile.findFirst({
        where: { instituteId, employeeCode },
      });
      if (existingCode) {
        throw new ConflictException(
          `Employee code ${employeeCode} already exists in this institute`,
        );
      }
    } else {
      employeeCode = await this.generateEmployeeCode(instituteId);
    }

    // 5. Execute atomic transaction
    const teacher = await this.prisma.$transaction(async (tx) => {
      // Upsert User by phoneE164
      let user = await tx.user.findUnique({
        where: { phoneE164: input.phoneE164 },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            phoneE164: input.phoneE164,
            fullName: input.fullName,
            email: input.email || null,
            avatarUrl: input.photoUrl || null,
            status: 'ACTIVE',
          },
        });
      } else {
        // Update user's name/email if currently blank
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            fullName: input.fullName,
            email: input.email || user.email,
            avatarUrl: input.photoUrl || user.avatarUrl,
          },
        });
      }

      // Upsert Membership
      let membership = await tx.membership.findFirst({
        where: {
          userId: user.id,
          instituteId,
          role: Role.TEACHER,
        },
      });

      const memberStatus =
        input.status === 'INACTIVE'
          ? MembershipStatus.SUSPENDED
          : MembershipStatus.ACTIVE;

      if (!membership) {
        membership = await tx.membership.create({
          data: {
            userId: user.id,
            instituteId,
            role: Role.TEACHER,
            status: memberStatus,
          },
        });
      } else {
        membership = await tx.membership.update({
          where: { id: membership.id },
          data: { status: memberStatus },
        });
      }

      // Create TeacherProfile
      const profile = await tx.teacherProfile.create({
        data: {
          instituteId,
          membershipId: membership.id,
          employeeCode,
          qualifications: input.qualifications || null,
          specialization: input.specialization || null,
          experienceYears: input.experienceYears ?? null,
          joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
          address: input.address ? JSON.parse(JSON.stringify(input.address)) : null,
          bio: input.bio || null,
          photoUrl: input.photoUrl || null,
          status: input.status || 'ACTIVE',
        },
        include: {
          membership: {
            include: { user: true },
          },
        },
      });

      return profile;
    });

    await this.logAudit(
      instituteId,
      'TEACHER_REGISTERED',
      teacher.id,
      { employeeCode, fullName: input.fullName, phone: input.phoneE164 },
      actorUserId,
    );

    if (this.notificationsService) {
      await this.notificationsService
        .emitTeacherEvent(instituteId, {
          eventType: 'TEACHER_REGISTERED',
          teacherId: teacher.id,
          fullName: teacher.membership.user.fullName,
          employeeCode: teacher.employeeCode ?? undefined,
        })
        .catch(() => {});
    }

    return {
      id: teacher.id,
      instituteId: teacher.instituteId,
      userId: teacher.membership.user.id,
      membershipId: teacher.membershipId,
      fullName: teacher.membership.user.fullName,
      phoneE164: teacher.membership.user.phoneE164,
      email: teacher.membership.user.email ?? undefined,
      avatarUrl: teacher.photoUrl || teacher.membership.user.avatarUrl || undefined,
      employeeCode: teacher.employeeCode ?? undefined,
      qualifications: teacher.qualifications ?? undefined,
      specialization: teacher.specialization ?? undefined,
      experienceYears: teacher.experienceYears ?? undefined,
      joiningDate: teacher.joiningDate ? teacher.joiningDate.toISOString() : undefined,
      status: (teacher.status as TeacherStatus) || 'ACTIVE',
      assignedCoursesCount: 0,
      assignedBatchesCount: 0,
      createdAt: teacher.createdAt.toISOString(),
      updatedAt: teacher.updatedAt.toISOString(),
    };
  }

  /**
   * Search and list teachers with filtering & pagination
   */
  async findAll(
    instituteId: string,
    query: TeacherFilterQueryInput,
  ): Promise<{ data: TeacherSummaryItem[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { instituteId };

    // Status filter
    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    // Specialization filter
    if (query.specialization) {
      where.specialization = {
        contains: query.specialization,
        mode: 'insensitive',
      };
    }

    // Course assignment filter
    if (query.courseId) {
      where.instructingCourses = {
        some: { courseId: query.courseId },
      };
    }

    // Search filter across name, phone, email, employeeCode
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { employeeCode: { contains: s, mode: 'insensitive' } },
        { specialization: { contains: s, mode: 'insensitive' } },
        {
          membership: {
            user: {
              OR: [
                { fullName: { contains: s, mode: 'insensitive' } },
                { phoneE164: { contains: s } },
                { email: { contains: s, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.teacherProfile.count({ where }),
      this.prisma.teacherProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          membership: {
            include: { user: true },
          },
          _count: {
            select: {
              instructingCourses: true,
              batchTeachers: true,
            },
          },
        },
      }),
    ]);

    const data: TeacherSummaryItem[] = records.map((t) => ({
      id: t.id,
      instituteId: t.instituteId,
      userId: t.membership.user.id,
      membershipId: t.membershipId,
      fullName: t.membership.user.fullName,
      phoneE164: t.membership.user.phoneE164,
      email: t.membership.user.email ?? undefined,
      avatarUrl: t.photoUrl || t.membership.user.avatarUrl || undefined,
      employeeCode: t.employeeCode ?? undefined,
      qualifications: t.qualifications ?? undefined,
      specialization: t.specialization ?? undefined,
      experienceYears: t.experienceYears ?? undefined,
      joiningDate: t.joiningDate ? t.joiningDate.toISOString() : undefined,
      status: (t.status as TeacherStatus) || 'ACTIVE',
      assignedCoursesCount: t._count.instructingCourses,
      assignedBatchesCount: t._count.batchTeachers,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single teacher details with full assignments, sessions, and workload
   */
  async findOne(instituteId: string, teacherProfileId: string): Promise<TeacherDetail> {
    const teacher = await this.prisma.teacherProfile.findFirst({
      where: { id: teacherProfileId, instituteId },
      include: {
        membership: {
          include: { user: true },
        },
        instructingCourses: {
          include: {
            course: {
              select: { id: true, title: true, slug: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        batchTeachers: {
          include: {
            batch: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                status: true,
                capacity: true,
                course: { select: { title: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        liveSessions: {
          where: { startsAt: { gte: new Date(Date.now() - 7 * 86400000) } },
          include: {
            batch: { select: { id: true, name: true } },
          },
          orderBy: { startsAt: 'asc' },
          take: 15,
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    const assignedCourses: TeacherAssignedCourse[] = teacher.instructingCourses.map((ic) => ({
      id: ic.id,
      courseId: ic.courseId,
      title: ic.course.title,
      slug: ic.course.slug,
      role: (ic.role as 'LEAD' | 'ASSISTANT') || 'LEAD',
      createdAt: ic.createdAt?.toISOString(),
    }));

    const assignedBatches: TeacherAssignedBatch[] = teacher.batchTeachers.map((bt) => ({
      id: bt.id,
      batchId: bt.batchId,
      name: bt.batch.name,
      courseTitle: bt.batch.course.title,
      role: (bt.role as 'LEAD' | 'ASSISTANT') || 'LEAD',
      startDate: bt.batch.startDate.toISOString(),
      endDate: bt.batch.endDate.toISOString(),
      status: bt.batch.status,
      capacity: bt.batch.capacity,
    }));

    const recentLiveSessions: TeacherLiveSessionItem[] = teacher.liveSessions.map((ls) => ({
      id: ls.id,
      batchId: ls.batchId,
      batchName: ls.batch.name,
      title: ls.title,
      startsAt: ls.startsAt.toISOString(),
      endsAt: ls.endsAt.toISOString(),
      status: ls.status,
      room: ls.room ?? undefined,
      joinUrl: ls.joinUrl ?? undefined,
    }));

    // Calculate workload stats
    const now = new Date();
    const upcomingSessions = teacher.liveSessions.filter(
      (s) => s.startsAt >= now && s.status === 'SCHEDULED',
    );
    const completedSessions = teacher.liveSessions.filter(
      (s) => s.status === 'COMPLETED',
    );

    // Calculate weekly hours from upcoming sessions in next 7 days
    const next7Days = new Date(Date.now() + 7 * 86400000);
    const weeklySessions = upcomingSessions.filter((s) => s.startsAt <= next7Days);
    const weeklyMillis = weeklySessions.reduce((acc, s) => {
      const dur = s.endsAt.getTime() - s.startsAt.getTime();
      return acc + (dur > 0 ? dur : 0);
    }, 0);
    const weeklyHours = Math.round((weeklyMillis / (1000 * 60 * 60)) * 10) / 10;

    const workloadSummary: TeacherWorkloadSummary = {
      totalCourses: assignedCourses.length,
      totalBatches: assignedBatches.length,
      upcomingLiveSessionsCount: upcomingSessions.length,
      totalLiveSessionsConducted: completedSessions.length,
      weeklyHours,
    };

    return {
      id: teacher.id,
      instituteId: teacher.instituteId,
      userId: teacher.membership.user.id,
      membershipId: teacher.membershipId,
      fullName: teacher.membership.user.fullName,
      phoneE164: teacher.membership.user.phoneE164,
      email: teacher.membership.user.email ?? undefined,
      avatarUrl: teacher.photoUrl || teacher.membership.user.avatarUrl || undefined,
      employeeCode: teacher.employeeCode ?? undefined,
      qualifications: teacher.qualifications ?? undefined,
      specialization: teacher.specialization ?? undefined,
      experienceYears: teacher.experienceYears ?? undefined,
      joiningDate: teacher.joiningDate ? teacher.joiningDate.toISOString() : undefined,
      bio: teacher.bio ?? undefined,
      address: teacher.address ? (teacher.address as any) : undefined,
      status: (teacher.status as TeacherStatus) || 'ACTIVE',
      assignedCoursesCount: assignedCourses.length,
      assignedBatchesCount: assignedBatches.length,
      assignedCourses,
      assignedBatches,
      workloadSummary,
      recentLiveSessions,
      createdAt: teacher.createdAt.toISOString(),
      updatedAt: teacher.updatedAt.toISOString(),
    };
  }

  /**
   * Update teacher personal and professional information
   */
  async update(
    instituteId: string,
    teacherProfileId: string,
    input: UpdateTeacherProfileInput,
    actorUserId?: string,
  ): Promise<TeacherDetail> {
    const teacher = await this.prisma.teacherProfile.findFirst({
      where: { id: teacherProfileId, instituteId },
      include: {
        membership: { include: { user: true } },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    // Check duplicate employeeCode if modified
    if (input.employeeCode && input.employeeCode !== teacher.employeeCode) {
      const existingCode = await this.prisma.teacherProfile.findFirst({
        where: {
          instituteId,
          employeeCode: input.employeeCode,
          NOT: { id: teacherProfileId },
        },
      });
      if (existingCode) {
        throw new ConflictException(
          `Employee code ${input.employeeCode} is already assigned to another teacher`,
        );
      }
    }

    // Check duplicate email if modified
    if (input.email && input.email !== teacher.membership.user.email) {
      const existingEmail = await this.prisma.membership.findFirst({
        where: {
          instituteId,
          role: Role.TEACHER,
          user: { email: input.email },
          NOT: { id: teacher.membershipId },
        },
      });
      if (existingEmail) {
        throw new ConflictException(
          `Email ${input.email} is already in use by another teacher in this institute`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Update User if needed
      if (input.fullName || input.email !== undefined || input.photoUrl !== undefined) {
        await tx.user.update({
          where: { id: teacher.membership.userId },
          data: {
            fullName: input.fullName || teacher.membership.user.fullName,
            email: input.email !== undefined ? input.email : teacher.membership.user.email,
            avatarUrl: input.photoUrl !== undefined ? input.photoUrl : teacher.membership.user.avatarUrl,
          },
        });
      }

      // Update TeacherProfile
      await tx.teacherProfile.update({
        where: { id: teacherProfileId },
        data: {
          employeeCode: input.employeeCode !== undefined ? input.employeeCode : teacher.employeeCode,
          qualifications: input.qualifications !== undefined ? input.qualifications : teacher.qualifications,
          specialization: input.specialization !== undefined ? input.specialization : teacher.specialization,
          experienceYears: input.experienceYears !== undefined ? input.experienceYears : teacher.experienceYears,
          joiningDate: input.joiningDate ? new Date(input.joiningDate) : teacher.joiningDate,
          address: input.address !== undefined ? (input.address ? JSON.parse(JSON.stringify(input.address)) : null) : teacher.address,
          bio: input.bio !== undefined ? input.bio : teacher.bio,
          photoUrl: input.photoUrl !== undefined ? input.photoUrl : teacher.photoUrl,
        },
      });
    });

    await this.logAudit(
      instituteId,
      'TEACHER_UPDATED',
      teacherProfileId,
      { updatedFields: Object.keys(input) },
      actorUserId,
    );

    return this.findOne(instituteId, teacherProfileId);
  }

  /**
   * Activate or Deactivate teacher account while strictly preserving all history
   */
  async updateStatus(
    instituteId: string,
    teacherProfileId: string,
    status: 'ACTIVE' | 'INACTIVE',
    reason?: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string; status: TeacherStatus }> {
    const teacher = await this.prisma.teacherProfile.findFirst({
      where: { id: teacherProfileId, instituteId },
      include: { membership: { include: { user: true } } },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    const memberStatus =
      status === 'ACTIVE'
        ? MembershipStatus.ACTIVE
        : MembershipStatus.SUSPENDED;

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherProfile.update({
        where: { id: teacherProfileId },
        data: { status },
      });

      await tx.membership.update({
        where: { id: teacher.membershipId },
        data: { status: memberStatus },
      });
    });

    await this.logAudit(
      instituteId,
      'TEACHER_STATUS_CHANGED',
      teacherProfileId,
      { previousStatus: teacher.status, newStatus: status, reason },
      actorUserId,
    );

    if (this.notificationsService) {
      await this.notificationsService
        .emitTeacherEvent(instituteId, {
          eventType:
            status === 'ACTIVE' ? 'TEACHER_ACTIVATED' : 'TEACHER_DEACTIVATED',
          teacherId: teacherProfileId,
          fullName: teacher.membership?.user?.fullName || 'Faculty Member',
          employeeCode: teacher.employeeCode ?? undefined,
          detail: reason,
          referenceSuffix: `${status}:${Date.now()}`,
        })
        .catch(() => {});
    }

    return {
      success: true,
      message: `Teacher account ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
      status,
    };
  }

  /**
   * Assign teacher to an institute course
   */
  async assignCourse(
    instituteId: string,
    teacherProfileId: string,
    input: AssignTeacherCourseInput,
    actorUserId?: string,
  ): Promise<TeacherAssignedCourse> {
    // 1. Verify teacher in institute
    const teacher = await this.prisma.teacherProfile.findFirst({
      where: { id: teacherProfileId, instituteId },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher not found in this institute');
    }

    // 2. Verify course in institute
    const course = await this.prisma.course.findFirst({
      where: { id: input.courseId, instituteId },
    });
    if (!course) {
      throw new NotFoundException('Course not found in this institute');
    }

    // 3. Prevent duplicate course assignment
    const existing = await this.prisma.courseInstructor.findUnique({
      where: {
        courseId_teacherProfileId: {
          courseId: input.courseId,
          teacherProfileId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Teacher is already assigned to this course');
    }

    const instructor = await this.prisma.courseInstructor.create({
      data: {
        instituteId,
        courseId: input.courseId,
        teacherProfileId,
        role: input.role || 'LEAD',
      },
    });

    await this.logAudit(
      instituteId,
      'TEACHER_COURSE_ASSIGNED',
      teacherProfileId,
      { courseId: input.courseId, role: input.role },
      actorUserId,
    );

    if (this.notificationsService) {
      await this.notificationsService
        .emitTeacherEvent(instituteId, {
          eventType: 'TEACHER_ASSIGNMENT_CHANGED',
          teacherId: teacherProfileId,
          fullName: 'Faculty Member',
          employeeCode: teacher.employeeCode ?? undefined,
          detail: `Faculty member (${teacher.employeeCode || teacherProfileId.slice(0, 6)}) was assigned as ${instructor.role} instructor for course "${course.title}".`,
          referenceSuffix: `course:${course.id}`,
        })
        .catch(() => {});
    }

    return {
      id: instructor.id,
      courseId: course.id,
      title: course.title,
      slug: course.slug,
      role: (instructor.role as 'LEAD' | 'ASSISTANT') || 'LEAD',
      createdAt: instructor.createdAt.toISOString(),
    };
  }

  /**
   * Remove teacher course assignment
   */
  async removeCourse(
    instituteId: string,
    teacherProfileId: string,
    courseId: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const instructor = await this.prisma.courseInstructor.findFirst({
      where: {
        courseId,
        teacherProfileId,
        instituteId,
      },
    });

    if (!instructor) {
      throw new NotFoundException('Course instructor assignment not found');
    }

    await this.prisma.courseInstructor.delete({
      where: { id: instructor.id },
    });

    await this.logAudit(
      instituteId,
      'TEACHER_COURSE_REMOVED',
      teacherProfileId,
      { courseId },
      actorUserId,
    );

    return {
      success: true,
      message: 'Teacher removed from course successfully',
    };
  }

  /**
   * Assign teacher to an institute batch with schedule conflict detection
   */
  async assignBatch(
    instituteId: string,
    teacherProfileId: string,
    input: AssignTeacherBatchInput,
    actorUserId?: string,
  ): Promise<TeacherAssignedBatch> {
    // 1. Verify teacher in institute
    const teacher = await this.prisma.teacherProfile.findFirst({
      where: { id: teacherProfileId, instituteId },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher not found in this institute');
    }

    // 2. Verify batch in institute
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, instituteId },
      include: { course: true },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found in this institute');
    }

    // 3. Prevent duplicate assignment
    const existing = await this.prisma.batchTeacher.findUnique({
      where: {
        batchId_teacherProfileId: {
          batchId: input.batchId,
          teacherProfileId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Teacher is already assigned to this batch');
    }

    const batchTeacher = await this.prisma.batchTeacher.create({
      data: {
        instituteId,
        batchId: input.batchId,
        teacherProfileId,
        role: input.role || 'LEAD',
      },
    });

    await this.logAudit(
      instituteId,
      'TEACHER_BATCH_ASSIGNED',
      teacherProfileId,
      { batchId: input.batchId, role: input.role },
      actorUserId,
    );

    if (this.notificationsService) {
      await this.notificationsService
        .emitTeacherEvent(instituteId, {
          eventType: 'TEACHER_ASSIGNMENT_CHANGED',
          teacherId: teacherProfileId,
          fullName: 'Faculty Member',
          employeeCode: teacher.employeeCode ?? undefined,
          detail: `Faculty member (${teacher.employeeCode || teacherProfileId.slice(0, 6)}) was assigned as ${batchTeacher.role} faculty for batch "${batch.name}".`,
          referenceSuffix: `batch:${batch.id}`,
        })
        .catch(() => {});
    }

    return {
      id: batchTeacher.id,
      batchId: batch.id,
      name: batch.name,
      courseTitle: batch.course.title,
      role: (batchTeacher.role as 'LEAD' | 'ASSISTANT') || 'LEAD',
      startDate: batch.startDate.toISOString(),
      endDate: batch.endDate.toISOString(),
      status: batch.status,
      capacity: batch.capacity,
    };
  }

  /**
   * Remove teacher batch assignment (preserves historical attendance logs)
   */
  async removeBatch(
    instituteId: string,
    teacherProfileId: string,
    batchId: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const assignment = await this.prisma.batchTeacher.findFirst({
      where: {
        batchId,
        teacherProfileId,
        instituteId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Batch teacher assignment not found');
    }

    await this.prisma.batchTeacher.delete({
      where: { id: assignment.id },
    });

    await this.logAudit(
      instituteId,
      'TEACHER_BATCH_REMOVED',
      teacherProfileId,
      { batchId },
      actorUserId,
    );

    return {
      success: true,
      message: 'Teacher removed from batch successfully (historical records preserved)',
    };
  }

  /**
   * Check for scheduling conflicts before session or batch scheduling
   */
  async checkScheduleConflict(
    instituteId: string,
    input: CheckScheduleConflictInput,
  ): Promise<ScheduleConflictResult> {
    const teacherId = input.teacherProfileId;
    if (!teacherId) {
      return { hasConflict: false };
    }

    const start = new Date(input.startsAt);
    const end = new Date(input.endsAt);

    if (start >= end) {
      throw new BadRequestException('Session start time must be before end time');
    }

    const where: any = {
      instituteId,
      teacherProfileId: teacherId,
      status: { in: [LiveSessionStatus.SCHEDULED, LiveSessionStatus.LIVE] },
      // Overlap condition: session.startsAt < end AND session.endsAt > start
      startsAt: { lt: end },
      endsAt: { gt: start },
    };

    if (input.excludeSessionId) {
      where.id = { not: input.excludeSessionId };
    }

    const conflicting = await this.prisma.liveSession.findMany({
      where,
      include: {
        batch: { select: { id: true, name: true } },
        teacherProfile: {
          include: {
            membership: {
              include: { user: { select: { fullName: true } } },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    if (conflicting.length === 0) {
      return { hasConflict: false };
    }

    const first = conflicting[0];
    return {
      hasConflict: true,
      conflictType: 'TEACHER_DOUBLE_BOOKED',
      conflictingSession: {
        id: first.id,
        title: first.title,
        startsAt: first.startsAt.toISOString(),
        endsAt: first.endsAt.toISOString(),
        teacherName: first.teacherProfile?.membership?.user?.fullName,
        room: first.room ?? undefined,
        batchName: first.batch?.name,
      },
      message: `Teacher has an overlapping session "${first.title}" in batch "${first.batch?.name}" (${first.startsAt.toISOString().slice(11, 16)} - ${first.endsAt.toISOString().slice(11, 16)})`,
    };
  }

  /**
   * Self-service method to get authenticated teacher's profile and assignment stats
   */
  async getTeacherMe(user: any) {
    if (!user || (!user.sub && !user.userId)) {
      throw new UnauthorizedException('Authentication token required');
    }
    if (user.role && user.role !== Role.TEACHER) {
      throw new ForbiddenException(
        `Access denied: Current role '${user.role}' is not authorized to access Teacher Portal.`
      );
    }
    const tokenUserId = user.sub || user.userId;
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: tokenUserId,
        role: Role.TEACHER,
        status: 'ACTIVE',
        ...(user.instituteId ? { instituteId: user.instituteId } : {}),
      },
      include: {
        user: true,
        institute: true,
        teacherProfile: true,
      },
    });

    if (!membership || !membership.teacherProfile) {
      throw new ForbiddenException('No active teacher profile found for this account');
    }

    const { teacherProfile, user: u, institute: i } = membership;
    if (teacherProfile.status !== 'ACTIVE') {
      throw new ForbiddenException('Teacher profile is inactive or pending review');
    }

    const [batchCount, courseCount, studentCount] = await Promise.all([
      this.prisma.batchTeacher.count({
        where: { teacherProfileId: teacherProfile.id, instituteId: i.id, batch: { status: 'ACTIVE' } },
      }),
      this.prisma.courseInstructor.count({
        where: { teacherProfileId: teacherProfile.id, instituteId: i.id, course: { status: 'PUBLISHED' } },
      }),
      this.prisma.enrolment.count({
        where: {
          instituteId: i.id,
          status: 'ACTIVE',
          batch: { teachers: { some: { teacherProfileId: teacherProfile.id } } },
        },
      }),
    ]);

    return {
      success: true,
      teacher: {
        teacherProfileId: teacherProfile.id,
        userId: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phoneE164,
        employeeCode: teacherProfile.employeeCode,
        qualifications: teacherProfile.qualifications,
        specialization: teacherProfile.specialization,
        experienceYears: teacherProfile.experienceYears,
        photoUrl: teacherProfile.photoUrl || u.avatarUrl,
        status: teacherProfile.status,
      },
      institute: {
        id: i.id,
        name: i.name,
        code: (i.slug || 'GBI').toUpperCase(),
        logoUrl: i.logoUrl,
      },
      stats: {
        assignedBatchesCount: batchCount,
        assignedCoursesCount: courseCount,
        assignedStudentsCount: studentCount,
      },
    };
  }

  /**
   * Self-service method to get authenticated teacher's dynamic dashboard & analytics
   */
  async getTeacherDashboard(user: any) {
    if (!user || (!user.sub && !user.userId)) {
      throw new UnauthorizedException('Authentication token required');
    }
    if (user.role && user.role !== Role.TEACHER) {
      throw new ForbiddenException(
        `Access denied: Current role '${user.role}' is not authorized to access Teacher Portal.`
      );
    }
    const tokenUserId = user.sub || user.userId;
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: tokenUserId,
        role: Role.TEACHER,
        status: 'ACTIVE',
        ...(user.instituteId ? { instituteId: user.instituteId } : {}),
      },
      include: {
        user: true,
        institute: true,
        teacherProfile: true,
      },
    });

    if (!membership || !membership.teacherProfile) {
      throw new ForbiddenException('No active teacher profile found for this account');
    }

    const { teacherProfile, user: u, institute: i } = membership;
    if (teacherProfile.status !== 'ACTIVE') {
      throw new ForbiddenException('Teacher profile is inactive or pending review');
    }

    const teacherProfileId = teacherProfile.id;
    const instituteId = i.id;

    const [
      batchesCount,
      studentsCount,
      coursesCount,
      assignedBatchesRaw,
      instructorCoursesRaw,
      liveSessionsRaw,
      attendanceRaw,
      examsRaw,
    ] = await Promise.all([
      this.prisma.batchTeacher.count({
        where: { teacherProfileId, instituteId, batch: { status: 'ACTIVE' } },
      }),
      this.prisma.enrolment.findMany({
        where: {
          instituteId,
          status: 'ACTIVE',
          batch: { teachers: { some: { teacherProfileId } } },
        },
        distinct: ['studentProfileId'],
        select: { studentProfileId: true },
      }),
      this.prisma.courseInstructor.count({
        where: { teacherProfileId, instituteId, course: { status: 'PUBLISHED' } },
      }),
      this.prisma.batchTeacher.findMany({
        where: { teacherProfileId, instituteId, batch: { status: 'ACTIVE' } },
        include: {
          batch: {
            include: {
              course: true,
              academicYear: true,
              term: true,
              _count: { select: { enrolments: { where: { status: 'ACTIVE' } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.courseInstructor.findMany({
        where: { teacherProfileId, instituteId },
        select: { courseId: true },
      }),
      this.prisma.liveSession.findMany({
        where: { teacherProfileId, instituteId },
        include: { batch: { include: { course: true } } },
        orderBy: { startsAt: 'desc' },
        take: 10,
      }),
      this.prisma.attendance.findMany({
        where: {
          instituteId,
          batch: { teachers: { some: { teacherProfileId } } },
        },
        select: { status: true, date: true },
      }),
      this.prisma.exam.findMany({
        where: {
          instituteId,
          course: { instructors: { some: { teacherProfileId } } },
        },
        include: { course: true },
        take: 5,
      }),
    ]);

    const teacherCourseIds = instructorCoursesRaw.map((c) => c.courseId);
    const teacherBatchIds = assignedBatchesRaw.map((b) => b.batchId);

    const assignmentsRaw = await this.prisma.assignment.findMany({
      where: {
        instituteId,
        OR: [
          { batchId: { in: teacherBatchIds } },
          { courseId: { in: teacherCourseIds } },
        ],
      },
      include: {
        course: true,
        batch: true,
        submissions: { select: { id: true, status: true } },
      },
      orderBy: { dueAt: 'asc' },
      take: 6,
    });

    // Calculate attendance summary
    const totalRecords = attendanceRaw.length;
    const presentCount = attendanceRaw.filter((a) => a.status === 'PRESENT').length;
    const absentCount = attendanceRaw.filter((a) => a.status === 'ABSENT').length;
    const lateCount = attendanceRaw.filter((a) => a.status === 'LATE').length;
    const excusedCount = attendanceRaw.filter((a) => a.status === 'EXCUSED').length;
    const uniqueDates = new Set(attendanceRaw.map((a) => a.date.toISOString().split('T')[0]));
    const attendanceRatePct = totalRecords > 0 ? Number((((presentCount + lateCount) / totalRecords) * 100).toFixed(1)) : 0;

    // Filter today's classes using institute timezone
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: i.timezone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const todaySchedule = liveSessionsRaw
      .filter((ls) => {
        const sessionDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: i.timezone || 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(ls.startsAt);
        return sessionDate === todayStr;
      })
      .map((ls) => ({
        id: ls.id,
        title: ls.title,
        courseTitle: ls.batch.course.title,
        batchName: ls.batch.name,
        batchCode: ls.batch.code,
        startsAt: ls.startsAt.toISOString(),
        endsAt: ls.endsAt.toISOString(),
        status: ls.status,
        room: ls.room,
        joinUrl: ls.joinUrl,
      }));

    const assignedBatches = assignedBatchesRaw.map((bt) => ({
      id: bt.batch.id,
      name: bt.batch.name,
      code: bt.batch.code,
      courseId: bt.batch.course.id,
      courseTitle: bt.batch.course.title,
      courseSlug: bt.batch.course.slug,
      courseLevel: bt.batch.course.level,
      academicYear: bt.batch.academicYear?.name || null,
      term: bt.batch.term?.name || null,
      enrolledStudentsCount: bt.batch._count.enrolments,
      teacherRole: bt.role,
      status: bt.batch.status,
    }));

    const pendingAssignments = assignmentsRaw.map((a) => {
      const pendingReviewCount = a.submissions.filter((s) => s.status === 'SUBMITTED').length;
      return {
        id: a.id,
        title: a.title,
        courseId: a.course.id,
        courseTitle: a.course.title,
        batchId: a.batch?.id || null,
        batchName: a.batch?.name || null,
        batchCode: a.batch?.code || null,
        dueAt: a.dueAt.toISOString(),
        status: a.status,
        maxMarks: a.maxMarks,
        submissionCount: a.submissions.length,
        pendingReviewCount,
      };
    });

    const pendingAssignmentsCount = pendingAssignments.reduce((acc, a) => acc + a.pendingReviewCount, 0);

    const upcomingEvents = [
      ...liveSessionsRaw.map((ls) => ({
        id: ls.id,
        title: ls.title,
        eventType: 'LIVE_CLASS' as const,
        courseTitle: ls.batch.course.title,
        batchName: ls.batch.name,
        eventDate: ls.startsAt.toISOString(),
        endDate: ls.endsAt.toISOString(),
        status: ls.status,
        room: ls.room,
        joinUrl: ls.joinUrl,
      })),
      ...examsRaw.map((ex) => ({
        id: ex.id,
        title: ex.title,
        eventType: 'EXAMINATION' as const,
        courseTitle: ex.course.title,
        batchName: null,
        eventDate: ex.createdAt.toISOString(),
        endDate: null,
        status: ex.type,
        room: null,
        joinUrl: null,
        durationMin: ex.durationMin,
      })),
    ];

    return {
      success: true,
      teacher: {
        teacherProfileId: teacherProfile.id,
        userId: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phoneE164,
        employeeCode: teacherProfile.employeeCode,
        qualifications: teacherProfile.qualifications,
        specialization: teacherProfile.specialization,
        experienceYears: teacherProfile.experienceYears,
        photoUrl: teacherProfile.photoUrl || u.avatarUrl,
        status: teacherProfile.status,
      },
      institute: {
        id: i.id,
        name: i.name,
        code: (i.slug || 'GBI').toUpperCase(),
        logoUrl: i.logoUrl,
        timezone: i.timezone || 'Asia/Kolkata',
      },
      statistics: {
        assignedBatchesCount: batchesCount,
        assignedStudentsCount: studentsCount.length,
        instructingCoursesCount: coursesCount,
        todayClassesCount: todaySchedule.length,
        pendingAssignmentsCount,
        attendanceRatePct,
        totalAttendanceRecords: totalRecords,
      },
      todaySchedule,
      assignedBatches,
      pendingAssignments,
      upcomingEvents,
      attendanceSummary: {
        totalRecords,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        totalSessionsMarked: uniqueDates.size,
        attendanceRatePct,
      },
    };
  }
}
