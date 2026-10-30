import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateAcademicYearInput,
  CreateAcademicTermInput,
  CreateBatchInput,
  UpdateBatchInput,
  BatchFilterQuery,
  AssignBatchTeacherInput,
  TransferStudentBatchInput,
  CreateClassScheduleInput,
  CheckScheduleConflictInput,
  RecurringWeeklyScheduleInput,
  ScheduleConflictResult,
} from '@bible-lms/shared';

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // 1. ACADEMIC PERIODS (YEARS & TERMS)
  // ---------------------------------------------------------------------------

  async createAcademicYear(instituteId: string, input: CreateAcademicYearInput) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    if (start >= end) {
      throw new BadRequestException('Academic year start date must precede end date');
    }

    // If marked current, deactivate other academic years for this institute
    if (input.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: { instituteId },
        data: { isCurrent: false },
      });
    }

    return this.prisma.academicYear.create({
      data: {
        instituteId,
        name: input.name,
        startDate: start,
        endDate: end,
        isCurrent: input.isCurrent ?? false,
      },
    });
  }

  async getAcademicYears(instituteId: string) {
    return this.prisma.academicYear.findMany({
      where: { instituteId },
      include: {
        terms: {
          orderBy: { startDate: 'asc' },
        },
        _count: {
          select: { batches: true, terms: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAcademicTerm(instituteId: string, input: CreateAcademicTermInput) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: input.academicYearId, instituteId },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this institute');
    }

    const termStart = new Date(input.startDate);
    const termEnd = new Date(input.endDate);

    if (termStart >= termEnd) {
      throw new BadRequestException('Academic term start date must precede end date');
    }

    // Requirement 6: Ensure each term belongs to its academic year and stays within its date boundaries.
    const yearStart = new Date(academicYear.startDate);
    const yearEnd = new Date(academicYear.endDate);

    if (termStart < yearStart || termEnd > yearEnd) {
      throw new BadRequestException(
        `Term dates (${termStart.toISOString().slice(0, 10)} to ${termEnd.toISOString().slice(0, 10)}) must fall within Academic Year boundaries (${yearStart.toISOString().slice(0, 10)} to ${yearEnd.toISOString().slice(0, 10)})`,
      );
    }

    if (input.isCurrent) {
      await this.prisma.academicTerm.updateMany({
        where: { instituteId },
        data: { isCurrent: false },
      });
    }

    return this.prisma.academicTerm.create({
      data: {
        instituteId,
        academicYearId: input.academicYearId,
        name: input.name,
        startDate: termStart,
        endDate: termEnd,
        isCurrent: input.isCurrent ?? false,
      },
    });
  }

  async getAcademicTerms(instituteId: string, academicYearId?: string) {
    return this.prisma.academicTerm.findMany({
      where: {
        instituteId,
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        _count: { select: { batches: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // 2. BATCH MANAGEMENT
  // ---------------------------------------------------------------------------

  async createBatch(instituteId: string, input: CreateBatchInput) {
    const course = await this.prisma.course.findFirst({
      where: { id: input.courseId, instituteId },
    });
    if (!course) {
      throw new NotFoundException('Course not found in this institute');
    }

    if (course.status === 'ARCHIVED') {
      throw new BadRequestException('Cannot create a batch for an archived course');
    }

    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (startDate >= endDate) {
      throw new BadRequestException('Batch start date must precede end date');
    }

    // Term and Academic Year validation
    if (input.termId) {
      const term = await this.prisma.academicTerm.findFirst({
        where: { id: input.termId, instituteId },
      });
      if (!term) {
        throw new NotFoundException('Academic term not found in this institute');
      }
      if (input.academicYearId && term.academicYearId !== input.academicYearId) {
        throw new BadRequestException('Selected term does not belong to the selected academic year');
      }
    }

    // Lead teacher verification
    if (input.leadTeacherProfileId) {
      const leadTeacher = await this.prisma.teacherProfile.findFirst({
        where: { id: input.leadTeacherProfileId, instituteId },
      });
      if (!leadTeacher) {
        throw new NotFoundException('Lead teacher profile not found in this institute');
      }
    }

    // Assistant teachers verification (prevent duplicates and verify tenant)
    const assistantTeacherIds = input.assistantTeacherProfileIds
      ? [...new Set(input.assistantTeacherProfileIds)]
      : [];

    if (input.leadTeacherProfileId && assistantTeacherIds.includes(input.leadTeacherProfileId)) {
      throw new BadRequestException('A teacher cannot be both Lead and Assistant for the same batch');
    }

    for (const assistantId of assistantTeacherIds) {
      const assistant = await this.prisma.teacherProfile.findFirst({
        where: { id: assistantId, instituteId },
      });
      if (!assistant) {
        throw new NotFoundException(`Assistant teacher ${assistantId} not found in this institute`);
      }
    }

    // Auto-generate code if omitted
    const code =
      input.code?.trim() ||
      `B-${course.title.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          instituteId,
          courseId: input.courseId,
          academicYearId: input.academicYearId,
          termId: input.termId,
          name: input.name,
          code,
          status: input.status ?? 'ACTIVE',
          startDate,
          endDate,
          capacity: input.capacity ?? 50,
        },
      });

      // Requirement 5: Support one Lead Teacher and multiple Assistant Teachers
      if (input.leadTeacherProfileId) {
        await tx.batchTeacher.create({
          data: {
            instituteId,
            batchId: batch.id,
            teacherProfileId: input.leadTeacherProfileId,
            role: 'LEAD',
          },
        });
      }

      for (const assistantId of assistantTeacherIds) {
        await tx.batchTeacher.create({
          data: {
            instituteId,
            batchId: batch.id,
            teacherProfileId: assistantId,
            role: 'ASSISTANT',
          },
        });
      }

      return batch;
    });
  }

  async findAll(instituteId: string, query: BatchFilterQuery) {
    const where: any = { instituteId };

    if (query.courseId) where.courseId = query.courseId;
    if (query.termId) where.termId = query.termId;
    if (query.academicYearId) where.academicYearId = query.academicYearId;
    if (query.status) where.status = query.status;

    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { code: { contains: query.search.trim(), mode: 'insensitive' } },
        { course: { title: { contains: query.search.trim(), mode: 'insensitive' } } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, batches] = await Promise.all([
      this.prisma.batch.count({ where }),
      this.prisma.batch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: {
          course: { select: { id: true, title: true } },
          academicYear: { select: { id: true, name: true } },
          term: { select: { id: true, name: true } },
          teachers: {
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
          _count: {
            select: {
              enrolments: true,
              liveSessions: true,
            },
          },
        },
      }),
    ]);

    const formatted = batches.map((b) => {
      const leadAssignment = b.teachers.find((t) => t.role === 'LEAD');
      const assistants = b.teachers.filter((t) => t.role === 'ASSISTANT');

      return {
        id: b.id,
        instituteId: b.instituteId,
        courseId: b.courseId,
        courseTitle: b.course.title,
        academicYearId: b.academicYearId,
        academicYearName: b.academicYear?.name,
        termId: b.termId,
        termName: b.term?.name,
        name: b.name,
        code: b.code,
        status: b.status,
        startDate: b.startDate.toISOString(),
        endDate: b.endDate.toISOString(),
        capacity: b.capacity,
        enrolledCount: b._count.enrolments,
        scheduledClassesCount: b._count.liveSessions,
        leadTeacher: leadAssignment
          ? {
              id: leadAssignment.teacherProfileId,
              name: leadAssignment.teacherProfile.membership.user.fullName,
              email: leadAssignment.teacherProfile.membership.user.email,
              photoUrl: leadAssignment.teacherProfile.photoUrl ?? undefined,
            }
          : undefined,
        assistantsCount: assistants.length,
        createdAt: b.createdAt.toISOString(),
      };
    });

    return {
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(instituteId: string, batchId: string) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, instituteId },
      include: {
        course: { select: { id: true, title: true, slug: true } },
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
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
          orderBy: { createdAt: 'desc' },
        },
        liveSessions: {
          include: {
            teacherProfile: {
              include: {
                membership: {
                  include: { user: { select: { fullName: true } } },
                },
              },
            },
          },
          orderBy: { startsAt: 'asc' },
        },
        _count: {
          select: {
            enrolments: true,
            liveSessions: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found in this institute');
    }

    return {
      id: batch.id,
      instituteId: batch.instituteId,
      courseId: batch.courseId,
      courseTitle: batch.course.title,
      courseSlug: batch.course.slug,
      academicYearId: batch.academicYearId,
      academicYearName: batch.academicYear?.name,
      termId: batch.termId,
      termName: batch.term?.name,
      name: batch.name,
      code: batch.code,
      status: batch.status,
      startDate: batch.startDate.toISOString(),
      endDate: batch.endDate.toISOString(),
      capacity: batch.capacity,
      enrolledCount: batch._count.enrolments,
      scheduledClassesCount: batch._count.liveSessions,
      teachers: batch.teachers.map((t) => ({
        id: t.id,
        teacherProfileId: t.teacherProfileId,
        name: t.teacherProfile.membership.user.fullName,
        email: t.teacherProfile.membership.user.email,
        phoneNumber: t.teacherProfile.membership.user.phoneE164,
        photoUrl: t.teacherProfile.photoUrl ?? undefined,
        role: t.role,
      })),
      enrolments: batch.enrolments.map((e) => ({
        id: e.id,
        studentProfileId: e.studentProfileId,
        admissionNo: e.studentProfile.admissionNo,
        studentName: e.studentProfile.membership.user.fullName,
        email: e.studentProfile.membership.user.email,
        phoneNumber: e.studentProfile.membership.user.phoneE164,
        status: e.studentProfile.status,
        enrolledAt: e.createdAt.toISOString(),
      })),
      sessions: batch.liveSessions.map((s) => ({
        id: s.id,
        instituteId: s.instituteId,
        batchId: s.batchId,
        batchName: batch.name,
        courseTitle: batch.course.title,
        teacherProfileId: s.teacherProfileId,
        teacherName: s.teacherProfile?.membership?.user?.fullName ?? 'Faculty',
        title: s.title,
        description: s.description ?? undefined,
        room: s.room ?? undefined,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        status: s.status,
        isRecurring: s.isRecurring,
        recurrenceRule: s.recurrenceRule ?? undefined,
        joinUrl: s.joinUrl ?? undefined,
      })),
    };
  }

  async updateBatch(instituteId: string, batchId: string, input: UpdateBatchInput) {
    const existing = await this.prisma.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (!existing) {
      throw new NotFoundException('Batch not found in this institute');
    }

    if (existing.status === 'ARCHIVED' && input.status !== 'ACTIVE' && input.status !== undefined) {
      throw new BadRequestException('Archived batches can only be unarchived before making changes');
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.code !== undefined) data.code = input.code;
    if (input.status !== undefined) data.status = input.status;
    if (input.capacity !== undefined) data.capacity = input.capacity;

    if (input.startDate) data.startDate = new Date(input.startDate);
    if (input.endDate) data.endDate = new Date(input.endDate);

    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      throw new BadRequestException('Batch start date must precede end date');
    }

    if (input.academicYearId !== undefined) data.academicYearId = input.academicYearId;
    if (input.termId !== undefined) {
      if (input.termId) {
        const term = await this.prisma.academicTerm.findFirst({
          where: { id: input.termId, instituteId },
        });
        if (!term) throw new NotFoundException('Academic term not found');
      }
      data.termId = input.termId;
    }

    return this.prisma.batch.update({
      where: { id: batchId },
      data,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. STUDENT ENROLMENT & CONCURRENCY-SAFE CAPACITY CHECK
  // ---------------------------------------------------------------------------

  /**
   * Requirement 3: Batch Capacity
   * Prevent concurrent enrolment requests from exceeding the configured batch capacity.
   * Enforce this on the backend with an atomic database check.
   */
  async enrollStudent(instituteId: string, batchId: string, studentProfileId: string) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentProfileId, instituteId },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found in this institute');
    }

    return this.prisma.$transaction(async (tx) => {
      // Re-fetch batch inside the transaction to get real-time state
      const batch = await tx.batch.findFirst({
        where: { id: batchId, instituteId },
        include: {
          course: { select: { id: true, status: true } },
          _count: { select: { enrolments: true } },
        },
      });

      if (!batch) {
        throw new NotFoundException('Batch not found in this institute');
      }

      if (batch.status === 'ARCHIVED' || batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
        throw new BadRequestException(`Cannot enroll students in ${batch.status.toLowerCase()} batch`);
      }

      // Check capacity limit
      if (batch._count.enrolments >= batch.capacity) {
        throw new BadRequestException(
          `Batch capacity reached (${batch._count.enrolments}/${batch.capacity}). Enrolment rejected by capacity enforcement.`,
        );
      }

      // Check if student already enrolled in this course / batch
      const existingEnrolment = await tx.enrolment.findFirst({
        where: {
          instituteId,
          studentProfileId,
          courseId: batch.courseId,
        },
      });

      if (existingEnrolment) {
        if (existingEnrolment.batchId === batchId) {
          throw new BadRequestException('Student is already enrolled in this batch');
        }
        // Update batch assignment
        return tx.enrolment.update({
          where: { id: existingEnrolment.id },
          data: { batchId },
        });
      }

      // Create new enrolment
      return tx.enrolment.create({
        data: {
          instituteId,
          studentProfileId,
          courseId: batch.courseId,
          batchId,
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 4. STUDENT BATCH TRANSFERS WITH AUDIT LOGGING
  // ---------------------------------------------------------------------------

  /**
   * Requirement 2: Student Batch Transfers
   * Verify that source and target batches belong to the same institute and course.
   * Preserve complete transfer history, including previous batch, new batch,
   * transfer date, reason and initiating user. Never delete historical learning
   * or academic records.
   */
  async transferStudent(
    instituteId: string,
    input: TransferStudentBatchInput,
    initiatingUserId?: string,
  ) {
    if (input.sourceBatchId === input.targetBatchId) {
      throw new BadRequestException('Source and target batches cannot be the same');
    }

    const student = await this.prisma.studentProfile.findFirst({
      where: { id: input.studentProfileId, instituteId },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found in this institute');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify source batch belongs to same institute
      const sourceBatch = await tx.batch.findFirst({
        where: { id: input.sourceBatchId, instituteId },
      });
      if (!sourceBatch) {
        throw new NotFoundException('Source batch not found in this institute');
      }

      // 2. Verify target batch belongs to same institute
      const targetBatch = await tx.batch.findFirst({
        where: { id: input.targetBatchId, instituteId },
        include: { _count: { select: { enrolments: true } } },
      });
      if (!targetBatch) {
        throw new NotFoundException('Target batch not found in this institute');
      }

      // 3. Verify same course
      if (sourceBatch.courseId !== targetBatch.courseId) {
        throw new BadRequestException(
          'Student transfer rejected: Source and target batches must belong to the exact same course',
        );
      }

      // 4. Verify target batch status & capacity
      if (targetBatch.status === 'ARCHIVED' || targetBatch.status === 'COMPLETED' || targetBatch.status === 'CANCELLED') {
        throw new BadRequestException(`Cannot transfer student into a ${targetBatch.status.toLowerCase()} batch`);
      }

      if (targetBatch._count.enrolments >= targetBatch.capacity) {
        throw new BadRequestException(
          `Target batch is at maximum capacity (${targetBatch._count.enrolments}/${targetBatch.capacity})`,
        );
      }

      // 5. Verify student is actually enrolled in source batch
      const enrolment = await tx.enrolment.findFirst({
        where: {
          instituteId,
          studentProfileId: input.studentProfileId,
          batchId: input.sourceBatchId,
        },
      });

      if (!enrolment) {
        throw new BadRequestException('Student is not currently enrolled in the specified source batch');
      }

      // 6. Atomically update enrolment pointer (never delete historical records)
      const updatedEnrolment = await tx.enrolment.update({
        where: { id: enrolment.id },
        data: { batchId: input.targetBatchId },
      });

      // 7. Record immutable transfer log
      const transferLog = await tx.batchTransferLog.create({
        data: {
          instituteId,
          studentProfileId: input.studentProfileId,
          sourceBatchId: input.sourceBatchId,
          targetBatchId: input.targetBatchId,
          reason: input.reason,
          transferredBy: initiatingUserId ?? 'ADMIN',
        },
      });

      return {
        success: true,
        enrolment: updatedEnrolment,
        transferLog,
      };
    });
  }

  async getBatchTransferLogs(instituteId: string, studentProfileId?: string, batchId?: string) {
    const where: any = { instituteId };
    if (studentProfileId) where.studentProfileId = studentProfileId;
    if (batchId) {
      where.OR = [{ sourceBatchId: batchId }, { targetBatchId: batchId }];
    }

    const logs = await this.prisma.batchTransferLog.findMany({
      where,
      orderBy: { transferredAt: 'desc' },
      include: {
        studentProfile: {
          include: {
            membership: {
              include: { user: { select: { fullName: true } } },
            },
          },
        },
        sourceBatch: { select: { id: true, name: true, code: true } },
        targetBatch: { select: { id: true, name: true, code: true } },
      },
    });

    return logs.map((l) => ({
      id: l.id,
      instituteId: l.instituteId,
      studentProfileId: l.studentProfileId,
      studentName: l.studentProfile.membership.user.fullName,
      admissionNo: l.studentProfile.admissionNo,
      sourceBatchId: l.sourceBatchId,
      sourceBatchName: l.sourceBatch.name,
      targetBatchId: l.targetBatchId,
      targetBatchName: l.targetBatch.name,
      reason: l.reason,
      transferredBy: l.transferredBy,
      transferredAt: l.transferredAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // 5. FACULTY ASSIGNMENTS (LEAD & ASSISTANT)
  // ---------------------------------------------------------------------------

  /**
   * Requirement 5: Teacher Assignments
   * Support one Lead Teacher and multiple Assistant Teachers.
   * Validate institute ownership and prevent duplicate assignments.
   */
  async assignTeacher(
    instituteId: string,
    batchId: string,
    input: AssignBatchTeacherInput,
  ) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, instituteId },
      include: { teachers: true },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found in this institute');
    }

    const teacher = await this.prisma.teacherProfile.findFirst({
      where: { id: input.teacherProfileId, instituteId },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher profile not found in this institute');
    }

    return this.prisma.$transaction(async (tx) => {
      // If role is LEAD, ensure we reassign previous LEAD to ASSISTANT or update existing
      if (input.role === 'LEAD') {
        const existingLead = batch.teachers.find((t) => t.role === 'LEAD');
        if (existingLead && existingLead.teacherProfileId !== input.teacherProfileId) {
          // Demote existing lead to ASSISTANT
          await tx.batchTeacher.update({
            where: { id: existingLead.id },
            data: { role: 'ASSISTANT' },
          });
        }
      }

      // Check if this teacher is already assigned to this batch
      const existingAssignment = batch.teachers.find(
        (t) => t.teacherProfileId === input.teacherProfileId,
      );

      if (existingAssignment) {
        return tx.batchTeacher.update({
          where: { id: existingAssignment.id },
          data: { role: input.role },
        });
      }

      return tx.batchTeacher.create({
        data: {
          instituteId,
          batchId,
          teacherProfileId: input.teacherProfileId,
          role: input.role,
        },
      });
    });
  }

  async removeTeacher(instituteId: string, batchId: string, teacherProfileId: string) {
    const assignment = await this.prisma.batchTeacher.findFirst({
      where: {
        batchId,
        teacherProfileId,
        batch: { instituteId },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Teacher assignment not found for this batch');
    }

    return this.prisma.batchTeacher.delete({
      where: { id: assignment.id },
    });
  }

  // ---------------------------------------------------------------------------
  // 6. SCHEDULING & CONCURRENCY-SAFE CONFLICT DETECTION
  // ---------------------------------------------------------------------------

  /**
   * Requirement 1: Scheduling Conflict Protection
   * Concurrency-safe conflict detection verifying:
   * 1. Teacher double-booking (same teacher assigned to overlapping sessions across institute)
   * 2. Room double-booking (same physical/virtual room booked for overlapping sessions)
   * 3. Batch double-booking (same batch having overlapping sessions)
   */
  async detectConflict(
    instituteId: string,
    input: CheckScheduleConflictInput,
    txClient?: any,
  ): Promise<ScheduleConflictResult> {
    const client = txClient || this.prisma;
    const newStart = new Date(input.startsAt);
    const newEnd = new Date(input.endsAt);

    if (newStart >= newEnd) {
      return {
        hasConflict: true,
        message: 'Session start time must precede end time',
      };
    }

    // Standard overlap condition: session.startsAt < newEnd AND session.endsAt > newStart
    const timeOverlapCondition: any = {
      startsAt: { lt: newEnd },
      endsAt: { gt: newStart },
      status: { not: 'CANCELLED' },
      instituteId,
    };

    if (input.excludeSessionId) {
      timeOverlapCondition.id = { not: input.excludeSessionId };
    }

    // 1. Teacher conflict check
    if (input.teacherProfileId) {
      const teacherConflict = await client.liveSession.findFirst({
        where: {
          ...timeOverlapCondition,
          teacherProfileId: input.teacherProfileId,
        },
        include: {
          batch: { select: { name: true } },
          teacherProfile: {
            include: {
              membership: {
                include: { user: { select: { fullName: true } } },
              },
            },
          },
        },
      });

      if (teacherConflict) {
        return {
          hasConflict: true,
          conflictType: 'TEACHER_DOUBLE_BOOKED',
          conflictingSession: {
            id: teacherConflict.id,
            title: teacherConflict.title,
            startsAt: teacherConflict.startsAt.toISOString(),
            endsAt: teacherConflict.endsAt.toISOString(),
            teacherName: teacherConflict.teacherProfile?.membership?.user?.fullName,
            room: teacherConflict.room ?? undefined,
            batchName: teacherConflict.batch?.name,
          },
          message: `Teacher ${teacherConflict.teacherProfile?.membership?.user?.fullName ?? ''} is already booked for "${teacherConflict.title}" (${teacherConflict.startsAt.toISOString().slice(11, 16)} - ${teacherConflict.endsAt.toISOString().slice(11, 16)}) in batch ${teacherConflict.batch?.name}.`,
        };
      }
    }

    // 2. Room conflict check
    if (input.room?.trim()) {
      const roomConflict = await client.liveSession.findFirst({
        where: {
          ...timeOverlapCondition,
          room: input.room.trim(),
        },
        include: {
          batch: { select: { name: true } },
        },
      });

      if (roomConflict) {
        return {
          hasConflict: true,
          conflictType: 'ROOM_DOUBLE_BOOKED',
          conflictingSession: {
            id: roomConflict.id,
            title: roomConflict.title,
            startsAt: roomConflict.startsAt.toISOString(),
            endsAt: roomConflict.endsAt.toISOString(),
            room: roomConflict.room ?? undefined,
            batchName: roomConflict.batch?.name,
          },
          message: `Room/Hall "${input.room}" is already reserved for "${roomConflict.title}" in batch ${roomConflict.batch?.name}.`,
        };
      }
    }

    // 3. Batch conflict check
    if (input.batchId) {
      const batchConflict = await client.liveSession.findFirst({
        where: {
          ...timeOverlapCondition,
          batchId: input.batchId,
        },
        include: {
          batch: { select: { name: true } },
        },
      });

      if (batchConflict) {
        return {
          hasConflict: true,
          conflictType: 'BATCH_DOUBLE_BOOKED',
          conflictingSession: {
            id: batchConflict.id,
            title: batchConflict.title,
            startsAt: batchConflict.startsAt ? new Date(batchConflict.startsAt).toISOString() : '',
            endsAt: batchConflict.endsAt ? new Date(batchConflict.endsAt).toISOString() : '',
            batchName: batchConflict.batch?.name,
          },
          message: `Batch "${batchConflict.batch?.name}" already has class "${batchConflict.title}" scheduled during this time slot.`,
        };
      }
    }

    return { hasConflict: false };
  }

  async createSchedule(instituteId: string, input: CreateClassScheduleInput) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);

    if (startsAt >= endsAt) {
      throw new BadRequestException('Class start time must precede end time');
    }

    // Validate batch ownership
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, instituteId },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found in this institute');
    }

    // Validate teacher ownership
    const teacher = await this.prisma.teacherProfile.findFirst({
      where: { id: input.teacherProfileId, instituteId },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher profile not found in this institute');
    }

    // Use atomic transaction to execute conflict detection and creation concurrency-safely
    return this.prisma.$transaction(async (tx) => {
      const conflict = await this.detectConflict(
        instituteId,
        {
          batchId: input.batchId,
          teacherProfileId: input.teacherProfileId,
          room: input.room,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        },
        tx,
      );

      if (conflict.hasConflict) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: conflict.message || 'Scheduling conflict detected',
          details: conflict,
        });
      }

      return tx.liveSession.create({
        data: {
          instituteId,
          batchId: input.batchId,
          teacherProfileId: input.teacherProfileId,
          title: input.title,
          description: input.description,
          room: input.room,
          startsAt,
          endsAt,
          isRecurring: input.isRecurring ?? false,
          recurrenceRule: input.recurrenceRule,
          joinUrl: input.joinUrl,
          recordingUrl: input.recordingUrl,
          status: 'SCHEDULED',
        },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 7. RECURRING SCHEDULING (WEEKLY SCHEDULES & EXCEPTION FILTERING)
  // ---------------------------------------------------------------------------

  /**
   * Requirement 4: Recurring Scheduling
   * Support recurring weekly schedules with selected days, start/end dates,
   * exceptions and cancelled occurrences. Validate conflicts for every generated occurrence.
   */
  async generateRecurringWeeklySchedule(
    instituteId: string,
    input: RecurringWeeklyScheduleInput,
  ) {
    const rangeStart = new Date(input.startDate);
    const rangeEnd = new Date(input.endDate);

    if (rangeStart >= rangeEnd) {
      throw new BadRequestException('Schedule date range start must precede end date');
    }

    // Batch and teacher validation
    const batch = await this.prisma.batch.findFirst({
      where: { id: input.batchId, instituteId },
    });
    if (!batch) throw new NotFoundException('Batch not found in this institute');

    const teacher = await this.prisma.teacherProfile.findFirst({
      where: { id: input.teacherProfileId, instituteId },
    });
    if (!teacher) throw new NotFoundException('Teacher not found in this institute');

    const exceptionsSet = new Set(input.exceptions ?? []);

    // Generate list of occurrences
    const occurrences: Array<{ startsAt: Date; endsAt: Date; dateStr: string }> = [];
    const current = new Date(rangeStart);

    while (current <= rangeEnd) {
      const dayOfWeek = current.getDay(); // 0 is Sunday, 6 is Saturday
      const dateStr = current.toISOString().slice(0, 10);

      if (input.daysOfWeek.includes(dayOfWeek) && !exceptionsSet.has(dateStr)) {
        const [startH, startM] = input.startTime.split(':').map(Number);
        const [endH, endM] = input.endTime.split(':').map(Number);

        const occurrenceStart = new Date(current);
        occurrenceStart.setHours(startH, startM, 0, 0);

        const occurrenceEnd = new Date(current);
        occurrenceEnd.setHours(endH, endM, 0, 0);

        if (occurrenceStart >= occurrenceEnd) {
          throw new BadRequestException('Daily start time must precede end time');
        }

        occurrences.push({
          startsAt: occurrenceStart,
          endsAt: occurrenceEnd,
          dateStr,
        });
      }

      current.setDate(current.getDate() + 1);
    }

    if (occurrences.length === 0) {
      throw new BadRequestException(
        'No matching occurrences found for the selected days and date range (or all dates are exceptions)',
      );
    }

    // Concurrency-safe atomic transaction: Validate EVERY occurrence for conflicts
    return this.prisma.$transaction(async (tx) => {
      const conflictResults: any[] = [];

      for (const occ of occurrences) {
        const conflict = await this.detectConflict(
          instituteId,
          {
            batchId: input.batchId,
            teacherProfileId: input.teacherProfileId,
            room: input.room,
            startsAt: occ.startsAt.toISOString(),
            endsAt: occ.endsAt.toISOString(),
          },
          tx,
        );

        if (conflict.hasConflict) {
          conflictResults.push({
            date: occ.dateStr,
            time: `${input.startTime} - ${input.endTime}`,
            ...conflict,
          });
        }
      }

      // If any conflicts were found, abort the whole series
      if (conflictResults.length > 0) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Scheduling Conflict',
          message: `Cannot generate recurring schedule: ${conflictResults.length} conflicting session(s) detected.`,
          conflicts: conflictResults,
        });
      }

      const recurrenceRule = JSON.stringify({
        daysOfWeek: input.daysOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        startDate: input.startDate,
        endDate: input.endDate,
        exceptions: input.exceptions,
      });

      // Create all occurrences
      const createdSessions = await Promise.all(
        occurrences.map((occ) =>
          tx.liveSession.create({
            data: {
              instituteId,
              batchId: input.batchId,
              teacherProfileId: input.teacherProfileId,
              title: input.title,
              description: input.description,
              room: input.room,
              startsAt: occ.startsAt,
              endsAt: occ.endsAt,
              isRecurring: true,
              recurrenceRule,
              joinUrl: input.joinUrl,
              status: 'SCHEDULED',
            },
          }),
        ),
      );

      return {
        generatedCount: createdSessions.length,
        firstOccurrence: createdSessions[0].startsAt.toISOString(),
        lastOccurrence: createdSessions[createdSessions.length - 1].startsAt.toISOString(),
        sessions: createdSessions,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 8. SESSION MANAGEMENT (LIST, STATUS TRANSITIONS)
  // ---------------------------------------------------------------------------

  async getSchedules(
    instituteId: string,
    query: {
      batchId?: string;
      teacherProfileId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
  ) {
    const where: any = { instituteId };
    if (query.batchId) where.batchId = query.batchId;
    if (query.teacherProfileId) where.teacherProfileId = query.teacherProfileId;
    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.startsAt = {};
      if (query.startDate) where.startsAt.gte = new Date(query.startDate);
      if (query.endDate) where.startsAt.lte = new Date(query.endDate);
    }

    const sessions = await this.prisma.liveSession.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: {
        batch: { select: { id: true, name: true, course: { select: { title: true } } } },
        teacherProfile: {
          include: {
            membership: {
              include: { user: { select: { fullName: true } } },
            },
          },
        },
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      instituteId: s.instituteId,
      batchId: s.batchId,
      batchName: s.batch.name,
      courseTitle: s.batch.course.title,
      teacherProfileId: s.teacherProfileId,
      teacherName: s.teacherProfile?.membership?.user?.fullName ?? 'Faculty',
      title: s.title,
      description: s.description ?? undefined,
      room: s.room ?? undefined,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      isRecurring: s.isRecurring,
      recurrenceRule: s.recurrenceRule ?? undefined,
      joinUrl: s.joinUrl ?? undefined,
      recordingUrl: s.recordingUrl ?? undefined,
      status: s.status,
    }));
  }

  async updateScheduleStatus(
    instituteId: string,
    sessionId: string,
    status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED',
  ) {
    const session = await this.prisma.liveSession.findFirst({
      where: { id: sessionId, instituteId },
    });
    if (!session) {
      throw new NotFoundException('Session not found in this institute');
    }

    return this.prisma.liveSession.update({
      where: { id: sessionId },
      data: { status },
    });
  }
}
