import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Role, MembershipStatus } from '@prisma/client';
import {
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  NotificationItemDto,
  NotificationQueryDto,
  PaginatedNotificationsDto,
  NotificationPreferencesResponseDto,
  UpdateNotificationPreferencesDto,
  EmitNotificationEventInput,
} from './notifications.dto';

const ADMIN_PORTAL_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.INSTITUTE_ADMIN,
  Role.ACADEMIC_COORDINATOR,
  Role.FINANCE_OFFICER,
];

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Strictly verifies that the caller holds an ACTIVE administrative membership
   * for the target institute in PostgreSQL. Never trusts arbitrary instituteId
   * params or unauthorized roles (STUDENT / TEACHER).
   */
  async verifyAdminAccess(
    user: any,
    requestedInstituteId: string,
    allowedRoles: Role[] = ADMIN_PORTAL_ROLES,
  ): Promise<{ instituteId: string; userId: string; role: Role }> {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const rawUserId: string = user.userId || user.sub || '';
    const rawRole = user.role as Role;

    if (!rawRole || !allowedRoles.includes(rawRole)) {
      throw new ForbiddenException(
        'Access denied: Administrative permissions are required to access notifications',
      );
    }

    // Verify institute exists
    const institute = await this.prisma.institute.findUnique({
      where: { id: requestedInstituteId },
      select: { id: true },
    });
    if (!institute) {
      throw new NotFoundException('Institute not found');
    }

    // Local unauthenticated dev fallback check (only in non-production when JwtAuthGuard assigns 'dev-admin-user')
    if (
      process.env.NODE_ENV !== 'production' &&
      rawUserId === 'dev-admin-user'
    ) {
      const firstAdmin = await this.prisma.membership.findFirst({
        where: {
          instituteId: requestedInstituteId,
          status: MembershipStatus.ACTIVE,
          role: { in: ADMIN_PORTAL_ROLES },
        },
        orderBy: { createdAt: 'asc' },
      });
      return {
        instituteId: requestedInstituteId,
        userId: firstAdmin?.userId || rawUserId,
        role: firstAdmin?.role || Role.INSTITUTE_ADMIN,
      };
    }

    // SUPER_ADMIN cross-tenant verification
    if (rawRole === Role.SUPER_ADMIN) {
      const superMembership = await this.prisma.membership.findFirst({
        where: {
          userId: rawUserId,
          role: Role.SUPER_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });
      if (!superMembership) {
        throw new ForbiddenException(
          'Access denied: Active Super Admin membership could not be verified',
        );
      }
      return {
        instituteId: requestedInstituteId,
        userId: rawUserId,
        role: Role.SUPER_ADMIN,
      };
    }

    // Standard tenant-isolated membership check in PostgreSQL
    if (user.instituteId && user.instituteId !== requestedInstituteId) {
      throw new ForbiddenException(
        'Access denied: Cross-institute notification access is prohibited',
      );
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: rawUserId,
        instituteId: requestedInstituteId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Access denied: No active verified membership found for this institute',
      );
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Access denied: Role ${membership.role} is not authorized for administrative notifications`,
      );
    }

    return {
      instituteId: membership.instituteId,
      userId: membership.userId,
      role: membership.role,
    };
  }

  /**
   * Encode category, eventType, and optional referenceId into the Notification link fragment
   * so existing Notification table supports SQL-level category filtering & deduplication
   * without requiring any schema migration.
   */
  private encodeNotificationLink(
    baseLink: string,
    category: NotificationCategory,
    eventType: string,
    referenceId?: string,
  ): string {
    const cleanBase = (baseLink || '/admin').split('#')[0];
    const parts = [
      `cat=${category}`,
      `evt=${encodeURIComponent(eventType)}`,
    ];
    if (referenceId) {
      parts.push(`ref=${encodeURIComponent(referenceId)}`);
    }
    return `${cleanBase}#${parts.join('&')}`;
  }

  /**
   * Parse a database Notification record into a structured NotificationItemDto.
   */
  private parseNotificationRow(row: {
    id: string;
    instituteId: string | null;
    userId: string;
    title: string;
    body: string;
    link: string | null;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationItemDto {
    const rawLink = row.link || '/admin';
    const hashIdx = rawLink.indexOf('#');
    const cleanLink = hashIdx >= 0 ? rawLink.slice(0, hashIdx) || '/admin' : rawLink;
    const fragment = hashIdx >= 0 ? rawLink.slice(hashIdx + 1) : '';

    let category: NotificationCategory = 'ADMIN';
    let eventType = 'SYSTEM_EVENT';
    let referenceId: string | null = null;

    if (fragment) {
      const params = new URLSearchParams(fragment);
      const catParam = params.get('cat') as NotificationCategory | null;
      if (catParam && (NOTIFICATION_CATEGORIES as readonly string[]).includes(catParam)) {
        category = catParam;
      }
      const evtParam = params.get('evt');
      if (evtParam) {
        eventType = evtParam;
      }
      const refParam = params.get('ref');
      if (refParam) {
        referenceId = refParam;
      }
    }

    return {
      id: row.id,
      instituteId: row.instituteId,
      userId: row.userId,
      category,
      eventType,
      referenceId,
      title: row.title,
      body: row.body,
      link: cleanLink,
      isRead: row.readAt !== null,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Read institute notification preferences from InstituteSettings.notificationConfig
   * (integrated directly with Milestone 2.7 SettingsModule).
   */
  async getPreferences(
    instituteId: string,
  ): Promise<NotificationPreferencesResponseDto> {
    const settings = await this.prisma.instituteSettings.findUnique({
      where: { instituteId },
      select: { notificationConfig: true },
    });

    const cfg = (settings?.notificationConfig as Record<string, any>) || {};

    return {
      notifyOnStudentRegistration: cfg.notifyOnStudentRegistration !== false,
      notifyOnFeePayment: cfg.notifyOnFeePayment !== false,
      notifyOnAttendanceAlert: cfg.notifyOnAttendanceAlert !== false,
      notifyOnTeacherManagement: cfg.notifyOnTeacherManagement !== false,
      notifyOnAcademicActivity: cfg.notifyOnAcademicActivity !== false,
      notifyOnAdminSecurity: cfg.notifyOnAdminSecurity !== false,
    };
  }

  /**
   * Update institute notification preferences in InstituteSettings.notificationConfig
   * while preserving sessionTimeoutMinutes and all existing Milestone 2.7 settings.
   */
  async updatePreferences(
    instituteId: string,
    dto: UpdateNotificationPreferencesDto,
    actorUserId: string,
  ): Promise<NotificationPreferencesResponseDto> {
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true },
    });
    if (!institute) {
      throw new NotFoundException('Institute not found');
    }

    const existing = await this.prisma.instituteSettings.findUnique({
      where: { instituteId },
    });

    const currentCfg = (existing?.notificationConfig as Record<string, any>) || {};
    const updatedCfg = {
      ...currentCfg,
      sessionTimeoutMinutes: currentCfg.sessionTimeoutMinutes ?? 60,
      notifyOnStudentRegistration:
        dto.notifyOnStudentRegistration ??
        (currentCfg.notifyOnStudentRegistration !== false),
      notifyOnFeePayment:
        dto.notifyOnFeePayment ?? (currentCfg.notifyOnFeePayment !== false),
      notifyOnAttendanceAlert:
        dto.notifyOnAttendanceAlert ??
        (currentCfg.notifyOnAttendanceAlert !== false),
      notifyOnTeacherManagement:
        dto.notifyOnTeacherManagement ??
        (currentCfg.notifyOnTeacherManagement !== false),
      notifyOnAcademicActivity:
        dto.notifyOnAcademicActivity ??
        (currentCfg.notifyOnAcademicActivity !== false),
      notifyOnAdminSecurity:
        dto.notifyOnAdminSecurity ??
        (currentCfg.notifyOnAdminSecurity !== false),
    };

    if (existing) {
      await this.prisma.instituteSettings.update({
        where: { instituteId },
        data: { notificationConfig: updatedCfg },
      });
    } else {
      await this.prisma.instituteSettings.create({
        data: {
          instituteId,
          notificationConfig: updatedCfg,
        },
      });
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorUserId: actorUserId || 'SYSTEM',
          action: 'UPDATE_NOTIFICATION_PREFERENCES',
          entityType: 'InstituteSettings',
          entityId: instituteId,
          metadata: dto as any,
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return {
      notifyOnStudentRegistration: updatedCfg.notifyOnStudentRegistration,
      notifyOnFeePayment: updatedCfg.notifyOnFeePayment,
      notifyOnAttendanceAlert: updatedCfg.notifyOnAttendanceAlert,
      notifyOnTeacherManagement: updatedCfg.notifyOnTeacherManagement,
      notifyOnAcademicActivity: updatedCfg.notifyOnAcademicActivity,
      notifyOnAdminSecurity: updatedCfg.notifyOnAdminSecurity,
    };
  }

  /**
   * Check whether a given notification category is enabled for the institute.
   */
  private async isCategoryEnabled(
    instituteId: string,
    category: NotificationCategory,
  ): Promise<boolean> {
    const prefs = await this.getPreferences(instituteId);
    switch (category) {
      case 'STUDENT':
        return prefs.notifyOnStudentRegistration;
      case 'FEE':
        return prefs.notifyOnFeePayment;
      case 'ATTENDANCE':
        return prefs.notifyOnAttendanceAlert;
      case 'TEACHER':
        return prefs.notifyOnTeacherManagement;
      case 'ACADEMIC':
        return prefs.notifyOnAcademicActivity;
      case 'ADMIN':
        return prefs.notifyOnAdminSecurity;
      default:
        return true;
    }
  }

  /**
   * Determine which active administrative roles in the institute should receive
   * notifications for a given category.
   */
  private getEligibleRolesForCategory(category: NotificationCategory): Role[] {
    switch (category) {
      case 'FEE':
        return [Role.INSTITUTE_ADMIN, Role.FINANCE_OFFICER];
      case 'STUDENT':
      case 'TEACHER':
      case 'ATTENDANCE':
      case 'ACADEMIC':
        return [Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR];
      case 'ADMIN':
      default:
        return [Role.INSTITUTE_ADMIN];
    }
  }

  /**
   * Emit institute-scoped notifications to authorized administrative recipients.
   * Respects institute notification preferences and prevents duplicate notifications
   * for identical (instituteId, userId, category, eventType, referenceId).
   */
  async notifyInstituteAdmins(
    instituteId: string,
    input: EmitNotificationEventInput,
  ): Promise<{ createdCount: number; suppressedByPreferences: boolean }> {
    const enabled = await this.isCategoryEnabled(instituteId, input.category);
    if (!enabled) {
      return { createdCount: 0, suppressedByPreferences: true };
    }

    let recipientUserIds: string[] = [];

    if (input.targetUserIds && input.targetUserIds.length > 0) {
      // Verify target users belong to this institute with active admin roles
      const validMemberships = await this.prisma.membership.findMany({
        where: {
          instituteId,
          userId: { in: input.targetUserIds },
          status: MembershipStatus.ACTIVE,
          role: { in: ADMIN_PORTAL_ROLES },
        },
        select: { userId: true },
      });
      recipientUserIds = [...new Set(validMemberships.map((m) => m.userId))];
    } else {
      const eligibleRoles = this.getEligibleRolesForCategory(input.category);
      const memberships = await this.prisma.membership.findMany({
        where: {
          instituteId,
          status: MembershipStatus.ACTIVE,
          role: { in: eligibleRoles },
        },
        select: { userId: true },
      });
      recipientUserIds = [...new Set(memberships.map((m) => m.userId))];
    }

    if (recipientUserIds.length === 0) {
      return { createdCount: 0, suppressedByPreferences: false };
    }

    const encodedLink = this.encodeNotificationLink(
      input.link,
      input.category,
      input.eventType,
      input.referenceId,
    );

    const dedupeFragment = input.referenceId
      ? `#cat=${input.category}&evt=${encodeURIComponent(input.eventType)}&ref=${encodeURIComponent(input.referenceId)}`
      : null;

    let createdCount = 0;

    for (const userId of recipientUserIds) {
      if (dedupeFragment) {
        const duplicate = await this.prisma.notification.findFirst({
          where: {
            instituteId,
            userId,
            link: { contains: dedupeFragment },
          },
          select: { id: true },
        });
        if (duplicate) {
          continue;
        }
      }

      await this.prisma.notification.create({
        data: {
          instituteId,
          userId,
          title: input.title,
          body: input.body,
          link: encodedLink,
        },
      });
      createdCount++;
    }

    return { createdCount, suppressedByPreferences: false };
  }

  /**
   * Emit notifications to specific user IDs within an institute, with deduplication.
   */
  async notifyUsers(
    instituteId: string,
    userIds: string[],
    input: EmitNotificationEventInput,
  ): Promise<{ createdCount: number }> {
    if (!userIds || userIds.length === 0) return { createdCount: 0 };

    const encodedLink = this.encodeNotificationLink(
      input.link,
      input.category,
      input.eventType,
      input.referenceId,
    );

    const dedupeFragment = input.referenceId
      ? `#cat=${input.category}&evt=${encodeURIComponent(input.eventType)}&ref=${encodeURIComponent(input.referenceId)}`
      : null;

    let createdCount = 0;
    const uniqueUserIds = [...new Set(userIds)];

    for (const userId of uniqueUserIds) {
      if (dedupeFragment) {
        const duplicate = await this.prisma.notification.findFirst({
          where: {
            instituteId,
            userId,
            link: { contains: dedupeFragment },
          },
          select: { id: true },
        });
        if (duplicate) {
          continue;
        }
      }

      await this.prisma.notification.create({
        data: {
          instituteId,
          userId,
          title: input.title,
          body: input.body,
          link: encodedLink,
        },
      });
      createdCount++;
    }

    return { createdCount };
  }

  /**
   * Notify all actively enrolled students in a batch.
   */
  async notifyBatchStudents(
    instituteId: string,
    batchId: string,
    input: EmitNotificationEventInput,
  ): Promise<{ createdCount: number }> {
    const enrolments = await this.prisma.enrolment.findMany({
      where: {
        batchId,
        instituteId,
        status: 'ACTIVE',
      },
      select: {
        studentProfile: {
          select: {
            membership: {
              select: { userId: true },
            },
          },
        },
      },
    });

    const userIds = enrolments
      .map((e) => e.studentProfile?.membership?.userId)
      .filter((id): id is string => !!id);

    return this.notifyUsers(instituteId, userIds, input);
  }

  /**
   * Notify all actively enrolled students in a course.
   */
  async notifyCourseStudents(
    instituteId: string,
    courseId: string,
    input: EmitNotificationEventInput,
  ): Promise<{ createdCount: number }> {
    const enrolments = await this.prisma.enrolment.findMany({
      where: {
        courseId,
        instituteId,
        status: 'ACTIVE',
      },
      select: {
        studentProfile: {
          select: {
            membership: {
              select: { userId: true },
            },
          },
        },
      },
    });

    const userIds = enrolments
      .map((e) => e.studentProfile?.membership?.userId)
      .filter((id): id is string => !!id);

    return this.notifyUsers(instituteId, userIds, input);
  }

  /**
   * Notify teachers assigned to a batch.
   */
  async notifyBatchTeachers(
    instituteId: string,
    batchId: string,
    input: EmitNotificationEventInput,
  ): Promise<{ createdCount: number }> {
    const batchTeachers = await this.prisma.batchTeacher.findMany({
      where: {
        batchId,
        instituteId,
      },
      select: {
        teacherProfile: {
          select: {
            membership: {
              select: { userId: true },
            },
          },
        },
      },
    });

    const userIds = batchTeachers
      .map((bt) => bt.teacherProfile?.membership?.userId)
      .filter((id): id is string => !!id);

    return this.notifyUsers(instituteId, userIds, input);
  }

  /**
   * Notify instructors assigned to a course.
   */
  async notifyCourseTeachers(
    instituteId: string,
    courseId: string,
    input: EmitNotificationEventInput,
  ): Promise<{ createdCount: number }> {
    const instructors = await this.prisma.courseInstructor.findMany({
      where: {
        courseId,
        instituteId,
      },
      select: {
        teacherProfile: {
          select: {
            membership: {
              select: { userId: true },
            },
          },
        },
      },
    });

    const userIds = instructors
      .map((ci) => ci.teacherProfile?.membership?.userId)
      .filter((id): id is string => !!id);

    return this.notifyUsers(instituteId, userIds, input);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE 8: ACADEMIC & COLLABORATION EVENT HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  async emitLiveClassScheduled(
    instituteId: string,
    params: {
      sessionId: string;
      title: string;
      batchId: string;
      batchName: string;
      startsAt: string | Date;
      joinUrl?: string | null;
      teacherName?: string;
    },
  ) {
    const formattedDate = new Date(params.startsAt).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return this.notifyBatchStudents(instituteId, params.batchId, {
      category: 'ACADEMIC',
      eventType: 'LIVE_CLASS_SCHEDULED',
      title: `Live Class Scheduled: ${params.title}`,
      body: `Live interactive lecture for ${params.batchName} scheduled for ${formattedDate}.${params.teacherName ? ` Faculty: ${params.teacherName}` : ''}`,
      link: `/student/classes`,
      referenceId: `${params.sessionId}:SCHEDULED`,
    });
  }

  async emitLiveClassRescheduled(
    instituteId: string,
    params: {
      sessionId: string;
      title: string;
      batchId: string;
      batchName: string;
      startsAt: string | Date;
    },
  ) {
    const formattedDate = new Date(params.startsAt).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return this.notifyBatchStudents(instituteId, params.batchId, {
      category: 'ACADEMIC',
      eventType: 'LIVE_CLASS_RESCHEDULED',
      title: `Class Rescheduled: ${params.title}`,
      body: `The schedule for "${params.title}" (${params.batchName}) has been updated to ${formattedDate}.`,
      link: `/student/classes`,
      referenceId: `${params.sessionId}:RESCHEDULED:${new Date(params.startsAt).getTime()}`,
    });
  }

  async emitLiveClassCancelled(
    instituteId: string,
    params: {
      sessionId: string;
      title: string;
      batchId: string;
      batchName: string;
      reason?: string | null;
    },
  ) {
    return this.notifyBatchStudents(instituteId, params.batchId, {
      category: 'ACADEMIC',
      eventType: 'LIVE_CLASS_CANCELLED',
      title: `Class Cancelled: ${params.title}`,
      body: `The lecture for ${params.batchName} was cancelled${params.reason ? `: ${params.reason}` : '.'}`,
      link: `/student/classes`,
      referenceId: `${params.sessionId}:CANCELLED`,
    });
  }

  async emitAssignmentPublished(
    instituteId: string,
    params: {
      assignmentId: string;
      title: string;
      courseTitle?: string;
      batchId?: string | null;
      courseId: string;
      dueDate?: string | Date | null;
    },
  ) {
    const dueStr = params.dueDate ? ` Due: ${new Date(params.dueDate).toLocaleDateString()}` : '';
    const input: EmitNotificationEventInput = {
      category: 'ACADEMIC',
      eventType: 'ASSIGNMENT_PUBLISHED',
      title: `New Assignment: ${params.title}`,
      body: `New assignment posted in ${params.courseTitle || 'your course'}.${dueStr}`,
      link: `/student/assignments`,
      referenceId: `${params.assignmentId}:PUBLISHED`,
    };

    if (params.batchId) {
      return this.notifyBatchStudents(instituteId, params.batchId, input);
    }
    return this.notifyCourseStudents(instituteId, params.courseId, input);
  }

  async emitSubmissionReceived(
    instituteId: string,
    params: {
      assignmentId: string;
      submissionId: string;
      assignmentTitle: string;
      studentName: string;
      batchId?: string | null;
      courseId: string;
    },
  ) {
    const input: EmitNotificationEventInput = {
      category: 'ACADEMIC',
      eventType: 'SUBMISSION_RECEIVED',
      title: `Assignment Submission: ${params.assignmentTitle}`,
      body: `${params.studentName} has submitted assignment "${params.assignmentTitle}".`,
      link: `/teacher/assignments/${params.assignmentId}`,
      referenceId: `${params.submissionId}:SUBMITTED`,
    };

    if (params.batchId) {
      return this.notifyBatchTeachers(instituteId, params.batchId, input);
    }
    return this.notifyCourseTeachers(instituteId, params.courseId, input);
  }

  async emitAssignmentGraded(
    instituteId: string,
    params: {
      assignmentId: string;
      assignmentTitle: string;
      studentUserId: string;
      score: number;
      maxMarks: number;
      feedback?: string | null;
    },
  ) {
    return this.notifyUsers(instituteId, [params.studentUserId], {
      category: 'ACADEMIC',
      eventType: 'ASSIGNMENT_GRADED',
      title: `Assignment Graded: ${params.assignmentTitle}`,
      body: `Your assignment "${params.assignmentTitle}" was evaluated: ${params.score}/${params.maxMarks} marks.${params.feedback ? ` Feedback: ${params.feedback}` : ''}`,
      link: `/student/assignments/${params.assignmentId}`,
      referenceId: `${params.assignmentId}:${params.studentUserId}:GRADED`,
    });
  }

  async emitExamPublished(
    instituteId: string,
    params: {
      examId: string;
      title: string;
      courseTitle?: string;
      batchId?: string | null;
      courseId: string;
      durationMin?: number;
    },
  ) {
    const input: EmitNotificationEventInput = {
      category: 'ACADEMIC',
      eventType: 'EXAM_PUBLISHED',
      title: `New Examination Published: ${params.title}`,
      body: `Online examination "${params.title}" is available in ${params.courseTitle || 'your course'}.${params.durationMin ? ` Duration: ${params.durationMin} mins.` : ''}`,
      link: `/student/exams`,
      referenceId: `${params.examId}:PUBLISHED`,
    };

    if (params.batchId) {
      return this.notifyBatchStudents(instituteId, params.batchId, input);
    }
    return this.notifyCourseStudents(instituteId, params.courseId, input);
  }

  async emitExamAttemptSubmitted(
    instituteId: string,
    params: {
      examId: string;
      attemptId: string;
      examTitle: string;
      studentName: string;
      courseId: string;
      batchId?: string | null;
    },
  ) {
    const input: EmitNotificationEventInput = {
      category: 'ACADEMIC',
      eventType: 'EXAM_ATTEMPT_SUBMITTED',
      title: `Exam Attempt Submitted: ${params.examTitle}`,
      body: `${params.studentName} has finished and submitted their attempt for "${params.examTitle}".`,
      link: `/teacher/exams/${params.examId}/results`,
      referenceId: `${params.attemptId}:SUBMITTED`,
    };

    if (params.batchId) {
      return this.notifyBatchTeachers(instituteId, params.batchId, input);
    }
    return this.notifyCourseTeachers(instituteId, params.courseId, input);
  }

  async emitExamEvaluated(
    instituteId: string,
    params: {
      examId: string;
      examTitle: string;
      studentUserId: string;
      score: number;
      totalMarks: number;
      feedback?: string | null;
    },
  ) {
    return this.notifyUsers(instituteId, [params.studentUserId], {
      category: 'ACADEMIC',
      eventType: 'EXAM_EVALUATED',
      title: `Exam Evaluated: ${params.examTitle}`,
      body: `Your examination "${params.examTitle}" score is ${params.score}/${params.totalMarks} marks.${params.feedback ? ` Feedback: ${params.feedback}` : ''}`,
      link: `/student/exams/${params.examId}/results`,
      referenceId: `${params.examId}:${params.studentUserId}:EVALUATED`,
    });
  }

  async emitAttendanceMarked(
    instituteId: string,
    params: {
      batchId: string;
      batchName: string;
      studentUserId: string;
      studentName: string;
      date: string;
      status: string;
      remarks?: string | null;
    },
  ) {
    if (params.status === 'ABSENT') {
      return this.notifyUsers(instituteId, [params.studentUserId], {
        category: 'ATTENDANCE',
        eventType: 'ATTENDANCE_ABSENT',
        title: `Absence Recorded: ${params.batchName}`,
        body: `You were marked absent for ${params.batchName} on ${params.date}.${params.remarks ? ` Note: ${params.remarks}` : ''}`,
        link: `/student/attendance`,
        referenceId: `${params.batchId}:${params.studentUserId}:${params.date}:ABSENT`,
      });
    }
    return { createdCount: 0 };
  }

  async emitAttendanceUpdated(
    instituteId: string,
    params: {
      batchId: string;
      batchName: string;
      studentUserId: string;
      date: string;
      newStatus: string;
      remarks?: string | null;
    },
  ) {
    return this.notifyUsers(instituteId, [params.studentUserId], {
      category: 'ATTENDANCE',
      eventType: 'ATTENDANCE_UPDATED',
      title: `Attendance Updated: ${params.batchName}`,
      body: `Your attendance status for ${params.batchName} on ${params.date} was updated to ${params.newStatus}.`,
      link: `/student/attendance`,
      referenceId: `${params.batchId}:${params.studentUserId}:${params.date}:UPDATE:${Date.now()}`,
    });
  }

  async emitAnnouncement(
    instituteId: string,
    params: {
      announcementId: string;
      title: string;
      body: string;
      audience: 'ALL' | 'STUDENTS' | 'TEACHERS';
    },
  ) {
    let recipientMemberships: Array<{ userId: string }>;
    if (params.audience === 'STUDENTS') {
      recipientMemberships = await this.prisma.membership.findMany({
        where: { instituteId, role: Role.STUDENT, status: MembershipStatus.ACTIVE },
        select: { userId: true },
      });
    } else if (params.audience === 'TEACHERS') {
      recipientMemberships = await this.prisma.membership.findMany({
        where: { instituteId, role: Role.TEACHER, status: MembershipStatus.ACTIVE },
        select: { userId: true },
      });
    } else {
      recipientMemberships = await this.prisma.membership.findMany({
        where: { instituteId, status: MembershipStatus.ACTIVE },
        select: { userId: true },
      });
    }

    const userIds: string[] = Array.from(new Set(recipientMemberships.map((m) => m.userId)));

    return this.notifyUsers(instituteId, userIds, {
      category: 'ADMIN',
      eventType: 'ANNOUNCEMENT_POSTED',
      title: `Announcement: ${params.title}`,
      body: params.body,
      link: params.audience === 'STUDENTS' ? '/student/notifications' : '/teacher/notifications',
      referenceId: `${params.announcementId}:ANNOUNCEMENT`,
    });
  }

  /**
   * Safe non-throwing wrapper for domain services so notification emission never breaks
   * primary business transactions if called fire-and-forget or post-transaction.
   */
  async safeEmit(
    fnOrInstituteId: (() => Promise<any>) | string,
    input?: EmitNotificationEventInput,
  ): Promise<void> {
    try {
      if (typeof fnOrInstituteId === 'function') {
        await fnOrInstituteId();
      } else if (input) {
        await this.notifyInstituteAdmins(fnOrInstituteId, input);
      }
    } catch {
      // Preserve primary transaction stability
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DOMAIN EVENT HELPERS (Real Supported Application Events)
  // ───────────────────────────────────────────────────────────────────────────

  async emitStudentEvent(
    instituteId: string,
    params: {
      eventType:
        | 'STUDENT_REGISTERED'
        | 'ADMISSION_AWAITING_APPROVAL'
        | 'STUDENT_STATUS_UPDATED';
      studentId: string;
      fullName: string;
      admissionNo: string;
      status?: string;
      courseTitle?: string;
    },
  ) {
    let title = 'New Student Registration';
    let body = `${params.fullName} (${params.admissionNo}) has been registered${
      params.courseTitle ? ` in ${params.courseTitle}` : ''
    }.`;

    if (params.eventType === 'ADMISSION_AWAITING_APPROVAL') {
      title = 'Admission Awaiting Approval';
      body = `Application from ${params.fullName} (${params.admissionNo}) requires administrative review.`;
    } else if (params.eventType === 'STUDENT_STATUS_UPDATED') {
      title = 'Student Admission Status Updated';
      body = `${params.fullName} (${params.admissionNo}) status changed to ${params.status || 'UPDATED'}.`;
    }

    return this.notifyInstituteAdmins(instituteId, {
      category: 'STUDENT',
      eventType: params.eventType,
      title,
      body,
      link: `/admin/students/${params.studentId}`,
      referenceId:
        params.eventType === 'STUDENT_STATUS_UPDATED'
          ? `${params.studentId}:${params.status || Date.now()}`
          : params.studentId,
    });
  }

  async emitTeacherEvent(
    instituteId: string,
    params: {
      eventType:
        | 'TEACHER_REGISTERED'
        | 'TEACHER_ACTIVATED'
        | 'TEACHER_DEACTIVATED'
        | 'TEACHER_ASSIGNMENT_CHANGED';
      teacherId: string;
      fullName: string;
      employeeCode?: string;
      detail?: string;
      referenceSuffix?: string;
    },
  ) {
    const codeLabel = params.employeeCode ? ` (${params.employeeCode})` : '';
    let title = 'New Faculty Member Registered';
    let body = `${params.fullName}${codeLabel} has joined the institute faculty.`;

    if (params.eventType === 'TEACHER_ACTIVATED') {
      title = 'Faculty Account Activated';
      body = `${params.fullName}${codeLabel} faculty access is now active.`;
    } else if (params.eventType === 'TEACHER_DEACTIVATED') {
      title = 'Faculty Account Deactivated';
      body = `${params.fullName}${codeLabel} faculty access was deactivated${
        params.detail ? ` (${params.detail})` : ''
      }.`;
    } else if (params.eventType === 'TEACHER_ASSIGNMENT_CHANGED') {
      title = 'Faculty Assignment Updated';
      body =
        params.detail ||
        `Academic assignment updated for ${params.fullName}${codeLabel}.`;
    }

    return this.notifyInstituteAdmins(instituteId, {
      category: 'TEACHER',
      eventType: params.eventType,
      title,
      body,
      link: `/admin/teachers/${params.teacherId}`,
      referenceId: params.referenceSuffix
        ? `${params.teacherId}:${params.referenceSuffix}`
        : params.teacherId,
    });
  }

  async emitAttendanceAlert(
    instituteId: string,
    params: {
      eventType: 'LOW_ATTENDANCE_ALERT' | 'ATTENDANCE_REPORT_LOGGED';
      batchId: string;
      batchName: string;
      date: string;
      attendancePct: number;
      thresholdPct: number;
      absentCount: number;
      totalCount: number;
    },
  ) {
    const title =
      params.eventType === 'LOW_ATTENDANCE_ALERT'
        ? `Low Attendance Alert: ${params.batchName}`
        : `Attendance Summary: ${params.batchName}`;
    const body =
      params.eventType === 'LOW_ATTENDANCE_ALERT'
        ? `Attendance on ${params.date} dropped to ${params.attendancePct}% (below institute threshold of ${params.thresholdPct}%). ${params.absentCount} of ${params.totalCount} students were absent.`
        : `Roll-call recorded for ${params.batchName} on ${params.date} (${params.attendancePct}% attendance).`;

    return this.notifyInstituteAdmins(instituteId, {
      category: 'ATTENDANCE',
      eventType: params.eventType,
      title,
      body,
      link: `/admin/attendance`,
      referenceId: `${params.batchId}:${params.date}`,
    });
  }

  async emitFeeEvent(
    instituteId: string,
    params: {
      eventType:
        | 'FEE_PAYMENT_RECEIVED'
        | 'FEE_PAYMENT_REVERSED'
        | 'FEE_PAYMENT_FAILED'
        | 'INVOICE_CREATED'
        | 'PENDING_FEE_ALERT'
        | 'INVOICE_STATUS_UPDATED';
      referenceId: string;
      studentName: string;
      invoiceNumber: string;
      amountPaise?: number;
      paymentNumber?: string;
      status?: string;
    },
  ) {
    const formattedAmt =
      params.amountPaise !== undefined
        ? '₹' + Math.round(params.amountPaise / 100).toLocaleString('en-IN')
        : '';

    let title = 'Fee Payment Received';
    let body = `Received ${formattedAmt} from ${params.studentName} for invoice ${params.invoiceNumber}.`;

    switch (params.eventType) {
      case 'FEE_PAYMENT_REVERSED':
        title = 'Fee Payment Reversed';
        body = `Payment ${params.paymentNumber || ''} (${formattedAmt}) for ${params.studentName} (${params.invoiceNumber}) was reversed.`;
        break;
      case 'FEE_PAYMENT_FAILED':
        title = 'Fee Payment Failure';
        body = `A payment attempt (${formattedAmt}) for ${params.studentName} on invoice ${params.invoiceNumber} failed verification.`;
        break;
      case 'INVOICE_CREATED':
        title = 'New Fee Invoice Issued';
        body = `Invoice ${params.invoiceNumber} (${formattedAmt}) was generated for ${params.studentName}.`;
        break;
      case 'PENDING_FEE_ALERT':
        title = 'Overdue / Pending Fee Alert';
        body = `Invoice ${params.invoiceNumber} for ${params.studentName} has an outstanding balance of ${formattedAmt}.`;
        break;
      case 'INVOICE_STATUS_UPDATED':
        title = 'Invoice Status Updated';
        body = `Invoice ${params.invoiceNumber} for ${params.studentName} is now ${params.status || 'UPDATED'}.`;
        break;
    }

    return this.notifyInstituteAdmins(instituteId, {
      category: 'FEE',
      eventType: params.eventType,
      title,
      body,
      link: `/admin/finance`,
      referenceId: params.referenceId,
    });
  }

  async emitAcademicEvent(
    instituteId: string,
    params: {
      eventType:
        | 'COURSE_CREATED'
        | 'COURSE_PUBLISHED'
        | 'BATCH_CREATED'
        | 'LIVE_SESSION_SCHEDULED'
        | 'ANNOUNCEMENT_POSTED';
      referenceId: string;
      title: string;
      body: string;
      link: string;
    },
  ) {
    return this.notifyInstituteAdmins(instituteId, {
      category: 'ACADEMIC',
      eventType: params.eventType,
      title: params.title,
      body: params.body,
      link: params.link,
      referenceId: params.referenceId,
    });
  }

  async emitAdminEvent(
    instituteId: string,
    params: {
      eventType:
        | 'SETTINGS_UPDATED'
        | 'BRANDING_UPDATED'
        | 'USER_ACCESS_CHANGED'
        | 'SECURITY_EVENT';
      referenceId?: string;
      title: string;
      body: string;
      link?: string;
    },
  ) {
    return this.notifyInstituteAdmins(instituteId, {
      category: 'ADMIN',
      eventType: params.eventType,
      title: params.title,
      body: params.body,
      link: params.link || '/admin/settings',
      referenceId: params.referenceId,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // QUERIES & READ/UNREAD MUTATIONS (Recipient & Institute Isolated)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Efficient unread count query leveraging @@index([userId, readAt]) and instituteId scope.
   */
  async getUnreadCount(
    instituteId: string,
    userId: string,
  ): Promise<{
    unreadCount: number;
    byCategory: Record<NotificationCategory, number>;
  }> {
    const unreadRows = await this.prisma.notification.findMany({
      where: {
        instituteId,
        userId,
        readAt: null,
      },
      select: { link: true },
    });

    const byCategory: Record<NotificationCategory, number> = {
      STUDENT: 0,
      TEACHER: 0,
      ATTENDANCE: 0,
      FEE: 0,
      ACADEMIC: 0,
      ADMIN: 0,
    };

    for (const r of unreadRows) {
      const link = r.link || '';
      let matched = false;
      for (const cat of NOTIFICATION_CATEGORIES) {
        if (link.includes(`#cat=${cat}&`)) {
          byCategory[cat]++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        byCategory.ADMIN++;
      }
    }

    return {
      unreadCount: unreadRows.length,
      byCategory,
    };
  }

  /**
   * Paginated, filterable notification query strictly isolated to (instituteId, userId).
   */
  async getNotifications(
    instituteId: string,
    userId: string,
    query: NotificationQueryDto = {},
  ): Promise<PaginatedNotificationsDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const skip = (page - 1) * limit;

    const where: any = {
      instituteId,
      userId,
    };

    if (query.category && query.category !== 'ALL') {
      where.link = { contains: `#cat=${query.category}&` };
    }

    if (query.status === 'UNREAD') {
      where.readAt = null;
    } else if (query.status === 'READ') {
      where.readAt = { not: null };
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { body: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, rows, unreadStats] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.getUnreadCount(instituteId, userId),
    ]);

    const data = rows.map((r) => this.parseNotificationRow(r));
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data,
      unreadCount: unreadStats.unreadCount,
      byCategory: unreadStats.byCategory,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Mark a single notification as read, enforcing strict (instituteId, userId) ownership.
   */
  async markAsRead(
    instituteId: string,
    userId: string,
    notificationId: string,
  ): Promise<NotificationItemDto> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        instituteId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        'Notification not found for this recipient in this institute',
      );
    }

    if (existing.readAt) {
      return this.parseNotificationRow(existing);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return this.parseNotificationRow(updated);
  }

  /**
   * Mark all unread notifications (or all in a specific category) as read for (instituteId, userId).
   */
  async markAllAsRead(
    instituteId: string,
    userId: string,
    category?: 'ALL' | NotificationCategory,
  ): Promise<{ updatedCount: number; unreadCount: number }> {
    const where: any = {
      instituteId,
      userId,
      readAt: null,
    };

    if (category && category !== 'ALL') {
      where.link = { contains: `#cat=${category}&` };
    }

    const result = await this.prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    const remaining = await this.prisma.notification.count({
      where: {
        instituteId,
        userId,
        readAt: null,
      },
    });

    return {
      updatedCount: result.count,
      unreadCount: remaining,
    };
  }
}

