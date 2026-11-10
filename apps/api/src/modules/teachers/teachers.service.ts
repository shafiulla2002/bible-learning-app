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
import { Role, MembershipStatus, LiveSessionStatus, AttendanceStatus, AttendanceMode } from '@prisma/client';

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

  /**
   * Helper to resolve and validate the authenticated teacher and active membership
   */
  private async resolveTeacherMembership(user: any) {
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

    if (membership.teacherProfile.status !== 'ACTIVE') {
      throw new ForbiddenException('Teacher profile is inactive or pending review');
    }

    return {
      teacherProfile: membership.teacherProfile,
      membership,
      user: membership.user,
      institute: membership.institute,
      teacherProfileId: membership.teacherProfile.id,
      instituteId: membership.instituteId,
    };
  }

  /**
   * Requirement: Teacher My Students Roster
   * Retrieves all students enrolled in batches assigned to the authenticated teacher.
   */
  async getTeacherStudents(
    user: any,
    options: {
      search?: string;
      batchId?: string;
      status?: string;
      page?: number | string;
      limit?: number | string;
    } = {}
  ) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    // 1. Fetch all assigned batches for this teacher (through BatchTeacher)
    const assignedBatchTeachers = await this.prisma.batchTeacher.findMany({
      where: {
        teacherProfileId,
        instituteId,
      },
      include: {
        batch: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { batch: { name: 'asc' } },
    });

    const assignedBatches = assignedBatchTeachers.map((bt) => ({
      id: bt.batch.id,
      name: bt.batch.name,
      code: bt.batch.code,
      courseTitle: bt.batch.course?.title || 'General Course',
    }));

    const assignedBatchIds = assignedBatchTeachers.map((bt) => bt.batchId);
    if (assignedBatchIds.length === 0) {
      return {
        success: true,
        items: [],
        totalCount: 0,
        page: Number(options.page) || 1,
        limit: Number(options.limit) || 10,
        totalPages: 0,
        assignedBatches: [],
      };
    }

    // 2. Validate requested batchId filter if provided
    let effectiveBatchIds = assignedBatchIds;
    if (options.batchId && options.batchId !== 'ALL') {
      if (!assignedBatchIds.includes(options.batchId)) {
        // Teacher is not assigned to this batch -> Return empty list safely
        return {
          success: true,
          items: [],
          totalCount: 0,
          page: Number(options.page) || 1,
          limit: Number(options.limit) || 10,
          totalPages: 0,
          assignedBatches,
        };
      }
      effectiveBatchIds = [options.batchId];
    }

    // 3. Pagination calculation
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    // 4. Build where condition for enrolments
    const whereClause: any = {
      instituteId,
      batchId: { in: effectiveBatchIds },
      studentProfile: {
        status: 'ACTIVE',
        membership: {
          status: 'ACTIVE',
        },
      },
    };

    if (options.status && options.status !== 'ALL') {
      whereClause.status = options.status;
    }

    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      whereClause.OR = [
        {
          studentProfile: {
            admissionNo: { contains: q, mode: 'insensitive' },
          },
        },
        {
          studentProfile: {
            membership: {
              user: {
                fullName: { contains: q, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    const [totalCount, enrolments] = await Promise.all([
      this.prisma.enrolment.count({ where: whereClause }),
      this.prisma.enrolment.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [
          { studentProfile: { membership: { user: { fullName: 'asc' } } } },
        ],
        include: {
          batch: true,
          course: true,
          studentProfile: {
            include: {
              membership: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items = enrolments.map((e) => {
      const u = e.studentProfile?.membership?.user;
      return {
        id: e.id,
        enrolmentId: e.id,
        studentProfileId: e.studentProfileId,
        admissionNo: e.studentProfile?.admissionNo || 'N/A',
        fullName: u?.fullName || 'Enrolled Student',
        email: u?.email || null,
        phone: u?.phoneE164 ? u.phoneE164.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : null,
        avatarUrl: u?.avatarUrl || null,
        batchId: e.batchId,
        batchName: e.batch?.name || 'Unassigned Batch',
        batchCode: e.batch?.code || null,
        courseId: e.courseId,
        courseTitle: e.course?.title || 'Theological Studies',
        enrolmentStatus: e.status,
        enrolledAt: e.createdAt,
      };
    });

    return {
      success: true,
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      assignedBatches,
    };
  }

  /**
   * Requirement: Teacher Attendance Batches
   * Returns assigned batches with real active student counts.
   */
  async getTeacherAttendanceBatches(user: any) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const assignedBatchTeachers = await this.prisma.batchTeacher.findMany({
      where: {
        teacherProfileId,
        instituteId,
      },
      include: {
        batch: {
          include: {
            course: true,
            _count: {
              select: {
                enrolments: {
                  where: {
                    status: 'ACTIVE',
                    studentProfile: { status: 'ACTIVE', membership: { status: 'ACTIVE' } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { batch: { name: 'asc' } },
    });

    const batches = assignedBatchTeachers.map((bt) => ({
      id: bt.batch.id,
      name: bt.batch.name,
      code: bt.batch.code,
      courseId: bt.batch.courseId,
      courseTitle: bt.batch.course?.title || 'General Course',
      role: bt.role,
      totalStudents: bt.batch._count.enrolments,
      status: bt.batch.status,
    }));

    return {
      success: true,
      batches,
    };
  }

  /**
   * Requirement: Teacher Attendance Roster for Date
   * Validates teacher assignment and returns students with their attendance status.
   */
  async getTeacherAttendanceRoster(user: any, batchId: string, dateStr: string) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    if (!batchId) {
      throw new BadRequestException('batchId is required');
    }

    // Verify teacher is assigned to this batch
    const assignment = await this.prisma.batchTeacher.findFirst({
      where: {
        batchId,
        teacherProfileId,
        instituteId,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'You are not an assigned instructor for this batch and cannot view or take its attendance.'
      );
    }

    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, instituteId },
      include: { course: true },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const isoDateOnly = targetDate.toISOString().slice(0, 10);
    const dateObj = new Date(isoDateOnly);

    // Fetch active enrolled students
    const enrolments = await this.prisma.enrolment.findMany({
      where: {
        instituteId,
        batchId,
        status: 'ACTIVE',
        studentProfile: {
          status: 'ACTIVE',
          membership: { status: 'ACTIVE' },
        },
      },
      include: {
        studentProfile: {
          include: {
            membership: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: { studentProfile: { admissionNo: 'asc' } },
    });

    // Fetch existing attendance records for this batch on targetDate
    const existingAttendance = await this.prisma.attendance.findMany({
      where: {
        instituteId,
        batchId,
        date: dateObj,
      },
    });

    const attendanceMap = new Map(
      existingAttendance.map((a) => [a.studentProfileId, a])
    );

    const roster = enrolments.map((e) => {
      const u = e.studentProfile?.membership?.user;
      const att = attendanceMap.get(e.studentProfileId);
      return {
        studentProfileId: e.studentProfileId,
        admissionNo: e.studentProfile?.admissionNo || 'N/A',
        fullName: u?.fullName || 'Enrolled Student',
        email: u?.email || null,
        enrolmentId: e.id,
        enrolmentStatus: e.status,
        enrolledAt: e.createdAt,
        status: att?.status || 'PRESENT',
        isMarked: Boolean(att),
        remarks: att?.remarks || '',
        markedAt: att?.markedAt || null,
      };
    });

    const presentCount = roster.filter((r) => r.status === 'PRESENT').length;
    const absentCount = roster.filter((r) => r.status === 'ABSENT').length;
    const lateCount = roster.filter((r) => r.status === 'LATE').length;
    const excusedCount = roster.filter((r) => r.status === 'EXCUSED').length;
    const totalCount = roster.length;
    const attendanceRatePct =
      totalCount > 0
        ? Math.round(((presentCount + lateCount) / totalCount) * 100)
        : 0;

    return {
      success: true,
      batch: {
        id: batch.id,
        name: batch.name,
        code: batch.code,
        courseTitle: batch.course?.title || 'General Course',
      },
      date: isoDateOnly,
      summary: {
        totalStudents: totalCount,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        attendanceRatePct,
        isRecorded: existingAttendance.length > 0,
      },
      roster,
    };
  }

  /**
   * Requirement: Mark Teacher Attendance (Atomic Bulk Upsert)
   */
  async markTeacherAttendance(
    user: any,
    payload: {
      batchId: string;
      date: string;
      records: Array<{
        studentProfileId: string;
        enrolmentId?: string;
        status: AttendanceStatus;
        remarks?: string;
      }>;
    }
  ) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    if (!payload.batchId || !payload.date || !Array.isArray(payload.records)) {
      throw new BadRequestException('batchId, date, and records array are required');
    }

    // Verify teacher is assigned to this batch
    const assignment = await this.prisma.batchTeacher.findFirst({
      where: {
        batchId: payload.batchId,
        teacherProfileId,
        instituteId,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'You are not an assigned instructor for this batch and cannot mark its attendance.'
      );
    }

    const isoDateOnly = new Date(payload.date).toISOString().slice(0, 10);
    const dateObj = new Date(isoDateOnly);

    // Verify enrolments for these students
    const studentProfileIds = payload.records.map((r) => r.studentProfileId);
    const enrolments = await this.prisma.enrolment.findMany({
      where: {
        instituteId,
        batchId: payload.batchId,
        studentProfileId: { in: studentProfileIds },
      },
      select: { id: true, studentProfileId: true },
    });
    const enrolmentMap = new Map(enrolments.map((e) => [e.studentProfileId, e.id]));

    const result = await this.prisma.$transaction(async (tx) => {
      let markedCount = 0;

      for (const rec of payload.records) {
        const enrolmentId = rec.enrolmentId || enrolmentMap.get(rec.studentProfileId);
        const existing = await tx.attendance.findFirst({
          where: {
            instituteId,
            batchId: payload.batchId,
            studentProfileId: rec.studentProfileId,
            date: dateObj,
          },
        });

        if (existing) {
          if (existing.status !== rec.status || existing.remarks !== rec.remarks) {
            await tx.attendanceAuditLog.create({
              data: {
                attendanceId: existing.id,
                previousStatus: existing.status,
                newStatus: rec.status,
                previousRemarks: existing.remarks,
                newRemarks: rec.remarks || null,
                changedById: authUser.id,
                changedByRole: 'TEACHER',
              },
            });

            await tx.attendance.update({
              where: { id: existing.id },
              data: {
                status: rec.status,
                remarks: rec.remarks !== undefined ? rec.remarks : existing.remarks,
                updatedById: authUser.id,
              },
            });
          }
        } else {
          const created = await tx.attendance.create({
            data: {
              instituteId,
              batchId: payload.batchId,
              studentProfileId: rec.studentProfileId,
              enrolmentId: enrolmentId || null,
              date: dateObj,
              status: rec.status,
              remarks: rec.remarks || null,
              markedById: authUser.id,
              markedByRole: 'TEACHER',
            },
          });

          await tx.attendanceAuditLog.create({
            data: {
              attendanceId: created.id,
              previousStatus: rec.status,
              newStatus: rec.status,
              previousRemarks: null,
              newRemarks: rec.remarks || null,
              changedById: authUser.id,
              changedByRole: 'TEACHER',
            },
          });
        }
        markedCount++;
      }

      return { markedCount };
    });

    return {
      success: true,
      message: `Successfully recorded attendance for ${result.markedCount} students`,
      date: isoDateOnly,
      batchId: payload.batchId,
      recordsUpdated: result.markedCount,
    };
  }

  /**
   * Requirement: Teacher Assigned Courses
   * Retrieves all courses assigned to the authenticated teacher directly (CourseInstructor)
   * or via batch assignments (BatchTeacher).
   */
  async getTeacherCourses(
    user: any,
    options: {
      search?: string;
      status?: string;
      page?: number | string;
      limit?: number | string;
    } = {}
  ) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    // 1. Fetch directly assigned courses (CourseInstructor)
    const directInstructors = await this.prisma.courseInstructor.findMany({
      where: { teacherProfileId, instituteId },
      select: { courseId: true, role: true },
    });
    const directRoleMap = new Map<string, string>();
    for (const ci of directInstructors) {
      directRoleMap.set(ci.courseId, ci.role || 'LEAD');
    }

    // 2. Fetch courses assigned via batches (BatchTeacher)
    const batchTeachers = await this.prisma.batchTeacher.findMany({
      where: { teacherProfileId, instituteId },
      include: {
        batch: {
          select: {
            id: true,
            name: true,
            code: true,
            courseId: true,
            status: true,
            _count: {
              select: {
                enrolments: {
                  where: { status: 'ACTIVE' },
                },
              },
            },
          },
        },
      },
    });

    const batchRoleMap = new Map<string, string>();
    const teacherBatchesByCourse = new Map<string, any[]>();
    for (const bt of batchTeachers) {
      if (bt.batch?.courseId) {
        if (!batchRoleMap.has(bt.batch.courseId)) {
          batchRoleMap.set(bt.batch.courseId, bt.role || 'INSTRUCTOR');
        }
        const existing = teacherBatchesByCourse.get(bt.batch.courseId) || [];
        existing.push({
          id: bt.batch.id,
          name: bt.batch.name,
          code: bt.batch.code,
          status: bt.batch.status,
          studentCount: bt.batch._count.enrolments,
        });
        teacherBatchesByCourse.set(bt.batch.courseId, existing);
      }
    }

    const assignedCourseIds = Array.from(
      new Set([...Array.from(directRoleMap.keys()), ...Array.from(teacherBatchesByCourse.keys())])
    );

    if (assignedCourseIds.length === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          page: Number(options.page) || 1,
          limit: Number(options.limit) || 10,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {
      id: { in: assignedCourseIds },
      instituteId,
      deletedAt: null,
    };

    if (options.status && options.status !== 'ALL') {
      where.status = options.status;
    }

    if (options.search?.trim()) {
      const s = options.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.course.count({ where });

    const courses = await this.prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
        modules: {
          orderBy: { position: 'asc' },
          include: {
            chapters: {
              orderBy: { position: 'asc' },
              include: {
                lessons: {
                  orderBy: { position: 'asc' },
                  include: {
                    resources: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const data = courses.map((course) => {
      let lessonCount = 0;
      let resourceCount = 0;
      let totalDurationSec = 0;
      let chapterCount = 0;

      for (const m of course.modules) {
        chapterCount += m.chapters.length;
        for (const ch of m.chapters) {
          lessonCount += ch.lessons.length;
          for (const l of ch.lessons) {
            totalDurationSec += l.durationSec || 0;
            resourceCount += l.resources.length;
          }
        }
      }

      const assignedBatches = teacherBatchesByCourse.get(course.id) || [];
      const studentCount = assignedBatches.reduce((acc, b) => acc + b.studentCount, 0);

      const role = directRoleMap.get(course.id) || batchRoleMap.get(course.id) || 'INSTRUCTOR';

      return {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        coverImage: course.coverImage,
        level: course.level,
        language: course.language,
        status: course.status,
        category: course.category?.name || 'Uncategorized',
        categoryId: course.categoryId,
        role,
        batchCount: assignedBatches.length,
        studentCount,
        assignedBatches,
        curriculumStats: {
          moduleCount: course.modules.length,
          chapterCount,
          lessonCount,
          resourceCount,
          totalDurationMinutes: Math.round(totalDurationSec / 60),
        },
        updatedAt: course.updatedAt.toISOString(),
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Requirement: Teacher Course Detail & Full Curriculum Hierarchy
   * Validates teacher assignment and returns complete Modules -> Chapters -> Lessons -> Resources
   */
  async getTeacherCourseDetail(user: any, courseId: string) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    // Verify teacher assignment
    const isDirect = await this.prisma.courseInstructor.findFirst({
      where: { courseId, teacherProfileId, instituteId },
    });
    const isBatch = await this.prisma.batchTeacher.findFirst({
      where: {
        teacherProfileId,
        instituteId,
        batch: { courseId },
      },
    });

    if (!isDirect && !isBatch) {
      throw new ForbiddenException(
        'You are not assigned to instruct or teach this course.'
      );
    }

    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        instituteId,
        deletedAt: null,
      },
      include: {
        category: true,
        instructors: {
          include: {
            teacherProfile: {
              include: {
                membership: {
                  include: {
                    user: {
                      select: { id: true, fullName: true, email: true, avatarUrl: true },
                    },
                  },
                },
              },
            },
          },
        },
        batches: {
          where: {
            teachers: { some: { teacherProfileId } },
          },
          include: {
            _count: {
              select: {
                enrolments: { where: { status: 'ACTIVE' } },
              },
            },
          },
        },
        modules: {
          orderBy: { position: 'asc' },
          include: {
            chapters: {
              orderBy: { position: 'asc' },
              include: {
                lessons: {
                  orderBy: { position: 'asc' },
                  include: {
                    resources: {
                      include: {
                        mediaAsset: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found in this institute');
    }

    let lessonCount = 0;
    let resourceCount = 0;
    let totalDurationSec = 0;
    let chapterCount = 0;

    const modules = course.modules.map((m) => {
      chapterCount += m.chapters.length;
      const chapters = m.chapters.map((ch) => {
        lessonCount += ch.lessons.length;
        const lessons = ch.lessons.map((l) => {
          totalDurationSec += l.durationSec || 0;
          resourceCount += l.resources.length;

          const resources = l.resources.map((r) => ({
            id: r.id,
            lessonId: r.lessonId,
            mediaAssetId: r.mediaAssetId,
            storageKey: r.mediaAsset?.storageKey || '',
            kind: r.mediaAsset?.kind || 'FILE',
            mimeType: r.mediaAsset?.mimeType || '',
            sizeBytes: r.mediaAsset?.sizeBytes ? r.mediaAsset.sizeBytes.toString() : '0',
            downloadable: r.downloadable,
            createdAt: r.createdAt.toISOString(),
          }));

          return {
            id: l.id,
            title: l.title,
            type: l.type,
            body: l.body,
            durationSec: l.durationSec,
            isPreview: l.isPreview,
            isMandatory: l.isMandatory,
            position: l.position,
            resources,
            createdAt: l.createdAt.toISOString(),
            updatedAt: l.updatedAt.toISOString(),
          };
        });

        return {
          id: ch.id,
          title: ch.title,
          position: ch.position,
          lessons,
          createdAt: ch.createdAt.toISOString(),
          updatedAt: ch.updatedAt.toISOString(),
        };
      });

      return {
        id: m.id,
        title: m.title,
        position: m.position,
        chapters,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      };
    });

    const assignedBatches = course.batches.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      studentCount: b._count.enrolments,
    }));

    const role = isDirect ? isDirect.role : (isBatch ? isBatch.role : 'INSTRUCTOR');

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      coverImage: course.coverImage,
      level: course.level,
      language: course.language,
      pricing: course.pricing,
      price: course.price,
      salePrice: course.salePrice,
      status: course.status,
      category: course.category?.name || 'Uncategorized',
      categoryId: course.categoryId,
      role,
      instructors: course.instructors.map((ci) => ({
        id: ci.id,
        role: ci.role,
        teacherProfileId: ci.teacherProfileId,
        fullName: ci.teacherProfile?.membership?.user?.fullName || 'Instructor',
        email: ci.teacherProfile?.membership?.user?.email || null,
        avatarUrl: ci.teacherProfile?.membership?.user?.avatarUrl || null,
      })),
      assignedBatches,
      summary: {
        moduleCount: course.modules.length,
        chapterCount,
        lessonCount,
        resourceCount,
        totalDurationMinutes: Math.round(totalDurationSec / 60),
      },
      modules,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
    };
  }

  /**
   * Requirement: Teacher Learning Materials Directory
   * Returns all lesson resources across courses assigned to the teacher, with filtering.
   */
  async getTeacherMaterials(
    user: any,
    options: {
      courseId?: string;
      kind?: string;
      search?: string;
      page?: number | string;
      limit?: number | string;
    } = {}
  ) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    // 1. Get all assigned course IDs
    const directInstructors = await this.prisma.courseInstructor.findMany({
      where: { teacherProfileId, instituteId },
      select: { courseId: true },
    });
    const batchTeachers = await this.prisma.batchTeacher.findMany({
      where: { teacherProfileId, instituteId },
      select: { batch: { select: { courseId: true } } },
    });

    const directCourseIds = directInstructors.map((ci) => ci.courseId);
    const batchCourseIds = batchTeachers
      .map((bt) => bt.batch?.courseId)
      .filter((id): id is string => Boolean(id));
    const assignedCourseIds = Array.from(new Set([...directCourseIds, ...batchCourseIds]));

    if (assignedCourseIds.length === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          page: Number(options.page) || 1,
          limit: Number(options.limit) || 20,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    if (options.courseId && !assignedCourseIds.includes(options.courseId)) {
      throw new ForbiddenException('You do not have access to materials for this course.');
    }

    const targetCourseIds = options.courseId ? [options.courseId] : assignedCourseIds;

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      instituteId,
      lesson: {
        chapter: {
          module: {
            courseId: { in: targetCourseIds },
          },
        },
      },
    };

    if (options.kind && options.kind !== 'ALL') {
      where.mediaAsset = { kind: options.kind };
    }

    if (options.search?.trim()) {
      const s = options.search.trim();
      where.OR = [
        { mediaAsset: { storageKey: { contains: s, mode: 'insensitive' } } },
        { lesson: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const total = await this.prisma.lessonResource.count({ where });

    const resources = await this.prisma.lessonResource.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        mediaAsset: true,
        lesson: {
          select: {
            id: true,
            title: true,
            type: true,
            chapter: {
              select: {
                id: true,
                title: true,
                module: {
                  select: {
                    id: true,
                    title: true,
                    course: {
                      select: {
                        id: true,
                        title: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const data = resources.map((r) => {
      const fileName = r.mediaAsset?.storageKey
        ? r.mediaAsset.storageKey.split('/').pop() || r.mediaAsset.storageKey
        : r.lesson.title;

      return {
        id: r.id,
        lessonId: r.lessonId,
        lessonTitle: r.lesson.title,
        lessonType: r.lesson.type,
        chapterTitle: r.lesson.chapter?.title || 'Unknown Chapter',
        moduleTitle: r.lesson.chapter?.module?.title || 'Unknown Module',
        courseId: r.lesson.chapter?.module?.course?.id || '',
        courseTitle: r.lesson.chapter?.module?.course?.title || 'Unknown Course',
        mediaAssetId: r.mediaAssetId,
        title: fileName,
        storageKey: r.mediaAsset?.storageKey || '',
        kind: r.mediaAsset?.kind || 'FILE',
        mimeType: r.mediaAsset?.mimeType || '',
        sizeBytes: r.mediaAsset?.sizeBytes ? r.mediaAsset.sizeBytes.toString() : '0',
        downloadable: r.downloadable,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Requirement: Authorized Study Material Upload
   * Validates teacher assignment to the course and attaches MediaAsset/LessonResource.
   */
  async uploadTeacherResource(
    user: any,
    courseId: string,
    lessonId: string,
    payload: {
      kind: string;
      storageKey: string;
      mimeType: string;
      sizeBytes?: string | number;
      downloadable?: boolean;
    }
  ) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    if (!payload.storageKey || !payload.kind) {
      throw new BadRequestException('storageKey and kind are required');
    }

    // Verify teacher assignment to this course
    const isDirect = await this.prisma.courseInstructor.findFirst({
      where: { courseId, teacherProfileId, instituteId },
    });
    const isBatch = await this.prisma.batchTeacher.findFirst({
      where: {
        teacherProfileId,
        instituteId,
        batch: { courseId },
      },
    });

    if (!isDirect && !isBatch) {
      throw new ForbiddenException(
        'You are not assigned to instruct or teach this course, cannot upload materials.'
      );
    }

    // Verify lesson belongs to this course
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        instituteId,
        chapter: {
          module: {
            courseId,
            instituteId,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found in this course');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let asset = await tx.mediaAsset.findUnique({
        where: { storageKey: payload.storageKey },
      });

      if (!asset) {
        asset = await tx.mediaAsset.create({
          data: {
            instituteId,
            ownerUserId: authUser.id,
            kind: payload.kind,
            storageKey: payload.storageKey,
            mimeType: payload.mimeType || 'application/octet-stream',
            sizeBytes: BigInt(payload.sizeBytes || 1024000),
          },
        });
      }

      const resource = await tx.lessonResource.create({
        data: {
          instituteId,
          lessonId,
          mediaAssetId: asset.id,
          downloadable: payload.downloadable !== undefined ? payload.downloadable : true,
        },
        include: {
          mediaAsset: true,
        },
      });

      return resource;
    });

    return {
      success: true,
      data: {
        id: result.id,
        lessonId: result.lessonId,
        mediaAssetId: result.mediaAssetId,
        kind: result.mediaAsset.kind,
        storageKey: result.mediaAsset.storageKey,
        mimeType: result.mediaAsset.mimeType,
        sizeBytes: result.mediaAsset.sizeBytes.toString(),
        downloadable: result.downloadable,
        createdAt: result.createdAt.toISOString(),
      },
    };
  }

  /**
   * Requirement: Teacher Assignments List
   * Retrieves all assignments belonging to courses or batches assigned to the authenticated teacher.
   */
  async getTeacherAssignments(
    user: any,
    options: {
      search?: string;
      status?: string;
      courseId?: string;
      batchId?: string;
      page?: number | string;
      limit?: number | string;
    } = {}
  ) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    // 1. Fetch authorized course IDs and batch IDs
    const directInstructors = await this.prisma.courseInstructor.findMany({
      where: { teacherProfileId, instituteId },
      select: { courseId: true },
    });
    const batchTeachers = await this.prisma.batchTeacher.findMany({
      where: { teacherProfileId, instituteId },
      select: { batchId: true, batch: { select: { courseId: true } } },
    });

    const directCourseIds = directInstructors.map((ci) => ci.courseId);
    const batchCourseIds = batchTeachers
      .map((bt) => bt.batch?.courseId)
      .filter((id): id is string => Boolean(id));
    const assignedCourseIds = Array.from(new Set([...directCourseIds, ...batchCourseIds]));
    const assignedBatchIds = batchTeachers.map((bt) => bt.batchId);

    if (assignedCourseIds.length === 0 && assignedBatchIds.length === 0) {
      return {
        data: [],
        meta: {
          total: 0,
          page: Number(options.page) || 1,
          limit: Number(options.limit) || 10,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {
      instituteId,
      OR: [
        { courseId: { in: assignedCourseIds } },
        { batchId: { in: assignedBatchIds } },
      ],
    };

    if (options.status && options.status !== 'ALL') {
      where.status = options.status;
    }

    if (options.courseId && options.courseId !== 'ALL') {
      if (!assignedCourseIds.includes(options.courseId)) {
        throw new ForbiddenException('You are not authorized to view assignments for this course.');
      }
      where.courseId = options.courseId;
    }

    if (options.batchId && options.batchId !== 'ALL') {
      if (!assignedBatchIds.includes(options.batchId)) {
        throw new ForbiddenException('You are not authorized to view assignments for this batch.');
      }
      where.batchId = options.batchId;
    }

    if (options.search?.trim()) {
      const s = options.search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: s, mode: 'insensitive' } },
            { instructions: { contains: s, mode: 'insensitive' } },
            { course: { title: { contains: s, mode: 'insensitive' } } },
            { batch: { name: { contains: s, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const total = await this.prisma.assignment.count({ where });

    const assignments = await this.prisma.assignment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { dueAt: 'desc' },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        batch: { select: { id: true, name: true, code: true } },
        submissions: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            marksAwarded: true,
          },
        },
      },
    });

    // Compute active enrolments for the courses/batches in this list
    const courseIds = Array.from(new Set(assignments.map((a) => a.courseId)));
    const batchIds = Array.from(
      new Set(assignments.map((a) => a.batchId).filter((id): id is string => Boolean(id)))
    );

    const courseEnrolments = await this.prisma.enrolment.groupBy({
      by: ['courseId'],
      where: {
        courseId: { in: courseIds },
        instituteId,
        status: 'ACTIVE',
      },
      _count: { id: true },
    });

    const courseEnrolmentMap = new Map<string, number>();
    for (const ce of courseEnrolments) {
      if (ce.courseId) courseEnrolmentMap.set(ce.courseId, ce._count.id);
    }

    const batchEnrolmentMap = new Map<string, number>();
    if (batchIds.length > 0) {
      const batchEnrolments = await this.prisma.enrolment.groupBy({
        by: ['batchId'],
        where: {
          batchId: { in: batchIds },
          instituteId,
          status: 'ACTIVE',
        },
        _count: { id: true },
      });
      for (const be of batchEnrolments) {
        if (be.batchId) batchEnrolmentMap.set(be.batchId, be._count.id);
      }
    }

    const data = assignments.map((a) => {
      const totalStudents: number = a.batchId
        ? (batchEnrolmentMap.get(a.batchId) || 0)
        : (courseEnrolmentMap.get(a.courseId) || 0);

      const submittedCount = a.submissions.length;
      const gradedCount = a.submissions.filter((s) => s.status === 'GRADED').length;
      const pendingCount = Math.max(0, totalStudents - submittedCount);
      const lateCount = a.submissions.filter(
        (s) => new Date(s.submittedAt) > new Date(a.dueAt)
      ).length;

      return {
        id: a.id,
        title: a.title,
        instructions: a.instructions,
        dueAt: a.dueAt.toISOString(),
        maxMarks: a.maxMarks,
        status: a.status,
        courseId: a.courseId,
        courseTitle: a.course?.title || 'Unknown Course',
        batchId: a.batchId || null,
        batchName: a.batch?.name || 'All Cohorts',
        totalStudents,
        submittedCount,
        gradedCount,
        pendingCount,
        lateCount,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Requirement: Teacher Assignment Detail & Student Submissions Roster
   */
  async getTeacherAssignmentDetail(user: any, assignmentId: string) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, instituteId },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        batch: { select: { id: true, name: true, code: true } },
        submissions: {
          include: {
            studentProfile: {
              include: {
                membership: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phoneE164: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found in your institute');
    }

    // Verify teacher assignment to this course or batch
    const isDirectCourse = await this.prisma.courseInstructor.findFirst({
      where: { courseId: assignment.courseId, teacherProfileId, instituteId },
    });
    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: {
        teacherProfileId,
        instituteId,
        ...(assignment.batchId
          ? { batchId: assignment.batchId }
          : { batch: { courseId: assignment.courseId } }),
      },
    });

    if (!isDirectCourse && !isBatchTeacher) {
      throw new ForbiddenException(
        'You are not authorized to view or manage submissions for this assignment.'
      );
    }

    // Fetch all active enrolled students for the assignment's scope
    const enrolmentWhere: any = {
      instituteId,
      status: 'ACTIVE',
      studentProfile: { status: 'ACTIVE', membership: { status: 'ACTIVE' } },
    };
    if (assignment.batchId) {
      enrolmentWhere.batchId = assignment.batchId;
    } else {
      enrolmentWhere.courseId = assignment.courseId;
    }

    const enrolments = await this.prisma.enrolment.findMany({
      where: enrolmentWhere,
      include: {
        batch: { select: { id: true, name: true, code: true } },
        studentProfile: {
          include: {
            membership: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phoneE164: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { studentProfile: { admissionNo: 'asc' } },
    });

    const submissionMap = new Map(
      assignment.submissions.map((s) => [s.studentProfileId, s])
    );

    const submissionsRoster = enrolments.map((e) => {
      const sp = e.studentProfile;
      const u = sp?.membership?.user;
      const sub = submissionMap.get(sp.id);

      const isLate = sub ? new Date(sub.submittedAt) > new Date(assignment.dueAt) : false;

      return {
        studentProfileId: sp.id,
        admissionNo: sp.admissionNo || 'N/A',
        studentName: u?.fullName || 'Enrolled Student',
        email: u?.email || null,
        phone: u?.phoneE164 || null,
        avatarUrl: u?.avatarUrl || null,
        batchName: e.batch?.name || assignment.batch?.name || 'General Batch',
        submissionId: sub?.id || null,
        status: sub ? sub.status : 'PENDING',
        submittedAt: sub ? sub.submittedAt.toISOString() : null,
        isLate,
        answerText: sub?.answerText || null,
        fileUrl: sub?.fileUrl || null,
        marksAwarded: sub?.marksAwarded ?? null,
        maxMarks: assignment.maxMarks,
        feedback: sub?.feedback || null,
      };
    });

    const totalStudents = submissionsRoster.length;
    const submittedCount = submissionsRoster.filter((r) => r.status !== 'PENDING').length;
    const gradedCount = submissionsRoster.filter((r) => r.status === 'GRADED').length;
    const pendingCount = submissionsRoster.filter((r) => r.status === 'PENDING').length;
    const lateCount = submissionsRoster.filter((r) => r.isLate).length;

    return {
      success: true,
      assignment: {
        id: assignment.id,
        title: assignment.title,
        instructions: assignment.instructions,
        dueAt: assignment.dueAt.toISOString(),
        maxMarks: assignment.maxMarks,
        status: assignment.status,
        courseId: assignment.courseId,
        courseTitle: assignment.course?.title || 'Unknown Course',
        batchId: assignment.batchId || null,
        batchName: assignment.batch?.name || 'All Cohorts',
        createdAt: assignment.createdAt.toISOString(),
        updatedAt: assignment.updatedAt.toISOString(),
        summary: {
          totalStudents,
          submittedCount,
          gradedCount,
          pendingCount,
          lateCount,
        },
        submissions: submissionsRoster,
      },
    };
  }

  /**
   * Requirement: Create Teacher Assignment
   */
  async createTeacherAssignment(
    user: any,
    payload: {
      courseId: string;
      batchId?: string;
      title: string;
      instructions: string;
      dueAt: string;
      maxMarks?: number | string;
      status?: string;
    }
  ) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    if (!payload.courseId || !payload.title?.trim() || !payload.instructions?.trim() || !payload.dueAt) {
      throw new BadRequestException('courseId, title, instructions, and dueAt are required');
    }

    const maxMarks = Math.max(1, parseInt(String(payload.maxMarks || 100), 10));
    const dueAtDate = new Date(payload.dueAt);
    if (isNaN(dueAtDate.getTime())) {
      throw new BadRequestException('Invalid due date');
    }

    // Verify teacher is assigned to this course
    const isDirectCourse = await this.prisma.courseInstructor.findFirst({
      where: { courseId: payload.courseId, teacherProfileId, instituteId },
    });
    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: {
        teacherProfileId,
        instituteId,
        ...(payload.batchId
          ? { batchId: payload.batchId }
          : { batch: { courseId: payload.courseId } }),
      },
    });

    if (!isDirectCourse && !isBatchTeacher) {
      throw new ForbiddenException(
        'You are not authorized to create assignments for this course or cohort.'
      );
    }

    if (payload.batchId) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: payload.batchId, courseId: payload.courseId, instituteId },
      });
      if (!batch) {
        throw new BadRequestException('Selected batch does not belong to this course or institute');
      }
    }

    const assignmentStatus = payload.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';

    const assignment = await this.prisma.assignment.create({
      data: {
        instituteId,
        courseId: payload.courseId,
        batchId: payload.batchId || null,
        title: payload.title.trim(),
        instructions: payload.instructions.trim(),
        dueAt: dueAtDate,
        maxMarks,
        status: assignmentStatus,
      },
      include: {
        course: { select: { id: true, title: true } },
        batch: { select: { id: true, name: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'CREATE_ASSIGNMENT',
        entityType: 'Assignment',
        entityId: assignment.id,
        metadata: {
          title: assignment.title,
          courseId: assignment.courseId,
          batchId: assignment.batchId,
          dueAt: assignment.dueAt.toISOString(),
          maxMarks: assignment.maxMarks,
          status: assignment.status,
        },
      },
    });

    if (this.notificationsService && assignmentStatus === 'PUBLISHED') {
      await this.notificationsService.safeEmit(() =>
        this.notificationsService!.emitAssignmentPublished(instituteId, {
          assignmentId: assignment.id,
          title: assignment.title,
          courseId: assignment.courseId,
          batchId: assignment.batchId || undefined,
          dueDate: assignment.dueAt,
        }),
      );
    }

    return {
      success: true,
      message: 'Assignment created successfully',
      data: {
        id: assignment.id,
        title: assignment.title,
        instructions: assignment.instructions,
        dueAt: assignment.dueAt.toISOString(),
        maxMarks: assignment.maxMarks,
        status: assignment.status,
        courseId: assignment.courseId,
        courseTitle: assignment.course?.title,
        batchId: assignment.batchId,
        batchName: assignment.batch?.name || 'All Cohorts',
        createdAt: assignment.createdAt.toISOString(),
      },
    };
  }

  /**
   * Requirement: Update Teacher Assignment
   */
  async updateTeacherAssignment(
    user: any,
    assignmentId: string,
    payload: {
      title?: string;
      instructions?: string;
      dueAt?: string;
      maxMarks?: number | string;
      status?: string;
    }
  ) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, instituteId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found in your institute');
    }

    // Verify teacher assignment
    const isDirectCourse = await this.prisma.courseInstructor.findFirst({
      where: { courseId: assignment.courseId, teacherProfileId, instituteId },
    });
    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: {
        teacherProfileId,
        instituteId,
        ...(assignment.batchId
          ? { batchId: assignment.batchId }
          : { batch: { courseId: assignment.courseId } }),
      },
    });

    if (!isDirectCourse && !isBatchTeacher) {
      throw new ForbiddenException('You are not authorized to edit this assignment.');
    }

    if (payload.maxMarks !== undefined) {
      const newMax = parseInt(String(payload.maxMarks), 10);
      if (isNaN(newMax) || newMax <= 0) {
        throw new BadRequestException('Maximum marks must be greater than 0');
      }

      // Check existing awarded marks
      const highestAwarded = await this.prisma.submission.findFirst({
        where: { assignmentId, marksAwarded: { not: null } },
        orderBy: { marksAwarded: 'desc' },
        select: { marksAwarded: true },
      });

      if (highestAwarded && highestAwarded.marksAwarded !== null && highestAwarded.marksAwarded > newMax) {
        throw new BadRequestException(
          `Cannot reduce max marks to ${newMax} because a student has already been awarded ${highestAwarded.marksAwarded} marks.`
        );
      }
    }

    let parsedDueAt: Date | undefined;
    if (payload.dueAt) {
      parsedDueAt = new Date(payload.dueAt);
      if (isNaN(parsedDueAt.getTime())) {
        throw new BadRequestException('Invalid due date');
      }
    }

    const updated = await this.prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        ...(payload.title ? { title: payload.title.trim() } : {}),
        ...(payload.instructions ? { instructions: payload.instructions.trim() } : {}),
        ...(parsedDueAt ? { dueAt: parsedDueAt } : {}),
        ...(payload.maxMarks !== undefined ? { maxMarks: parseInt(String(payload.maxMarks), 10) } : {}),
        ...(payload.status ? { status: payload.status } : {}),
      },
      include: {
        course: { select: { id: true, title: true } },
        batch: { select: { id: true, name: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'UPDATE_ASSIGNMENT',
        entityType: 'Assignment',
        entityId: updated.id,
        metadata: {
          previousTitle: assignment.title,
          newTitle: updated.title,
          previousStatus: assignment.status,
          newStatus: updated.status,
          previousDueAt: assignment.dueAt.toISOString(),
          newDueAt: updated.dueAt.toISOString(),
          previousMaxMarks: assignment.maxMarks,
          newMaxMarks: updated.maxMarks,
        },
      },
    });

    return {
      success: true,
      message: 'Assignment updated successfully',
      data: {
        id: updated.id,
        title: updated.title,
        instructions: updated.instructions,
        dueAt: updated.dueAt.toISOString(),
        maxMarks: updated.maxMarks,
        status: updated.status,
        courseId: updated.courseId,
        courseTitle: updated.course?.title,
        batchId: updated.batchId,
        batchName: updated.batch?.name || 'All Cohorts',
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }

  /**
   * Requirement: Grade Teacher Submission
   */
  async gradeTeacherSubmission(
    user: any,
    assignmentId: string,
    submissionId: string,
    payload: {
      marksAwarded: number | string;
      feedback?: string;
    }
  ) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, instituteId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Verify teacher assignment
    const isDirectCourse = await this.prisma.courseInstructor.findFirst({
      where: { courseId: assignment.courseId, teacherProfileId, instituteId },
    });
    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: {
        teacherProfileId,
        instituteId,
        ...(assignment.batchId
          ? { batchId: assignment.batchId }
          : { batch: { courseId: assignment.courseId } }),
      },
    });

    if (!isDirectCourse && !isBatchTeacher) {
      throw new ForbiddenException('You are not authorized to grade submissions for this assignment.');
    }

    const marks = Number(payload.marksAwarded);
    if (isNaN(marks) || marks < 0 || marks > assignment.maxMarks) {
      throw new BadRequestException(
        `Marks awarded must be an integer between 0 and ${assignment.maxMarks}`
      );
    }

    const existingSubmission = await this.prisma.submission.findFirst({
      where: { id: submissionId, assignmentId, instituteId },
      include: {
        studentProfile: {
          include: {
            membership: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });

    if (!existingSubmission) {
      throw new NotFoundException('Submission not found for this assignment');
    }

    const updated = await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        marksAwarded: Math.round(marks),
        feedback: payload.feedback !== undefined ? payload.feedback.trim() : existingSubmission.feedback,
        status: 'GRADED',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'GRADE_SUBMISSION',
        entityType: 'Submission',
        entityId: submissionId,
        metadata: {
          assignmentId,
          studentProfileId: existingSubmission.studentProfileId,
          studentName: existingSubmission.studentProfile?.membership?.user?.fullName,
          previousMarks: existingSubmission.marksAwarded,
          marksAwarded: updated.marksAwarded,
          previousFeedback: existingSubmission.feedback,
          feedback: updated.feedback,
          maxMarks: assignment.maxMarks,
        },
      },
    });

    if (this.notificationsService) {
      const studentUserId = existingSubmission.studentProfile?.membership?.userId;
      if (studentUserId) {
        await this.notificationsService.safeEmit(() =>
          this.notificationsService!.emitAssignmentGraded(instituteId, {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            studentUserId,
            score: updated.marksAwarded ?? 0,
            maxMarks: assignment.maxMarks,
            feedback: updated.feedback || undefined,
          }),
        );
      }
    }

    return {
      success: true,
      message: 'Submission graded successfully',
      data: {
        id: updated.id,
        assignmentId: updated.assignmentId,
        studentProfileId: updated.studentProfileId,
        marksAwarded: updated.marksAwarded,
        maxMarks: assignment.maxMarks,
        feedback: updated.feedback,
        status: updated.status,
      },
    };
  }

  // =========================================================================
  // PHASE 6: EXAMINATIONS & ONLINE TESTS MANAGEMENT
  // =========================================================================

  private async verifyTeacherCourseOrBatchAccess(
    teacherProfileId: string,
    instituteId: string,
    courseId: string,
    batchId?: string | null
  ) {
    const isDirectCourse = await this.prisma.courseInstructor.findFirst({
      where: { courseId, teacherProfileId, instituteId },
    });
    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: {
        teacherProfileId,
        instituteId,
        ...(batchId
          ? { batchId }
          : { batch: { courseId } }),
      },
    });

    if (!isDirectCourse && !isBatchTeacher) {
      throw new ForbiddenException('You are not authorized to manage examinations for this course or batch.');
    }
  }

  async getTeacherExams(user: any, options: any = {}) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const [instructorCourses, assignedBatches] = await Promise.all([
      this.prisma.courseInstructor.findMany({
        where: { teacherProfileId, instituteId },
        select: { courseId: true },
      }),
      this.prisma.batchTeacher.findMany({
        where: { teacherProfileId, instituteId },
        include: { batch: { select: { id: true, courseId: true } } },
      }),
    ]);

    const assignedCourseIds = Array.from(
      new Set([
        ...instructorCourses.map((ci) => ci.courseId),
        ...assignedBatches.map((bt) => bt.batch.courseId),
      ])
    );
    const assignedBatchIds = Array.from(new Set(assignedBatches.map((bt) => bt.batch.id)));

    if (assignedCourseIds.length === 0 && assignedBatchIds.length === 0) {
      return {
        success: true,
        data: [],
        metrics: {
          total: 0,
          published: 0,
          draft: 0,
          scheduled: 0,
          completed: 0,
          totalAttempts: 0,
          pendingEvaluations: 0,
          avgScore: 0,
        },
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
    }

    if (options.courseId && options.courseId !== 'ALL' && !assignedCourseIds.includes(options.courseId)) {
      throw new ForbiddenException('You are not authorized to view examinations for this course');
    }
    if (options.batchId && options.batchId !== 'ALL' && !assignedBatchIds.includes(options.batchId)) {
      throw new ForbiddenException('You are not authorized to view examinations for this batch');
    }

    const whereClause: any = {
      instituteId,
      OR: [
        { courseId: { in: assignedCourseIds } },
        ...(assignedBatchIds.length > 0 ? [{ batchId: { in: assignedBatchIds } }] : []),
      ],
    };

    if (options.courseId && options.courseId !== 'ALL') {
      whereClause.courseId = options.courseId;
    }
    if (options.batchId && options.batchId !== 'ALL') {
      whereClause.batchId = options.batchId;
    }
    if (options.status && options.status !== 'ALL') {
      whereClause.status = options.status;
    }
    if (options.search && options.search.trim()) {
      whereClause.OR = [
        { title: { contains: options.search.trim(), mode: 'insensitive' } },
        { course: { title: { contains: options.search.trim(), mode: 'insensitive' } } },
      ];
    }

    const page = Math.max(1, parseInt(options.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(options.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const [allExamsForMetrics, exams, totalCount] = await Promise.all([
      this.prisma.exam.findMany({
        where: {
          instituteId,
          OR: [
            { courseId: { in: assignedCourseIds } },
            ...(assignedBatchIds.length > 0 ? [{ batchId: { in: assignedBatchIds } }] : []),
          ],
        },
        include: {
          attempts: { select: { id: true, status: true, score: true } },
        },
      }),
      this.prisma.exam.findMany({
        where: whereClause,
        include: {
          course: { select: { id: true, title: true } },
          batch: { select: { id: true, name: true, code: true } },
          questions: { select: { id: true, marks: true } },
          attempts: { select: { id: true, status: true, score: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.exam.count({ where: whereClause }),
    ]);

    // Compute metrics
    const now = new Date();
    let publishedCount = 0;
    let draftCount = 0;
    let scheduledCount = 0;
    let completedCount = 0;
    let totalAttemptsCount = 0;
    let pendingEvaluationsCount = 0;
    let totalScoreSum = 0;
    let evaluatedCount = 0;

    allExamsForMetrics.forEach((e: any) => {
      if (e.status === 'PUBLISHED') publishedCount++;
      if (e.status === 'DRAFT') draftCount++;
      if (e.startAt && new Date(e.startAt) > now) scheduledCount++;
      if (e.endAt && new Date(e.endAt) < now) completedCount++;

      if (e.attempts) {
        totalAttemptsCount += e.attempts.length;
        e.attempts.forEach((a: any) => {
          if (a.status === 'SUBMITTED') pendingEvaluationsCount++;
          if (a.status === 'EVALUATED' && typeof a.score === 'number') {
            totalScoreSum += a.score;
            evaluatedCount++;
          }
        });
      }
    });

    const avgScore = evaluatedCount > 0 ? Math.round(totalScoreSum / evaluatedCount) : 0;

    // Student counts per scope
    const mappedExams = await Promise.all(
      exams.map(async (exam: any) => {
        let totalStudents = 0;
        if (exam.batchId) {
          totalStudents = await this.prisma.enrolment.count({
            where: { batchId: exam.batchId, instituteId, status: 'ACTIVE' },
          });
        } else {
          totalStudents = await this.prisma.enrolment.count({
            where: { courseId: exam.courseId, instituteId, status: 'ACTIVE' },
          });
        }

        const attempts = exam.attempts || [];
        const evaluated = attempts.filter((a: any) => a.status === 'EVALUATED').length;
        const pendingEval = attempts.filter((a: any) => a.status === 'SUBMITTED').length;

        return {
          id: exam.id,
          title: exam.title,
          instructions: exam.instructions,
          type: exam.type,
          courseId: exam.courseId,
          courseTitle: exam.course?.title || 'Unknown Course',
          batchId: exam.batchId,
          batchName: exam.batch?.name || 'All Batches',
          batchCode: exam.batch?.code || null,
          durationMin: exam.durationMin,
          totalMarks: exam.totalMarks,
          passMarks: exam.passMarks,
          status: exam.status,
          startAt: exam.startAt ? new Date(exam.startAt).toISOString() : null,
          endAt: exam.endAt ? new Date(exam.endAt).toISOString() : null,
          totalQuestions: exam.questions?.length || 0,
          totalStudents,
          attemptCount: attempts.length,
          evaluatedCount: evaluated,
          pendingEvaluationCount: pendingEval,
          createdAt: exam.createdAt.toISOString(),
          updatedAt: exam.updatedAt.toISOString(),
        };
      })
    );

    return {
      success: true,
      data: mappedExams,
      metrics: {
        total: allExamsForMetrics.length,
        published: publishedCount,
        draft: draftCount,
        scheduled: scheduledCount,
        completed: completedCount,
        totalAttempts: totalAttemptsCount,
        pendingEvaluations: pendingEvaluationsCount,
        avgScore,
      },
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async getTeacherExamDetail(user: any, examId: string) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        course: { select: { id: true, title: true } },
        batch: { select: { id: true, name: true, code: true } },
        questions: {
          include: {
            options: {
              select: { id: true, label: true, isCorrect: true },
            },
          },
          orderBy: { position: 'asc' },
        },
        attempts: {
          select: { id: true, status: true, score: true, startedAt: true, submittedAt: true },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Examination not found');
    }

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, exam.courseId, exam.batchId);

    let totalStudents = 0;
    if (exam.batchId) {
      totalStudents = await this.prisma.enrolment.count({
        where: { batchId: exam.batchId, instituteId, status: 'ACTIVE' },
      });
    } else {
      totalStudents = await this.prisma.enrolment.count({
        where: { courseId: exam.courseId, instituteId, status: 'ACTIVE' },
      });
    }

    const attempts = exam.attempts || [];
    const submittedCount = attempts.filter((a: any) => a.status === 'SUBMITTED' || a.status === 'EVALUATED').length;
    const evaluatedCount = attempts.filter((a: any) => a.status === 'EVALUATED').length;
    const pendingEvalCount = attempts.filter((a: any) => a.status === 'SUBMITTED').length;

    return {
      success: true,
      data: {
        id: exam.id,
        title: exam.title,
        instructions: exam.instructions,
        type: exam.type,
        courseId: exam.courseId,
        courseTitle: exam.course?.title,
        batchId: exam.batchId,
        batchName: exam.batch?.name || 'All Batches',
        durationMin: exam.durationMin,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        status: exam.status,
        startAt: exam.startAt ? new Date(exam.startAt).toISOString() : null,
        endAt: exam.endAt ? new Date(exam.endAt).toISOString() : null,
        totalQuestions: exam.questions.length,
        totalStudents,
        attemptCount: attempts.length,
        submittedCount,
        evaluatedCount,
        pendingEvaluationCount: pendingEvalCount,
        questions: exam.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          type: q.type,
          marks: q.marks,
          position: q.position,
          options: q.options || [],
        })),
        createdAt: exam.createdAt.toISOString(),
        updatedAt: exam.updatedAt.toISOString(),
      },
    };
  }

  async createTeacherExam(user: any, payload: any) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    if (!payload.title || !payload.title.trim()) {
      throw new BadRequestException('Examination title is required');
    }
    if (!payload.courseId) {
      throw new BadRequestException('Course is required');
    }
    const durationMin = Number(payload.durationMin || 30);
    if (isNaN(durationMin) || durationMin <= 0) {
      throw new BadRequestException('Duration must be a positive integer in minutes');
    }
    const totalMarks = Number(payload.totalMarks || 100);
    if (isNaN(totalMarks) || totalMarks <= 0) {
      throw new BadRequestException('Total marks must be greater than zero');
    }
    const passMarks = Number(payload.passMarks || Math.round(totalMarks * 0.4));
    if (isNaN(passMarks) || passMarks < 0 || passMarks > totalMarks) {
      throw new BadRequestException('Passing marks cannot exceed total marks');
    }

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, payload.courseId, payload.batchId);

    let startAt: Date | null = null;
    let endAt: Date | null = null;
    if (payload.startAt) {
      startAt = new Date(payload.startAt);
      if (isNaN(startAt.getTime())) throw new BadRequestException('Invalid start time format');
    }
    if (payload.endAt) {
      endAt = new Date(payload.endAt);
      if (isNaN(endAt.getTime())) throw new BadRequestException('Invalid end time format');
    }
    if (startAt && endAt && startAt >= endAt) {
      throw new BadRequestException('Start time must be strictly before end time');
    }

    const created = await this.prisma.exam.create({
      data: {
        instituteId,
        courseId: payload.courseId,
        batchId: payload.batchId || null,
        title: payload.title.trim(),
        instructions: payload.instructions?.trim() || null,
        type: payload.type === 'EXAM' ? 'EXAM' : 'QUIZ',
        durationMin,
        totalMarks,
        passMarks,
        status: payload.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        startAt,
        endAt,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'EXAM_CREATED',
        entityType: 'Exam',
        entityId: created.id,
        metadata: {
          title: created.title,
          courseId: created.courseId,
          batchId: created.batchId,
          totalMarks: created.totalMarks,
          status: created.status,
        },
      },
    });

    return {
      success: true,
      message: 'Examination created successfully',
      data: created,
    };
  }

  async updateTeacherExam(user: any, examId: string, payload: any) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const existing = await this.prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });
    if (!existing) {
      throw new NotFoundException('Examination not found');
    }

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, existing.courseId, existing.batchId);

    const updateData: any = {};
    if (payload.title !== undefined) {
      if (!payload.title.trim()) throw new BadRequestException('Title cannot be empty');
      updateData.title = payload.title.trim();
    }
    if (payload.instructions !== undefined) {
      updateData.instructions = payload.instructions?.trim() || null;
    }
    if (payload.durationMin !== undefined) {
      const dur = Number(payload.durationMin);
      if (isNaN(dur) || dur <= 0) throw new BadRequestException('Duration must be positive');
      updateData.durationMin = dur;
    }
    if (payload.totalMarks !== undefined) {
      const tm = Number(payload.totalMarks);
      if (isNaN(tm) || tm <= 0) throw new BadRequestException('Total marks must be greater than zero');
      updateData.totalMarks = tm;
    }
    if (payload.passMarks !== undefined) {
      const pm = Number(payload.passMarks);
      const effectiveTotal = updateData.totalMarks || existing.totalMarks;
      if (isNaN(pm) || pm < 0 || pm > effectiveTotal) {
        throw new BadRequestException('Passing marks cannot exceed total marks');
      }
      updateData.passMarks = pm;
    }
    if (payload.batchId !== undefined) {
      if (payload.batchId) {
        await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, existing.courseId, payload.batchId);
      }
      updateData.batchId = payload.batchId || null;
    }
    if (payload.startAt !== undefined) {
      updateData.startAt = payload.startAt ? new Date(payload.startAt) : null;
    }
    if (payload.endAt !== undefined) {
      updateData.endAt = payload.endAt ? new Date(payload.endAt) : null;
    }
    if (payload.status !== undefined) {
      updateData.status = payload.status;
    }

    const updated = await this.prisma.exam.update({
      where: { id: examId },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'EXAM_UPDATED',
        entityType: 'Exam',
        entityId: examId,
        metadata: {
          updatedFields: Object.keys(updateData),
        },
      },
    });

    return {
      success: true,
      message: 'Examination updated successfully',
      data: updated,
    };
  }

  async publishTeacherExam(user: any, examId: string) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: { questions: true },
    });
    if (!exam) {
      throw new NotFoundException('Examination not found');
    }

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, exam.courseId, exam.batchId);

    if (exam.questions.length === 0) {
      throw new BadRequestException('Cannot publish examination without any questions. Add questions before publishing.');
    }

    const updated = await this.prisma.exam.update({
      where: { id: examId },
      data: { status: 'PUBLISHED' },
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'EXAM_PUBLISHED',
        entityType: 'Exam',
        entityId: examId,
        metadata: {
          title: updated.title,
          totalQuestions: exam.questions.length,
          totalMarks: updated.totalMarks,
        },
      },
    });

    if (this.notificationsService) {
      await this.notificationsService.safeEmit(() =>
        this.notificationsService!.emitExamPublished(instituteId, {
          examId: updated.id,
          title: updated.title,
          courseId: updated.courseId,
          batchId: updated.batchId || undefined,
          durationMin: updated.durationMin || undefined,
        }),
      );
    }

    return {
      success: true,
      message: 'Examination published successfully',
      data: updated,
    };
  }

  async addTeacherExamQuestion(user: any, examId: string, payload: any) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });
    if (!exam) throw new NotFoundException('Examination not found');

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, exam.courseId, exam.batchId);

    if (!payload.prompt || !payload.prompt.trim()) {
      throw new BadRequestException('Question prompt is required');
    }
    const marks = Number(payload.marks || 5);
    if (isNaN(marks) || marks <= 0) {
      throw new BadRequestException('Question marks must be a positive integer');
    }

    const maxPos = await this.prisma.question.findFirst({
      where: { examId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (maxPos?.position ?? -1) + 1;

    const validTypes = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SHORT', 'DESCRIPTIVE'];
    const qType = validTypes.includes(payload.type) ? payload.type : 'MCQ_SINGLE';

    const question = await this.prisma.question.create({
      data: {
        instituteId,
        examId,
        prompt: payload.prompt.trim(),
        marks,
        position,
        type: qType,
      },
    });

    // Create options if provided (MCQ or TRUE_FALSE)
    if (Array.isArray(payload.options) && payload.options.length > 0) {
      await Promise.all(
        payload.options.map((opt: any) =>
          this.prisma.questionOption.create({
            data: {
              questionId: question.id,
              label: String(opt.label || '').trim(),
              isCorrect: Boolean(opt.isCorrect),
            },
          })
        )
      );
    }

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'EXAM_QUESTION_CREATED',
        entityType: 'Question',
        entityId: question.id,
        metadata: { examId, prompt: question.prompt, marks: question.marks },
      },
    });

    const fullQuestion = await this.prisma.question.findUnique({
      where: { id: question.id },
      include: { options: true },
    });

    return {
      success: true,
      message: 'Question added successfully',
      data: fullQuestion,
    };
  }

  async updateTeacherExamQuestion(user: any, examId: string, questionId: string, payload: any) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });
    if (!exam) throw new NotFoundException('Examination not found');

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, exam.courseId, exam.batchId);

    const question = await this.prisma.question.findFirst({
      where: { id: questionId, examId },
    });
    if (!question) throw new NotFoundException('Question not found in this examination');

    const updateData: any = {};
    if (payload.prompt !== undefined) {
      if (!payload.prompt.trim()) throw new BadRequestException('Prompt cannot be empty');
      updateData.prompt = payload.prompt.trim();
    }
    if (payload.marks !== undefined) {
      const m = Number(payload.marks);
      if (isNaN(m) || m <= 0) throw new BadRequestException('Marks must be greater than zero');
      updateData.marks = m;
    }
    if (payload.type !== undefined) {
      updateData.type = payload.type;
    }
    if (payload.position !== undefined) {
      updateData.position = Number(payload.position);
    }

    await this.prisma.question.update({
      where: { id: questionId },
      data: updateData,
    });

    // Update options if provided
    if (Array.isArray(payload.options)) {
      await this.prisma.questionOption.deleteMany({ where: { questionId } });
      await Promise.all(
        payload.options.map((opt: any) =>
          this.prisma.questionOption.create({
            data: {
              questionId,
              label: String(opt.label || '').trim(),
              isCorrect: Boolean(opt.isCorrect),
            },
          })
        )
      );
    }

    const updated = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    return {
      success: true,
      message: 'Question updated successfully',
      data: updated,
    };
  }

  async deleteTeacherExamQuestion(user: any, examId: string, questionId: string) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });
    if (!exam) throw new NotFoundException('Examination not found');

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, exam.courseId, exam.batchId);

    const question = await this.prisma.question.findFirst({
      where: { id: questionId, examId },
    });
    if (!question) throw new NotFoundException('Question not found');

    await this.prisma.questionOption.deleteMany({ where: { questionId } });
    await this.prisma.attemptAnswer.deleteMany({ where: { questionId } });
    await this.prisma.question.delete({ where: { id: questionId } });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'EXAM_QUESTION_DELETED',
        entityType: 'Question',
        entityId: questionId,
        metadata: { examId },
      },
    });

    return {
      success: true,
      message: 'Question deleted successfully',
    };
  }

  async getTeacherExamResults(user: any, examId: string, options: any = {}) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, instituteId },
      include: {
        course: { select: { id: true, title: true } },
        batch: { select: { id: true, name: true } },
      },
    });
    if (!exam) throw new NotFoundException('Examination not found');

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, exam.courseId, exam.batchId);

    // Fetch all active enrolled students
    const enrolmentWhere: any = {
      instituteId,
      status: 'ACTIVE',
      ...(exam.batchId ? { batchId: exam.batchId } : { courseId: exam.courseId }),
    };

    const enrolments = await this.prisma.enrolment.findMany({
      where: enrolmentWhere,
      include: {
        studentProfile: {
          include: {
            membership: {
              include: {
                user: { select: { id: true, fullName: true, email: true, avatarUrl: true, phoneE164: true } },
              },
            },
          },
        },
        batch: { select: { id: true, name: true, code: true } },
      },
    });

    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId, instituteId },
      orderBy: { startedAt: 'desc' },
    });

    const attemptsByStudent = new Map<string, any>();
    attempts.forEach((att) => {
      if (!attemptsByStudent.has(att.studentProfileId)) {
        attemptsByStudent.set(att.studentProfileId, att);
      }
    });

    let results = enrolments.map((enr) => {
      const sp = enr.studentProfile;
      const u = sp.membership?.user;
      const att = attemptsByStudent.get(sp.id);

      const isAttempted = Boolean(att);
      const score = att?.score !== null && att?.score !== undefined ? att.score : null;
      const percentage = score !== null ? Math.round((score / exam.totalMarks) * 100) : null;
      const passed = score !== null ? score >= exam.passMarks : null;

      let evaluationStatus: 'NOT_ATTEMPTED' | 'IN_PROGRESS' | 'PENDING_EVALUATION' | 'EVALUATED' = 'NOT_ATTEMPTED';
      if (!isAttempted) evaluationStatus = 'NOT_ATTEMPTED';
      else if (att.status === 'IN_PROGRESS') evaluationStatus = 'IN_PROGRESS';
      else if (att.status === 'SUBMITTED') evaluationStatus = 'PENDING_EVALUATION';
      else if (att.status === 'EVALUATED') evaluationStatus = 'EVALUATED';

      return {
        studentProfileId: sp.id,
        admissionNo: sp.admissionNo || 'N/A',
        studentName: u?.fullName || 'Enrolled Student',
        email: u?.email,
        phone: u?.phoneE164,
        avatarUrl: u?.avatarUrl,
        batchName: enr.batch?.name || exam.batch?.name || 'All Batches',
        attemptId: att?.id || null,
        attemptStatus: att?.status || 'NOT_ATTEMPTED',
        evaluationStatus,
        startedAt: att?.startedAt ? att.startedAt.toISOString() : null,
        submittedAt: att?.submittedAt ? att.submittedAt.toISOString() : null,
        score,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        percentage,
        passed,
        feedback: att?.feedback || null,
      };
    });

    // Filters
    if (options.status && options.status !== 'ALL') {
      results = results.filter((r) => r.evaluationStatus === options.status || r.attemptStatus === options.status);
    }
    if (options.search && options.search.trim()) {
      const qLower = options.search.trim().toLowerCase();
      results = results.filter(
        (r) =>
          r.studentName.toLowerCase().includes(qLower) ||
          r.admissionNo.toLowerCase().includes(qLower) ||
          (r.email && r.email.toLowerCase().includes(qLower))
      );
    }

    const totalStudents = enrolments.length;
    const attemptedCount = results.filter((r) => r.attemptId !== null).length;
    const evaluatedCount = results.filter((r) => r.evaluationStatus === 'EVALUATED').length;
    const pendingEvaluationCount = results.filter((r) => r.evaluationStatus === 'PENDING_EVALUATION').length;
    const passedCount = results.filter((r) => r.passed === true).length;

    return {
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          courseId: exam.courseId,
          courseTitle: exam.course?.title,
          batchId: exam.batchId,
          batchName: exam.batch?.name || 'All Batches',
          totalMarks: exam.totalMarks,
          passMarks: exam.passMarks,
          durationMin: exam.durationMin,
        },
        summary: {
          totalStudents,
          attemptedCount,
          evaluatedCount,
          pendingEvaluationCount,
          passedCount,
          passRate: attemptedCount > 0 ? Math.round((passedCount / attemptedCount) * 100) : 0,
        },
        results,
      },
    };
  }

  async getTeacherExamAttempt(user: any, examId: string, attemptId: string) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });
    if (!exam) throw new NotFoundException('Examination not found');

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, exam.courseId, exam.batchId);

    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, examId, instituteId },
      include: {
        studentProfile: {
          include: {
            membership: {
              include: {
                user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
              },
            },
          },
        },
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException('Attempt not found for this examination');

    return {
      success: true,
      data: {
        id: attempt.id,
        examId: attempt.examId,
        studentName: attempt.studentProfile?.membership?.user?.fullName,
        admissionNo: attempt.studentProfile?.admissionNo,
        email: attempt.studentProfile?.membership?.user?.email,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() || null,
        status: attempt.status,
        score: attempt.score,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        feedback: attempt.feedback,
        answers: attempt.answers.map((ans) => ({
          questionId: ans.questionId,
          prompt: ans.question.prompt,
          type: ans.question.type,
          maxMarks: ans.question.marks,
          chosenText: ans.chosenText,
          scoreAwarded: ans.score,
          feedback: ans.feedback,
          options: ans.question.options.map((o) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.isCorrect,
          })),
        })),
      },
    };
  }

  async evaluateTeacherExamAttempt(user: any, examId: string, attemptId: string, payload: any) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, instituteId },
    });
    if (!exam) throw new NotFoundException('Examination not found');

    await this.verifyTeacherCourseOrBatchAccess(teacherProfileId, instituteId, exam.courseId, exam.batchId);

    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, examId, instituteId },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const totalScore = Number(payload.score);
    if (isNaN(totalScore) || totalScore < 0 || totalScore > exam.totalMarks) {
      throw new BadRequestException(`Awarded score must be between 0 and maximum exam marks (${exam.totalMarks})`);
    }

    // Save individual question scores if provided
    if (Array.isArray(payload.answers)) {
      for (const ans of payload.answers) {
        if (ans.questionId && ans.score !== undefined) {
          await this.prisma.attemptAnswer.updateMany({
            where: { attemptId, questionId: ans.questionId },
            data: {
              score: Math.round(Number(ans.score)),
              feedback: ans.feedback?.trim() || null,
            },
          });
        }
      }
    }

    const updated = await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        score: Math.round(totalScore),
        status: 'EVALUATED',
        feedback: payload.feedback?.trim() || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'EXAM_ATTEMPT_EVALUATED',
        entityType: 'ExamAttempt',
        entityId: attemptId,
        metadata: {
          examId,
          studentProfileId: attempt.studentProfileId,
          previousScore: attempt.score,
          awardedScore: updated.score,
          totalMarks: exam.totalMarks,
          feedback: updated.feedback,
        },
      },
    });

    if (this.notificationsService) {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { id: attempt.studentProfileId },
        select: { membership: { select: { userId: true } } },
      });
      const studentUserId = studentProfile?.membership?.userId;
      if (studentUserId) {
        await this.notificationsService.safeEmit(() =>
          this.notificationsService!.emitExamEvaluated(instituteId, {
            examId: exam.id,
            examTitle: exam.title,
            studentUserId,
            score: updated.score ?? 0,
            totalMarks: exam.totalMarks,
            feedback: updated.feedback || undefined,
          }),
        );
      }
    }

    return {
      success: true,
      message: 'Examination attempt evaluated successfully',
      data: updated,
    };
  }

  // ==========================================
  // PHASE 7: LIVE CLASSES & TIMETABLE METHODS
  // ==========================================

  async getTeacherLiveClasses(
    user: any,
    options: {
      courseId?: string;
      batchId?: string;
      status?: string;
      date?: string;
      search?: string;
      page?: number | string;
      limit?: number | string;
    } = {}
  ) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    // 1. Fetch teacher assigned batches and courses
    const assignedBatchTeachers = await this.prisma.batchTeacher.findMany({
      where: { teacherProfileId, instituteId },
      include: {
        batch: {
          include: {
            course: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { batch: { name: 'asc' } },
    });

    const assignedBatchIds = assignedBatchTeachers.map((bt) => bt.batchId);
    const assignedCourseIds = Array.from(new Set(assignedBatchTeachers.map((bt) => bt.batch.courseId)));

    if (assignedBatchIds.length === 0) {
      return {
        success: true,
        data: [],
        metrics: {
          totalScheduled: 0,
          classesToday: 0,
          upcomingClasses: 0,
          ongoingClasses: 0,
          completedClasses: 0,
          cancelledClasses: 0,
          totalAssignedBatches: 0,
        },
        meta: {
          total: 0,
          page: Number(options.page) || 1,
          limit: Number(options.limit) || 10,
          totalPages: 0,
        },
      };
    }

    if (options.batchId && options.batchId !== 'ALL' && !assignedBatchIds.includes(options.batchId)) {
      throw new ForbiddenException('You are not authorized to view live classes for this batch.');
    }

    if (options.courseId && options.courseId !== 'ALL' && !assignedCourseIds.includes(options.courseId)) {
      throw new ForbiddenException('You are not authorized to view live classes for this course.');
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Filter building
    const where: any = {
      instituteId,
      batchId: { in: assignedBatchIds },
    };

    if (options.batchId && options.batchId !== 'ALL') {
      where.batchId = options.batchId;
    }

    if (options.courseId && options.courseId !== 'ALL') {
      where.batch = { courseId: options.courseId };
    }

    if (options.status && options.status !== 'ALL') {
      if (options.status === 'LIVE' || options.status === 'ONGOING') {
        where.OR = [
          { status: LiveSessionStatus.LIVE },
          { startsAt: { lte: now }, endsAt: { gte: now }, status: { not: LiveSessionStatus.CANCELLED } },
        ];
      } else {
        where.status = options.status;
      }
    }

    if (options.date) {
      const d = new Date(options.date);
      if (!isNaN(d.getTime())) {
        const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        where.startsAt = { gte: dStart, lt: dEnd };
      }
    }

    if (options.search?.trim()) {
      const s = options.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { room: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, sessions] = await Promise.all([
      this.prisma.liveSession.count({ where }),
      this.prisma.liveSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startsAt: 'desc' },
        include: {
          batch: {
            include: {
              course: { select: { id: true, title: true } },
              _count: { select: { enrolments: { where: { status: 'ACTIVE' } } } },
            },
          },
          teacherProfile: {
            include: {
              membership: {
                include: {
                  user: { select: { id: true, fullName: true, avatarUrl: true } },
                },
              },
            },
          },
          _count: {
            select: { attendances: true },
          },
        },
      }),
    ]);

    // Aggregate metrics across all assigned sessions for teacher
    const allTeacherSessions = await this.prisma.liveSession.findMany({
      where: {
        instituteId,
        batchId: { in: assignedBatchIds },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
      },
    });

    let totalScheduled = 0;
    let classesToday = 0;
    let upcomingClasses = 0;
    let ongoingClasses = 0;
    let completedClasses = 0;
    let cancelledClasses = 0;

    allTeacherSessions.forEach((s) => {
      if (s.status === LiveSessionStatus.CANCELLED) {
        cancelledClasses++;
      } else if (s.status === LiveSessionStatus.COMPLETED) {
        completedClasses++;
      } else {
        totalScheduled++;
        if (s.startsAt >= todayStart && s.startsAt < todayEnd) {
          classesToday++;
        }
        if (s.status === LiveSessionStatus.LIVE || (s.startsAt <= now && s.endsAt >= now)) {
          ongoingClasses++;
        } else if (s.startsAt > now) {
          upcomingClasses++;
        } else if (s.endsAt < now) {
          completedClasses++;
        }
      }
    });

    const data = sessions.map((s) => {
      const isOngoing =
        (s.startsAt <= now && s.endsAt >= now && s.status !== LiveSessionStatus.CANCELLED) ||
        s.status === LiveSessionStatus.LIVE;
      let displayStatus = s.status as string;
      if (isOngoing && s.status !== LiveSessionStatus.CANCELLED) {
        displayStatus = 'LIVE';
      }

      let meetingProvider = 'GOOGLE_MEET';
      if (s.joinUrl?.includes('zoom.us')) meetingProvider = 'ZOOM';
      else if (s.joinUrl?.includes('teams.microsoft.com')) meetingProvider = 'MICROSOFT_TEAMS';

      const durationMin = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / (1000 * 60));

      return {
        id: s.id,
        title: s.title,
        description: s.description,
        room: s.room,
        courseId: s.batch.courseId,
        courseTitle: s.batch.course.title,
        batchId: s.batchId,
        batchName: s.batch.name,
        teacherProfileId: s.teacherProfileId,
        teacherName: s.teacherProfile?.membership?.user?.fullName || 'Faculty Instructor',
        teacherAvatarUrl: s.teacherProfile?.membership?.user?.avatarUrl || null,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        durationMin,
        meetingProvider,
        joinUrl: s.joinUrl,
        recordingUrl: s.recordingUrl,
        status: displayStatus,
        rawStatus: s.status,
        enrolledStudentsCount: s.batch._count.enrolments,
        markedAttendanceCount: s._count.attendances,
        canJoin: !!s.joinUrl && s.status !== LiveSessionStatus.CANCELLED,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    });

    return {
      success: true,
      data,
      metrics: {
        totalScheduled,
        classesToday,
        upcomingClasses,
        ongoingClasses,
        completedClasses,
        cancelledClasses,
        totalAssignedBatches: assignedBatchIds.length,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getTeacherLiveClassDetail(user: any, sessionId: string) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, instituteId },
      include: {
        batch: {
          include: {
            course: { select: { id: true, title: true, slug: true } },
            enrolments: {
              where: { status: 'ACTIVE' },
              include: {
                studentProfile: {
                  include: {
                    membership: {
                      include: {
                        user: { select: { id: true, fullName: true, email: true, avatarUrl: true, phoneE164: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        teacherProfile: {
          include: {
            membership: {
              include: {
                user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
              },
            },
          },
        },
        attendances: {
          include: {
            studentProfile: {
              include: {
                membership: {
                  include: {
                    user: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Live session not found in this institute');
    }

    const isTeacher = session.teacherProfileId === teacherProfileId;
    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: { batchId: session.batchId, teacherProfileId, instituteId },
    });

    if (!isTeacher && !isBatchTeacher) {
      throw new ForbiddenException('You are not authorized to view details for this live class');
    }

    const now = new Date();
    const isOngoing =
      (session.startsAt <= now && session.endsAt >= now && session.status !== LiveSessionStatus.CANCELLED) ||
      session.status === LiveSessionStatus.LIVE;
    let displayStatus = session.status as string;
    if (isOngoing && session.status !== LiveSessionStatus.CANCELLED) {
      displayStatus = 'LIVE';
    }

    const attendanceMap = new Map<string, any>();
    session.attendances.forEach((att) => {
      attendanceMap.set(att.studentProfileId, att);
    });

    const roster = session.batch.enrolments.map((enr) => {
      const sp = enr.studentProfile;
      const u = sp.membership?.user;
      const att = attendanceMap.get(sp.id);

      return {
        studentProfileId: sp.id,
        admissionNo: sp.admissionNo || 'N/A',
        studentName: u?.fullName || 'Enrolled Student',
        email: u?.email || '',
        phone: u?.phoneE164 || '',
        avatarUrl: u?.avatarUrl || null,
        attendanceStatus: att?.status || null,
        remarks: att?.remarks || null,
        markedAt: att?.markedAt ? att.markedAt.toISOString() : null,
      };
    });

    const presentCount = roster.filter((r) => r.attendanceStatus === 'PRESENT').length;
    const lateCount = roster.filter((r) => r.attendanceStatus === 'LATE').length;
    const absentCount = roster.filter((r) => r.attendanceStatus === 'ABSENT').length;
    const excusedCount = roster.filter((r) => r.attendanceStatus === 'EXCUSED').length;

    return {
      success: true,
      data: {
        id: session.id,
        title: session.title,
        description: session.description,
        room: session.room,
        courseId: session.batch.courseId,
        courseTitle: session.batch.course.title,
        batchId: session.batchId,
        batchName: session.batch.name,
        teacherProfileId: session.teacherProfileId,
        teacherName: session.teacherProfile?.membership?.user?.fullName || 'Faculty Instructor',
        teacherAvatarUrl: session.teacherProfile?.membership?.user?.avatarUrl || null,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        durationMin: Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / (1000 * 60)),
        status: displayStatus,
        rawStatus: session.status,
        joinUrl: session.joinUrl,
        recordingUrl: session.recordingUrl,
        enrolledCount: roster.length,
        attendanceSummary: {
          totalEnrolled: roster.length,
          totalMarked: session.attendances.length,
          presentCount,
          lateCount,
          absentCount,
          excusedCount,
          attendanceRatePct: roster.length > 0 ? Math.round(((presentCount + lateCount) / roster.length) * 100) : 0,
        },
        roster,
      },
    };
  }

  async createTeacherLiveClass(user: any, payload: any) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    if (!payload.title || !payload.title.trim()) {
      throw new BadRequestException('Live class title is mandatory');
    }
    if (!payload.batchId) {
      throw new BadRequestException('Batch selection is mandatory');
    }

    // Verify teacher assignment to batch
    const assignment = await this.prisma.batchTeacher.findFirst({
      where: {
        batchId: payload.batchId,
        teacherProfileId,
        instituteId,
      },
      include: {
        batch: {
          include: { course: true },
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException('You are not assigned to instruct this batch');
    }

    const startsAt = new Date(payload.startsAt);
    const endsAt = new Date(payload.endsAt);

    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      throw new BadRequestException('Valid start and end date/time are required');
    }
    if (startsAt >= endsAt) {
      throw new BadRequestException('Session start time must be before end time');
    }

    // Check schedule conflict
    const conflict = await this.checkScheduleConflict(instituteId, {
      teacherProfileId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    if (conflict.hasConflict) {
      throw new BadRequestException(
        conflict.message || `Teacher has an overlapping live session scheduled (${conflict.conflictingSession?.title})`
      );
    }

    // Validate meeting URL if provided
    let joinUrl = payload.joinUrl ? String(payload.joinUrl).trim() : null;
    if (joinUrl) {
      if (!joinUrl.startsWith('http://') && !joinUrl.startsWith('https://')) {
        throw new BadRequestException('Meeting URL must start with http:// or https://');
      }
    }

    const session = await this.prisma.liveSession.create({
      data: {
        instituteId,
        batchId: payload.batchId,
        teacherProfileId,
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        room: payload.room?.trim() || null,
        startsAt,
        endsAt,
        joinUrl,
        recordingUrl: payload.recordingUrl?.trim() || null,
        status: LiveSessionStatus.SCHEDULED,
      },
      include: {
        batch: {
          include: { course: { select: { id: true, title: true } } },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'LIVE_CLASS_SCHEDULED',
        entityType: 'LiveSession',
        entityId: session.id,
        metadata: {
          title: session.title,
          batchId: session.batchId,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          joinUrl: session.joinUrl,
        },
      },
    });

    if (this.notificationsService) {
      await this.notificationsService.safeEmit(() =>
        this.notificationsService!.emitLiveClassScheduled(instituteId, {
          sessionId: session.id,
          title: session.title,
          batchId: session.batchId,
          batchName: session.batch?.name || 'Class Batch',
          startsAt: session.startsAt,
          joinUrl: session.joinUrl || undefined,
        }),
      );
    }

    return {
      success: true,
      message: 'Live class scheduled successfully',
      data: session,
    };
  }

  async updateTeacherLiveClass(user: any, sessionId: string, payload: any) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, instituteId },
      include: { batch: true },
    });

    if (!session) {
      throw new NotFoundException('Live session not found in your institute');
    }

    // Verify teacher authorization
    const isTeacher = session.teacherProfileId === teacherProfileId;
    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: { batchId: session.batchId, teacherProfileId, instituteId },
    });

    if (!isTeacher && !isBatchTeacher) {
      throw new ForbiddenException('You are not authorized to update this live class');
    }

    if (session.status === LiveSessionStatus.COMPLETED) {
      throw new BadRequestException('Completed sessions cannot be rescheduled or modified');
    }

    const updateData: any = {};
    if (payload.title !== undefined) {
      if (!payload.title.trim()) throw new BadRequestException('Title cannot be empty');
      updateData.title = payload.title.trim();
    }
    if (payload.description !== undefined) {
      updateData.description = payload.description?.trim() || null;
    }
    if (payload.room !== undefined) {
      updateData.room = payload.room?.trim() || null;
    }
    if (payload.joinUrl !== undefined) {
      const jUrl = payload.joinUrl ? String(payload.joinUrl).trim() : null;
      if (jUrl && !jUrl.startsWith('http://') && !jUrl.startsWith('https://')) {
        throw new BadRequestException('Meeting URL must start with http:// or https://');
      }
      updateData.joinUrl = jUrl;
    }
    if (payload.recordingUrl !== undefined) {
      updateData.recordingUrl = payload.recordingUrl?.trim() || null;
    }

    let newStartsAt = session.startsAt;
    let newEndsAt = session.endsAt;
    let timesChanged = false;

    if (payload.startsAt) {
      newStartsAt = new Date(payload.startsAt);
      timesChanged = true;
    }
    if (payload.endsAt) {
      newEndsAt = new Date(payload.endsAt);
      timesChanged = true;
    }

    if (timesChanged) {
      if (isNaN(newStartsAt.getTime()) || isNaN(newEndsAt.getTime())) {
        throw new BadRequestException('Valid start and end date/time are required');
      }
      if (newStartsAt >= newEndsAt) {
        throw new BadRequestException('Session start time must be before end time');
      }

      const conflict = await this.checkScheduleConflict(instituteId, {
        teacherProfileId,
        startsAt: newStartsAt.toISOString(),
        endsAt: newEndsAt.toISOString(),
        excludeSessionId: sessionId,
      });

      if (conflict.hasConflict) {
        throw new BadRequestException(
          conflict.message || `Schedule conflict with session: ${conflict.conflictingSession?.title}`
        );
      }

      updateData.startsAt = newStartsAt;
      updateData.endsAt = newEndsAt;
    }

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        batch: {
          include: { course: { select: { id: true, title: true } } },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'LIVE_CLASS_UPDATED',
        entityType: 'LiveSession',
        entityId: sessionId,
        metadata: {
          sessionId,
          updatedFields: Object.keys(updateData),
        },
      },
    });

    if (this.notificationsService && timesChanged) {
      await this.notificationsService.safeEmit(() =>
        this.notificationsService!.emitLiveClassRescheduled(instituteId, {
          sessionId: updated.id,
          title: updated.title,
          batchId: updated.batchId,
          batchName: updated.batch?.name || 'Class Batch',
          startsAt: updated.startsAt,
        }),
      );
    }

    return {
      success: true,
      message: 'Live class updated successfully',
      data: updated,
    };
  }

  async cancelTeacherLiveClass(user: any, sessionId: string, payload: any = {}) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, instituteId },
    });

    if (!session) {
      throw new NotFoundException('Live session not found in your institute');
    }

    const isTeacher = session.teacherProfileId === teacherProfileId;
    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: { batchId: session.batchId, teacherProfileId, instituteId },
    });

    if (!isTeacher && !isBatchTeacher) {
      throw new ForbiddenException('You are not authorized to cancel this live class');
    }

    if (session.status === LiveSessionStatus.CANCELLED) {
      return { success: true, message: 'Class is already cancelled', data: session };
    }

    const updated = await this.prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        status: LiveSessionStatus.CANCELLED,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'LIVE_CLASS_CANCELLED',
        entityType: 'LiveSession',
        entityId: sessionId,
        metadata: {
          sessionId,
          reason: payload.reason?.trim() || null,
        },
      },
    });

    if (this.notificationsService) {
      await this.notificationsService.safeEmit(() =>
        this.notificationsService!.emitLiveClassCancelled(instituteId, {
          sessionId: updated.id,
          title: session.title,
          batchId: session.batchId,
          batchName: 'Class Batch',
          reason: payload.reason?.trim() || undefined,
        }),
      );
    }

    return {
      success: true,
      message: 'Live class cancelled successfully',
      data: updated,
    };
  }

  async getTeacherTimetable(
    user: any,
    options: {
      startDate?: string;
      endDate?: string;
      courseId?: string;
      batchId?: string;
    } = {}
  ) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const assignedBatchTeachers = await this.prisma.batchTeacher.findMany({
      where: { teacherProfileId, instituteId },
    });
    const assignedBatchIds = assignedBatchTeachers.map((bt) => bt.batchId);

    if (assignedBatchIds.length === 0) {
      return { success: true, items: [] };
    }

    const where: any = {
      instituteId,
      batchId: { in: assignedBatchIds },
    };

    if (options.startDate && options.endDate) {
      where.startsAt = {
        gte: new Date(options.startDate),
        lte: new Date(options.endDate),
      };
    } else if (options.startDate) {
      where.startsAt = { gte: new Date(options.startDate) };
    }

    if (options.batchId && options.batchId !== 'ALL') {
      where.batchId = options.batchId;
    }
    if (options.courseId && options.courseId !== 'ALL') {
      where.batch = { courseId: options.courseId };
    }

    const sessions = await this.prisma.liveSession.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: {
        batch: {
          include: { course: { select: { id: true, title: true } } },
        },
      },
    });

    const items = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      room: s.room,
      courseId: s.batch.courseId,
      courseTitle: s.batch.course.title,
      batchId: s.batchId,
      batchName: s.batch.name,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      durationMin: Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / (1000 * 60)),
      status: s.status,
      joinUrl: s.joinUrl,
    }));

    return {
      success: true,
      items,
    };
  }

  async getTeacherLiveClassAttendance(user: any, sessionId: string) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, instituteId },
      include: {
        batch: {
          include: {
            course: { select: { id: true, title: true } },
            enrolments: {
              where: { status: 'ACTIVE' },
              include: {
                studentProfile: {
                  include: {
                    membership: {
                      include: {
                        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        attendances: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: { batchId: session.batchId, teacherProfileId, instituteId },
    });
    if (!isBatchTeacher && session.teacherProfileId !== teacherProfileId) {
      throw new ForbiddenException('You are not authorized to view attendance for this session');
    }

    const attMap = new Map<string, any>();
    session.attendances.forEach((a) => attMap.set(a.studentProfileId, a));

    const roster = session.batch.enrolments.map((enr) => {
      const sp = enr.studentProfile;
      const att = attMap.get(sp.id);
      return {
        studentProfileId: sp.id,
        admissionNo: sp.admissionNo || 'N/A',
        studentName: sp.membership?.user?.fullName || 'Student',
        email: sp.membership?.user?.email || '',
        avatarUrl: sp.membership?.user?.avatarUrl || null,
        attendanceId: att?.id || null,
        status: att?.status || 'ABSENT',
        remarks: att?.remarks || null,
        isMarked: Boolean(att),
      };
    });

    return {
      success: true,
      data: {
        sessionId: session.id,
        sessionTitle: session.title,
        batchName: session.batch.name,
        courseTitle: session.batch.course.title,
        startsAt: session.startsAt.toISOString(),
        roster,
      },
    };
  }

  async markTeacherLiveClassAttendance(user: any, sessionId: string, payload: any) {
    const { teacherProfileId, instituteId, user: authUser } = await this.resolveTeacherMembership(user);

    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, instituteId },
    });

    if (!session) {
      throw new NotFoundException('Live session not found');
    }

    const isBatchTeacher = await this.prisma.batchTeacher.findFirst({
      where: { batchId: session.batchId, teacherProfileId, instituteId },
    });
    if (!isBatchTeacher && session.teacherProfileId !== teacherProfileId) {
      throw new ForbiddenException('You are not authorized to mark attendance for this session');
    }

    if (!Array.isArray(payload.records) || payload.records.length === 0) {
      throw new BadRequestException('Attendance records array is required');
    }

    const sessionDate = new Date(
      session.startsAt.getFullYear(),
      session.startsAt.getMonth(),
      session.startsAt.getDate()
    );
    const validStatuses = Object.values(AttendanceStatus);

    let markedCount = 0;
    for (const rec of payload.records) {
      if (!rec.studentProfileId) continue;
      const status = validStatuses.includes(rec.status) ? rec.status : AttendanceStatus.PRESENT;

      // Verify student is actively enrolled in batch
      const enrolment = await this.prisma.enrolment.findFirst({
        where: {
          batchId: session.batchId,
          studentProfileId: rec.studentProfileId,
          status: 'ACTIVE',
        },
      });

      if (!enrolment) {
        continue;
      }

      const existing = await this.prisma.attendance.findFirst({
        where: {
          liveSessionId: sessionId,
          studentProfileId: rec.studentProfileId,
        },
      });

      if (existing) {
        await this.prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status,
            remarks: rec.remarks?.trim() || null,
            updatedById: authUser.id,
            markedAt: new Date(),
          },
        });
      } else {
        await this.prisma.attendance.create({
          data: {
            instituteId,
            batchId: session.batchId,
            studentProfileId: rec.studentProfileId,
            enrolmentId: enrolment.id,
            liveSessionId: sessionId,
            mode: AttendanceMode.LIVE_SESSION,
            date: sessionDate,
            status,
            remarks: rec.remarks?.trim() || null,
            markedById: authUser.id,
            markedByRole: 'TEACHER',
            markedAt: new Date(),
          },
        });
      }
      markedCount++;
    }

    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorUserId: authUser.id,
        action: 'LIVE_CLASS_ATTENDANCE_MARKED',
        entityType: 'LiveSession',
        entityId: sessionId,
        metadata: {
          sessionId,
          markedCount,
        },
      },
    });

    return {
      success: true,
      message: `Successfully recorded attendance for ${markedCount} students`,
    };
  }

  // =========================================================================
  // PHASE 8: TEACHER NOTIFICATIONS & NOTIFICATION CENTER
  // =========================================================================

  async getTeacherNotifications(user: any, query: any) {
    const { instituteId, user: authUser } = await this.resolveTeacherMembership(user);
    if (!this.notificationsService) {
      throw new BadRequestException('Notifications service unavailable');
    }
    return this.notificationsService.getNotifications(instituteId, authUser.id, query);
  }

  async getTeacherNotificationsUnreadCount(user: any) {
    const { instituteId, user: authUser } = await this.resolveTeacherMembership(user);
    if (!this.notificationsService) {
      return { unreadCount: 0, byCategory: { STUDENT: 0, TEACHER: 0, ATTENDANCE: 0, FEE: 0, ACADEMIC: 0, ADMIN: 0 } };
    }
    return this.notificationsService.getUnreadCount(instituteId, authUser.id);
  }

  async markTeacherNotificationRead(user: any, notificationId: string) {
    const { instituteId, user: authUser } = await this.resolveTeacherMembership(user);
    if (!this.notificationsService) {
      throw new BadRequestException('Notifications service unavailable');
    }
    return this.notificationsService.markAsRead(instituteId, authUser.id, notificationId);
  }

  async markAllTeacherNotificationsRead(user: any, body?: any) {
    const { instituteId, user: authUser } = await this.resolveTeacherMembership(user);
    if (!this.notificationsService) {
      throw new BadRequestException('Notifications service unavailable');
    }
    return this.notificationsService.markAllAsRead(instituteId, authUser.id, body?.category);
  }

  // =========================================================================
  // PHASE 9: TEACHER MY BATCHES & BATCH DETAILS
  // =========================================================================

  async getTeacherBatches(
    user: any,
    query: { search?: string; status?: string; courseId?: string } = {},
  ) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const where: any = {
      instituteId,
      teachers: {
        some: { teacherProfileId },
      },
    };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }
    if (query.courseId && query.courseId !== 'ALL') {
      where.courseId = query.courseId;
    }
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { code: { contains: s, mode: 'insensitive' } },
        { course: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const batches = await this.prisma.batch.findMany({
      where,
      include: {
        course: { select: { id: true, title: true, slug: true } },
        term: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        teachers: {
          where: { instituteId },
          include: {
            teacherProfile: {
              include: {
                membership: {
                  include: {
                    user: { select: { fullName: true, email: true } },
                  },
                },
              },
            },
          },
        },
        enrolments: {
          where: { status: 'ACTIVE', instituteId },
          select: { id: true, studentProfileId: true },
        },
        liveSessions: {
          where: { instituteId, startsAt: { gte: new Date() } },
          select: { id: true, title: true, startsAt: true },
          orderBy: { startsAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = batches.map((b) => {
      const myAssignment = b.teachers.find((t) => t.teacherProfileId === teacherProfileId);
      const activeStudentCount = b.enrolments.length;
      const instructors = b.teachers.map((t) => ({
        id: t.teacherProfileId,
        name: t.teacherProfile?.membership?.user?.fullName || 'Faculty Member',
        role: t.role,
        isMe: t.teacherProfileId === teacherProfileId,
      }));

      return {
        id: b.id,
        name: b.name,
        code: b.code,
        status: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
        capacity: b.capacity,
        courseId: b.courseId,
        courseTitle: b.course.title,
        courseSlug: b.course.slug,
        termName: b.term?.name || null,
        academicYearName: b.academicYear?.name || null,
        assignedRole: myAssignment?.role || 'LEAD',
        activeStudentsCount: activeStudentCount,
        nextLiveSession: b.liveSessions[0] || null,
        instructors,
      };
    });

    const totalAssignedBatches = items.length;
    const activeBatches = items.filter((b) => b.status === 'ACTIVE').length;
    const uniqueStudents = new Set(
      batches.flatMap((b) => b.enrolments.map((e) => e.studentProfileId)),
    );
    const uniqueCourses = new Set(items.map((b) => b.courseId));

    return {
      success: true,
      metrics: {
        totalAssignedBatches,
        activeBatches,
        totalStudents: uniqueStudents.size,
        associatedCoursesCount: uniqueCourses.size,
      },
      data: items,
    };
  }

  async getTeacherBatchDetail(user: any, batchId: string) {
    const { teacherProfileId, instituteId } = await this.resolveTeacherMembership(user);

    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, instituteId },
      include: {
        course: {
          include: {
            modules: {
              include: {
                chapters: {
                  include: {
                    lessons: { select: { id: true, title: true } },
                  },
                },
              },
            },
          },
        },
        term: true,
        academicYear: true,
        teachers: {
          include: {
            teacherProfile: {
              include: {
                membership: {
                  include: {
                    user: { select: { fullName: true, email: true, phoneE164: true } },
                  },
                },
              },
            },
          },
        },
        enrolments: {
          where: { status: 'ACTIVE' },
          include: {
            studentProfile: {
              include: {
                membership: {
                  include: {
                    user: { select: { fullName: true, email: true, phoneE164: true } },
                  },
                },
              },
            },
          },
        },
        liveSessions: {
          orderBy: { startsAt: 'desc' },
          take: 5,
        },
        assignments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            submissions: { select: { id: true, status: true } },
          },
        },
        exams: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            attempts: { select: { id: true, status: true } },
          },
        },
        attendances: {
          select: { id: true, status: true, date: true, studentProfileId: true },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    const isAssigned = batch.teachers.some((t) => t.teacherProfileId === teacherProfileId);
    const isCourseInstructor = await this.prisma.courseInstructor.findFirst({
      where: { courseId: batch.courseId, teacherProfileId, instituteId },
    });

    if (!isAssigned && !isCourseInstructor) {
      throw new ForbiddenException('You are not authorized to access this batch.');
    }

    const totalAttendanceRecords = batch.attendances.length;
    const presentRecords = batch.attendances.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE',
    ).length;
    const attendanceRate =
      totalAttendanceRecords > 0
        ? Math.round((presentRecords / totalAttendanceRecords) * 100)
        : 100;

    const studentAttendanceMap = new Map<string, { present: number; total: number }>();
    for (const a of batch.attendances) {
      const cur = studentAttendanceMap.get(a.studentProfileId) || { present: 0, total: 0 };
      cur.total++;
      if (a.status === 'PRESENT' || a.status === 'LATE') cur.present++;
      studentAttendanceMap.set(a.studentProfileId, cur);
    }

    const students = batch.enrolments.map((e) => {
      const att = studentAttendanceMap.get(e.studentProfileId);
      const rate = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null;
      return {
        id: e.studentProfileId,
        enrolmentId: e.id,
        admissionNo: e.studentProfile.admissionNo,
        fullName: e.studentProfile.membership?.user?.fullName || 'Student',
        email: e.studentProfile.membership?.user?.email,
        phone: e.studentProfile.membership?.user?.phoneE164,
        enrolledAt: e.createdAt,
        attendanceRate: rate,
      };
    });

    return {
      success: true,
      data: {
        batch: {
          id: batch.id,
          name: batch.name,
          code: batch.code,
          status: batch.status,
          startDate: batch.startDate,
          endDate: batch.endDate,
          capacity: batch.capacity,
          term: batch.term?.name || null,
          academicYear: batch.academicYear?.name || null,
          course: {
            id: batch.course.id,
            title: batch.course.title,
            slug: batch.course.slug,
            description: batch.course.description,
            modulesCount: batch.course.modules.length,
            lessonsCount: batch.course.modules.reduce(
              (acc, m) => acc + m.chapters.reduce((a2, c) => a2 + c.lessons.length, 0),
              0,
            ),
          },
          instructors: batch.teachers.map((t) => ({
            id: t.teacherProfileId,
            name: t.teacherProfile?.membership?.user?.fullName || 'Faculty',
            role: t.role,
            isMe: t.teacherProfileId === teacherProfileId,
          })),
          metrics: {
            enrolledCount: students.length,
            attendanceRate,
            liveSessionsCount: batch.liveSessions.length,
            assignmentsCount: batch.assignments.length,
            examsCount: batch.exams.length,
          },
          students,
          recentLiveSessions: batch.liveSessions,
          recentAssignments: batch.assignments.map((a) => ({
            id: a.id,
            title: a.title,
            dueAt: a.dueAt,
            maxMarks: a.maxMarks,
            status: a.status,
            submissionsCount: a.submissions.length,
          })),
          recentExams: batch.exams.map((ex) => ({
            id: ex.id,
            title: ex.title,
            status: ex.status,
            type: ex.type,
            totalMarks: ex.totalMarks,
            attemptsCount: ex.attempts.length,
          })),
        },
      },
    };
  }
}
