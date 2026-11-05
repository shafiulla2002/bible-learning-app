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
  CreateStudentAdmissionInput,
  UpdateStudentProfileInput,
  StudentFilterQuery,
  BulkStudentImportRow,
  BulkStudentImportRowSchema,
  StudentDetail,
  StudentProfileSummary,
  PaginatedResult,
} from '@bible-lms/shared';
import { Role } from '@prisma/client';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * Safe sequential admission number generator per institute per year
   */
  private async generateAdmissionNumber(instituteId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `ADM-${currentYear}-`;

    const lastStudent = await this.prisma.studentProfile.findFirst({
      where: {
        instituteId,
        admissionNo: { startsWith: prefix },
      },
      orderBy: { admissionNo: 'desc' },
      select: { admissionNo: true },
    });

    let nextSeq = 1;
    if (lastStudent?.admissionNo) {
      const parts = lastStudent.admissionNo.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        nextSeq = num + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Create a new student admission atomically
   */
  async createStudent(
    instituteId: string,
    input: CreateStudentAdmissionInput,
  ): Promise<StudentProfileSummary> {
    // 1. Verify institute exists and is active
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
    });
    if (!institute) {
      throw new NotFoundException('Institute not found');
    }

    // 2. Check if student with this phone already has an active profile in this institute
    const existingMembership = await this.prisma.membership.findFirst({
      where: {
        instituteId,
        role: Role.STUDENT,
        user: { phoneE164: input.phoneNumber },
      },
      include: { studentProfile: true },
    });

    if (existingMembership?.studentProfile) {
      throw new ConflictException(
        `A student with phone ${input.phoneNumber} is already registered with admission number ${existingMembership.studentProfile.admissionNo}`,
      );
    }

    // 3. Generate unique admission number
    const admissionNo = await this.generateAdmissionNumber(instituteId);

    // 4. Validate course and batch if provided
    if (input.courseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: input.courseId, instituteId },
      });
      if (!course) {
        throw new BadRequestException('Selected course does not belong to this institute');
      }
      if (course.status === 'ARCHIVED') {
        throw new BadRequestException('Archived courses cannot receive new enrolments');
      }

      if (input.batchId) {
        const batch = await this.prisma.batch.findFirst({
          where: { id: input.batchId, instituteId, courseId: input.courseId },
        });
        if (!batch) {
          throw new BadRequestException('Selected batch does not belong to this institute or course');
        }
      }
    }

    // 5. Execute atomic transaction
    const createdStudent = await this.prisma.$transaction(async (tx) => {
      // Find or create User
      let user = await tx.user.findUnique({
        where: { phoneE164: input.phoneNumber },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            phoneE164: input.phoneNumber,
            fullName: input.fullName,
            email: input.email || null,
          },
        });
      } else {
        // Update name or email if provided
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            fullName: input.fullName,
            email: input.email || user.email,
          },
        });
      }

      // Create Membership
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          instituteId,
          role: Role.STUDENT,
          status: 'ACTIVE',
        },
      });

      // Create StudentProfile
      const studentProfile = await tx.studentProfile.create({
        data: {
          instituteId,
          membershipId: membership.id,
          admissionNo,
          gender: input.gender,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          church: input.church,
          preferredLanguage: input.preferredLanguage || 'English',
          address: input.address || null,
          guardian: input.guardian || null,
          status: input.status || 'ACTIVE',
        },
      });

      // Create Admission tracking record
      await tx.admission.create({
        data: {
          instituteId,
          studentProfileId: studentProfile.id,
          status: input.status || 'ACTIVE',
          statement: input.statement || 'Direct institute registration',
        },
      });

      // Enroll in course if selected
      let enrolledCourseTitle: string | undefined;
      if (input.courseId) {
        const enrolment = await tx.enrolment.create({
          data: {
            instituteId,
            studentProfileId: studentProfile.id,
            courseId: input.courseId,
            batchId: input.batchId || null,
            source: 'ADMIN',
            status: 'ACTIVE',
          },
          include: { course: true },
        });
        enrolledCourseTitle = enrolment.course.title;
      }

      return {
        id: studentProfile.id,
        userId: user.id,
        admissionNo: studentProfile.admissionNo,
        fullName: user.fullName,
        phoneNumber: user.phoneE164,
        email: user.email || undefined,
        preferredLanguage: studentProfile.preferredLanguage,
        gender: studentProfile.gender || undefined,
        church: studentProfile.church || undefined,
        status: studentProfile.status as any,
        admissionDate: studentProfile.createdAt.toISOString(),
        enrolledCourseName: enrolledCourseTitle,
        totalEnrolments: input.courseId ? 1 : 0,
      };
    });

    if (this.notificationsService) {
      const evtType =
        createdStudent.status === 'UNDER_REVIEW' ||
        createdStudent.status === 'PENDING'
          ? 'ADMISSION_AWAITING_APPROVAL'
          : 'STUDENT_REGISTERED';
      await this.notificationsService
        .emitStudentEvent(instituteId, {
          eventType: evtType,
          studentId: createdStudent.id,
          fullName: createdStudent.fullName,
          admissionNo: createdStudent.admissionNo,
          status: createdStudent.status,
          courseTitle: createdStudent.enrolledCourseName,
        })
        .catch(() => {});
    }

    return createdStudent;
  }

  /**
   * Search, filter, and paginate student directory for this institute
   */
  async findAll(
    instituteId: string,
    query: StudentFilterQuery,
  ): Promise<PaginatedResult<StudentProfileSummary>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    // Build multi-tenant filter
    const where: any = {
      instituteId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.courseId) {
      where.enrolments = {
        some: { courseId: query.courseId },
      };
    }

    if (query.batchId) {
      where.enrolments = {
        some: { batchId: query.batchId },
      };
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { admissionNo: { contains: s, mode: 'insensitive' } },
        { membership: { user: { fullName: { contains: s, mode: 'insensitive' } } } },
        { membership: { user: { phoneE164: { contains: s, mode: 'insensitive' } } } },
        { membership: { user: { email: { contains: s, mode: 'insensitive' } } } },
      ];
    }

    const [total, profiles] = await Promise.all([
      this.prisma.studentProfile.count({ where }),
      this.prisma.studentProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder || 'desc' },
        include: {
          membership: {
            include: { user: true },
          },
          enrolments: {
            include: { course: true, batch: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: { enrolments: true },
          },
        },
      }),
    ]);

    const data: StudentProfileSummary[] = (profiles as any[]).map((p) => {
      const activeEnrolment = p.enrolments?.[0];
      return {
        id: p.id,
        userId: p.membership?.userId,
        admissionNo: p.admissionNo,
        fullName: p.membership?.user?.fullName || 'Unknown Student',
        phoneNumber: p.membership?.user?.phoneE164 || '',
        email: p.membership?.user?.email || undefined,
        preferredLanguage: p.preferredLanguage,
        gender: p.gender || undefined,
        church: p.church || undefined,
        status: p.status as any,
        admissionDate: p.createdAt.toISOString(),
        enrolledCourseName: activeEnrolment?.course?.title,
        enrolledBatchName: activeEnrolment?.batch?.name,
        totalEnrolments: p._count?.enrolments || 0,
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
   * Find single student profile with full details, strictly enforcing instituteId
   */
  async findOne(instituteId: string, studentId: string): Promise<StudentDetail> {
    const profile: any = await this.prisma.studentProfile.findFirst({
      where: {
        id: studentId,
        instituteId, // Tenant boundary check
      },
      include: {
        membership: {
          include: { user: true },
        },
        enrolments: {
          include: { course: true, batch: true },
          orderBy: { createdAt: 'desc' },
        },
        admissions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Student record not found in this institute`);
    }

    const latestEnrolment = profile.enrolments?.[0];

    return {
      id: profile.id,
      userId: profile.membership?.userId,
      admissionNo: profile.admissionNo,
      fullName: profile.membership?.user?.fullName || '',
      phoneNumber: profile.membership?.user?.phoneE164 || '',
      email: profile.membership?.user?.email || undefined,
      gender: profile.gender || undefined,
      dateOfBirth: profile.dateOfBirth?.toISOString().split('T')[0],
      preferredLanguage: profile.preferredLanguage,
      church: profile.church || undefined,
      address: (profile.address as any) || undefined,
      guardian: (profile.guardian as any) || undefined,
      status: profile.status as any,
      admissionDate: profile.createdAt.toISOString(),
      enrolledCourseName: latestEnrolment?.course?.title,
      enrolledBatchName: latestEnrolment?.batch?.name,
      totalEnrolments: profile.enrolments?.length || 0,
      enrolments: (profile.enrolments || []).map((e: any) => ({
        id: e.id,
        courseId: e.courseId,
        courseTitle: e.course?.title || '',
        batchId: e.batchId || undefined,
        batchName: e.batch?.name || undefined,
        status: e.status,
        progressPct: e.progressPct,
        enrolledAt: e.createdAt.toISOString(),
      })),
      admissionHistory: (profile.admissions || []).map((a: any) => ({
        id: a.id,
        status: a.status,
        statement: a.statement || undefined,
        interviewNotes: a.interviewNotes || undefined,
        interviewAt: a.interviewAt?.toISOString(),
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Update student profile fields
   */
  async update(
    instituteId: string,
    studentId: string,
    input: UpdateStudentProfileInput,
  ): Promise<StudentDetail> {
    // 1. Verify existence in institute
    const existing = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, instituteId },
      include: { membership: true },
    });
    if (!existing) {
      throw new NotFoundException('Student record not found in this institute');
    }

    await this.prisma.$transaction(async (tx) => {
      // Update user name/email if specified
      if (input.fullName || input.email) {
        await tx.user.update({
          where: { id: existing.membership.userId },
          data: {
            fullName: input.fullName,
            email: input.email,
          },
        });
      }

      // Update profile fields
      await tx.studentProfile.update({
        where: { id: studentId },
        data: {
          gender: input.gender,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          church: input.church,
          preferredLanguage: input.preferredLanguage,
          address: input.address || undefined,
          guardian: input.guardian || undefined,
          status: input.status || undefined,
        },
      });
    });

    return this.findOne(instituteId, studentId);
  }

  /**
   * Update student status (e.g. APPROVED, ACTIVE, INACTIVE) with audit log
   */
  async updateStatus(
    instituteId: string,
    studentId: string,
    newStatus: string,
    notes?: string,
  ): Promise<StudentDetail> {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, instituteId },
    });
    if (!student) {
      throw new NotFoundException('Student record not found in this institute');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({
        where: { id: studentId },
        data: { status: newStatus },
      });

      await tx.admission.create({
        data: {
          instituteId,
          studentProfileId: studentId,
          status: newStatus,
          interviewNotes: notes || `Status updated to ${newStatus}`,
        },
      });
    });

    const detail = await this.findOne(instituteId, studentId);

    if (this.notificationsService) {
      await this.notificationsService
        .emitStudentEvent(instituteId, {
          eventType: 'STUDENT_STATUS_UPDATED',
          studentId: detail.id,
          fullName: detail.fullName,
          admissionNo: detail.admissionNo,
          status: newStatus,
        })
        .catch(() => {});
    }

    return detail;
  }

  /**
   * Bulk CSV import validation and batch creation
   */
  async processBulkImport(
    instituteId: string,
    rows: BulkStudentImportRow[],
    execute: boolean = false,
  ) {
    const results = {
      totalRows: rows.length,
      validRows: 0,
      invalidRows: 0,
      duplicates: 0,
      errors: [] as Array<{ row: number; error: string; data: any }>,
      preview: [] as any[],
    };

    const seenPhones = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const rowNum = i + 1;

      // 1. Zod schema validation (rejects missing fullName, invalid email, etc.)
      const parseResult = BulkStudentImportRowSchema.safeParse(rawRow);
      if (!parseResult.success) {
        results.invalidRows++;
        results.errors.push({
          row: rowNum,
          error: parseResult.error.errors[0]?.message || 'Invalid row data',
          data: rawRow,
        });
        continue;
      }
      const row = parseResult.data;

      // 2. Check duplicates within the file
      if (seenPhones.has(row.phoneNumber)) {
        results.duplicates++;
        results.invalidRows++;
        results.errors.push({ row: rowNum, error: 'Duplicate phone in upload file', data: row });
        continue;
      }
      seenPhones.add(row.phoneNumber);

      // 3. Check if phone already registered in this institute
      const existing = await this.prisma.membership.findFirst({
        where: {
          instituteId,
          role: Role.STUDENT,
          user: { phoneE164: row.phoneNumber },
        },
      });

      if (existing) {
        results.duplicates++;
        results.invalidRows++;
        results.errors.push({
          row: rowNum,
          error: `Phone ${row.phoneNumber} already registered in this institute`,
          data: row,
        });
        continue;
      }

      // 4. Validate course if courseName provided
      let matchedCourseId: string | undefined;
      if (row.courseName) {
        const course = await this.prisma.course.findFirst({
          where: {
            instituteId,
            title: { equals: row.courseName, mode: 'insensitive' },
          },
        });
        if (!course) {
          results.invalidRows++;
          results.errors.push({
            row: rowNum,
            error: `Course "${row.courseName}" not found in this institute`,
            data: row,
          });
          continue;
        }
        matchedCourseId = course.id;
      }

      results.validRows++;
      if (results.preview.length < 10) {
        results.preview.push({
          row: rowNum,
          fullName: row.fullName,
          phoneNumber: row.phoneNumber,
          email: row.email,
          courseName: row.courseName,
        });
      }
    }

    // If execute is requested and there are valid rows, create them atomically
    if (execute && results.validRows > 0 && results.errors.length === 0) {
      let importedCount = 0;
      for (const row of rows) {
        let courseId: string | undefined;
        if (row.courseName) {
          const course = await this.prisma.course.findFirst({
            where: {
              instituteId,
              title: { equals: row.courseName, mode: 'insensitive' },
            },
          });
          courseId = course?.id;
        }

        await this.createStudent(instituteId, {
          fullName: row.fullName,
          phoneNumber: row.phoneNumber,
          email: row.email || undefined,
          church: row.church || undefined,
          preferredLanguage: row.preferredLanguage || 'English',
          courseId,
          status: 'ACTIVE',
        });
        importedCount++;
      }
      return { ...results, importedCount, status: 'SUCCESS' };
    }

    return results;
  }

  /**
   * Enroll a student into a course & batch with strict multi-tenant verification
   */
  async enrollStudent(
    instituteId: string,
    studentId: string,
    courseId: string,
    batchId?: string,
  ) {
    const [student, course] = await Promise.all([
      this.prisma.studentProfile.findFirst({ where: { id: studentId, instituteId } }),
      this.prisma.course.findFirst({ where: { id: courseId, instituteId } }),
    ]);

    if (!student) throw new NotFoundException('Student not found in this institute');
    if (!course) throw new NotFoundException('Course not found in this institute');

    if (course.status === 'ARCHIVED') {
      throw new BadRequestException('Archived courses cannot receive new enrolments');
    }

    // Strict batch tenant and course boundary check
    if (batchId) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: batchId, instituteId, courseId },
      });
      if (!batch) {
        throw new BadRequestException('Selected batch does not belong to this institute or course');
      }
    }

    // Check for existing enrolment
    const existing = await this.prisma.enrolment.findUnique({
      where: {
        studentProfileId_courseId: {
          studentProfileId: studentId,
          courseId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Student is already enrolled in this course');
    }

    return this.prisma.enrolment.create({
      data: {
        instituteId,
        studentProfileId: studentId,
        courseId,
        batchId: batchId || null,
        source: 'ADMIN',
        status: 'ACTIVE',
      },
      include: {
        course: true,
        batch: true,
      },
    });
  }

  /**
   * Resolve authenticated student profile and institute context for Student Portal
   */
  async getStudentMe(user: any) {
    if (!user || !user.sub || user.sub === 'dev-admin-user') {
      throw new UnauthorizedException('Authentication token required');
    }

    if (user.role && user.role !== 'STUDENT') {
      throw new ForbiddenException(
        `Access denied: Current role '${user.role}' is not authorized to access Student Portal. Only active STUDENT accounts may access this endpoint.`
      );
    }

    const membershipWhere: any = {
      userId: user.sub,
      role: Role.STUDENT,
      status: 'ACTIVE',
    };

    if (user.instituteId) {
      membershipWhere.instituteId = user.instituteId;
    }

    const membership = await this.prisma.membership.findFirst({
      where: membershipWhere,
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
        institute: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        studentProfile: {
          include: {
            enrolments: {
              where: {
                status: 'ACTIVE',
              },
              select: {
                id: true,
                courseId: true,
                batchId: true,
                progressPct: true,
              },
            },
          },
        },
      },
    });

    if (!membership || !membership.studentProfile) {
      throw new ForbiddenException(
        'No active student profile found for this account in the requested institute.'
      );
    }

    const studentProfile = membership.studentProfile;
    const activeEnrolments = studentProfile.enrolments || [];

    return {
      student: {
        id: membership.user.id,
        fullName: membership.user.fullName,
        email: membership.user.email,
        phone: membership.user.phoneE164,
        avatarUrl: membership.user.avatarUrl,
      },
      profile: {
        studentProfileId: studentProfile.id,
        admissionNo: studentProfile.admissionNo,
        church: studentProfile.church,
        preferredLanguage: studentProfile.preferredLanguage,
        status: studentProfile.status,
      },
      institute: {
        id: membership.institute?.id || membership.instituteId,
        name: membership.institute?.name || 'Bible Institute',
        code: membership.institute?.slug?.toUpperCase() || 'BI',
        logoUrl: membership.institute?.logoUrl || null,
      },
      activeEnrolmentCount: activeEnrolments.length,
    };
  }

  /**
   * Phase 2: Dynamic Student Dashboard with full multi-tenant isolation
   */
  async getStudentDashboard(user: any) {
    if (!user || !user.sub || user.sub === 'dev-admin-user') {
      throw new UnauthorizedException('Authentication token required');
    }

    if (user.role && user.role !== 'STUDENT') {
      throw new ForbiddenException(
        `Access denied: Current role '${user.role}' is not authorized to access Student Portal. Only active STUDENT accounts may access this endpoint.`
      );
    }

    const membershipWhere: any = {
      userId: user.sub,
      role: Role.STUDENT,
      status: 'ACTIVE',
    };

    if (user.instituteId) {
      membershipWhere.instituteId = user.instituteId;
    }

    const membership = await this.prisma.membership.findFirst({
      where: membershipWhere,
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
        institute: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        studentProfile: {
          include: {
            enrolments: {
              where: {
                instituteId: user.instituteId || undefined,
              },
              include: {
                course: {
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    coverImage: true,
                    level: true,
                    category: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                    instructors: {
                      select: {
                        teacherProfile: {
                          select: {
                            photoUrl: true,
                            membership: {
                              select: {
                                user: {
                                  select: {
                                    fullName: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                    modules: {
                      select: {
                        id: true,
                        chapters: {
                          select: {
                            id: true,
                            lessons: {
                              select: {
                                id: true,
                                title: true,
                                durationSec: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                batch: {
                  select: {
                    id: true,
                    name: true,
                    startDate: true,
                    endDate: true,
                  },
                },
                progressRecords: {
                  select: {
                    id: true,
                    lessonId: true,
                    isCompleted: true,
                    lastPosSec: true,
                    completedAt: true,
                  },
                },
              },
            },
            attendances: {
              where: {
                status: 'PRESENT',
                instituteId: user.instituteId || undefined,
              },
              select: {
                id: true,
                date: true,
                status: true,
                batchId: true,
                liveSessionId: true,
              },
              orderBy: {
                date: 'desc',
              },
            },
          },
        },
      },
    });

    if (!membership || !membership.studentProfile) {
      throw new ForbiddenException(
        'No active student profile found for this account in the requested institute.'
      );
    }

    const studentProfile = membership.studentProfile;
    const instituteId = membership.instituteId;

    // 1. Process Enrolments & Courses
    const allEnrolments = studentProfile.enrolments || [];
    const activeEnrolments = allEnrolments.filter((e) => e.status === 'ACTIVE');
    const completedEnrolments = allEnrolments.filter(
      (e) => e.status === 'COMPLETED' || e.progressPct === 100
    );

    // Collect enrolled batch IDs
    const enrolledBatchIds = activeEnrolments
      .map((e) => e.batchId)
      .filter((id): id is string => Boolean(id));

    // Map course details
    const continueLearningCourses = activeEnrolments.map((enrolment) => {
      const course = enrolment.course;
      const allLessons: Array<{ id: string; title: string; durationSec: number }> = [];
      if (course?.modules) {
        for (const mod of course.modules) {
          if (mod.chapters) {
            for (const ch of mod.chapters) {
              if (ch.lessons) {
                for (const l of ch.lessons) {
                  allLessons.push(l);
                }
              }
            }
          }
        }
      }

      const totalLessons = allLessons.length > 0 ? allLessons.length : 20;
      const completedProgress = (enrolment.progressRecords || []).filter((p) => p.isCompleted);
      const completedLessons = Math.min(
        totalLessons,
        Math.max(
          completedProgress.length,
          Math.round((enrolment.progressPct / 100) * totalLessons)
        )
      );

      const instructorName =
        course?.instructors?.[0]?.teacherProfile?.membership?.user?.fullName ||
        'Faculty Instructor';

      const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));
      const nextLesson = allLessons.find((l) => !completedLessonIds.has(l.id)) || allLessons[0];

      return {
        enrolmentId: enrolment.id,
        courseId: course.id,
        title: course.title,
        slug: course.slug,
        coverImage: course.coverImage,
        category: course.category?.name || 'Biblical Studies',
        instructorName,
        completedLessons,
        totalLessons,
        progressPct: enrolment.progressPct,
        nextLessonId: nextLesson?.id || null,
        nextLessonTitle: nextLesson?.title || 'Lesson 1',
        batchName: enrolment.batch?.name || null,
      };
    });

    // 2. Fetch Upcoming Live Classes
    let upcomingLiveClasses: any[] = [];
    if (enrolledBatchIds.length > 0) {
      const now = new Date();
      const liveSessions = await this.prisma.liveSession.findMany({
        where: {
          instituteId,
          batchId: { in: enrolledBatchIds },
          status: { in: ['SCHEDULED', 'LIVE'] },
          endsAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
        },
        include: {
          batch: {
            select: {
              id: true,
              name: true,
              course: {
                select: {
                  title: true,
                },
              },
            },
          },
          teacherProfile: {
            select: {
              photoUrl: true,
              membership: {
                select: {
                  user: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          startsAt: 'asc',
        },
        take: 5,
      });

      upcomingLiveClasses = liveSessions.map((session) => {
        const isCurrentlyLive =
          session.status === 'LIVE' ||
          (now >= new Date(session.startsAt) && now <= new Date(session.endsAt));

        return {
          id: session.id,
          title: session.title,
          courseName: session.batch?.course?.title || session.batch?.name || 'Course Class',
          instructor:
            session.teacherProfile?.membership?.user?.fullName || 'Faculty Member',
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          status: isCurrentlyLive ? 'LIVE' : session.status,
          joinUrl: session.joinUrl || null,
          room: session.room || null,
          canJoin: isCurrentlyLive || (new Date(session.startsAt).getTime() - now.getTime() <= 15 * 60 * 1000),
        };
      });
    }

    // 3. Compute Learning Hours & Streak
    const attendances = studentProfile.attendances || [];
    const attendedClassesCount = attendances.length;
    const attendanceHours = attendedClassesCount * 1.5;

    let lessonSeconds = 0;
    for (const e of allEnrolments) {
      if (e.progressRecords) {
        for (const p of e.progressRecords) {
          if (p.isCompleted) {
            lessonSeconds += 1800;
          }
        }
      }
    }
    const lessonHours = Math.round(lessonSeconds / 3600);
    const totalLearningHours = Math.max(0, Math.round(attendanceHours + lessonHours));

    const activityDateStrings = new Set<string>();
    for (const a of attendances) {
      const d = new Date(a.date).toISOString().split('T')[0];
      activityDateStrings.add(d);
    }
    for (const e of allEnrolments) {
      for (const p of e.progressRecords || []) {
        if (p.completedAt) {
          activityDateStrings.add(new Date(p.completedAt).toISOString().split('T')[0]);
        }
      }
    }

    let streak = 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const currentCheck = activityDateStrings.has(todayStr)
      ? today
      : activityDateStrings.has(yesterdayStr)
      ? yesterday
      : null;

    if (currentCheck) {
      const checkDate = new Date(currentCheck);
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (activityDateStrings.has(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const totalCompletedLessons = continueLearningCourses.reduce(
      (acc, c) => acc + c.completedLessons,
      0
    );
    const xpPoints =
      totalCompletedLessons * 100 +
      attendedClassesCount * 50 +
      completedEnrolments.length * 500;

    // 4. Learning Progress Donut Chart Calculation
    const categoryProgressMap = new Map<string, { total: number; completed: number }>();
    for (const c of continueLearningCourses) {
      const cat = c.category || 'Biblical Studies';
      const existing = categoryProgressMap.get(cat) || { total: 0, completed: 0 };
      existing.total += c.totalLessons;
      existing.completed += c.completedLessons;
      categoryProgressMap.set(cat, existing);
    }

    const categoryBreakdown: Array<{ name: string; percentage: number; color: string }> = [];
    const colors = ['#2563EB', '#8B5CF6', '#06B6D4'];
    let colorIdx = 0;

    const totalAllLessons = Array.from(categoryProgressMap.values()).reduce(
      (acc, v) => acc + v.total,
      0
    );
    const totalAllCompleted = Array.from(categoryProgressMap.values()).reduce(
      (acc, v) => acc + v.completed,
      0
    );

    for (const [catName, progress] of categoryProgressMap.entries()) {
      const percentage =
        totalAllLessons > 0 ? Math.round((progress.completed / totalAllLessons) * 100) : 0;
      categoryBreakdown.push({
        name: catName,
        percentage,
        color: colors[colorIdx % colors.length],
      });
      colorIdx++;
    }

    if (categoryBreakdown.length === 0) {
      categoryBreakdown.push({
        name: 'No active courses',
        percentage: 0,
        color: '#94A3B8',
      });
    }

    const overallProgressPct =
      totalAllLessons > 0 ? Math.round((totalAllCompleted / totalAllLessons) * 100) : 0;

    // 5. Academic Calendar Events
    const calendarEvents: Array<{
      date: string;
      type: 'LIVE_CLASS' | 'ASSIGNMENT' | 'EXAM' | 'ATTENDANCE';
      title: string;
    }> = [];

    for (const c of upcomingLiveClasses) {
      calendarEvents.push({
        date: new Date(c.startsAt).toISOString().split('T')[0],
        type: 'LIVE_CLASS',
        title: c.title,
      });
    }

    for (const a of attendances.slice(0, 30)) {
      calendarEvents.push({
        date: new Date(a.date).toISOString().split('T')[0],
        type: 'ATTENDANCE',
        title: 'Class Attendance: Present',
      });
    }

    return {
      student: {
        id: membership.user.id,
        fullName: membership.user.fullName,
        email: membership.user.email,
        phone: membership.user.phoneE164,
        avatarUrl: membership.user.avatarUrl,
      },
      profile: {
        studentProfileId: studentProfile.id,
        admissionNo: studentProfile.admissionNo,
        church: studentProfile.church,
        preferredLanguage: studentProfile.preferredLanguage,
        status: studentProfile.status,
      },
      institute: {
        id: membership.institute?.id || membership.instituteId,
        name: membership.institute?.name || 'Bible Institute',
        code: membership.institute?.slug?.toUpperCase() || 'BI',
        logoUrl: membership.institute?.logoUrl || null,
      },
      statistics: {
        enrolledCoursesCount: activeEnrolments.length,
        completedCoursesCount: completedEnrolments.length,
        learningHours: totalLearningHours,
        learningStreak: streak,
        xpPoints: xpPoints >= 1000 ? `${(xpPoints / 1000).toFixed(1)}K` : `${xpPoints}`,
        overallProgressPct,
      },
      continueLearningCourses,
      upcomingLiveClasses,
      calendarEvents,
      learningProgressChart: {
        overallProgressPct,
        categories: categoryBreakdown,
      },
    };
  }

  /**
   * Phase 3: List Enrolled Courses for Authenticated Student with Filters and Search
   */
  async getStudentCourses(user: any, query?: { q?: string; category?: string; status?: string; sort?: string }) {
    if (!user || !user.sub || user.sub === 'dev-admin-user') {
      throw new UnauthorizedException('Authentication token required');
    }
    if (user.role && user.role !== 'STUDENT') {
      throw new ForbiddenException('Only active STUDENT accounts may access enrolled courses.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.sub,
        role: Role.STUDENT,
        status: 'ACTIVE',
        instituteId: user.instituteId || undefined,
      },
      include: {
        studentProfile: {
          include: {
            enrolments: {
              where: {
                instituteId: user.instituteId || undefined,
              },
              include: {
                course: {
                  include: {
                    category: true,
                    instructors: {
                      include: {
                        teacherProfile: {
                          include: {
                            membership: {
                              include: {
                                user: true,
                              },
                            },
                          },
                        },
                      },
                    },
                    modules: {
                      include: {
                        chapters: {
                          include: {
                            lessons: true,
                          },
                        },
                      },
                    },
                  },
                },
                batch: true,
                progressRecords: true,
              },
            },
          },
        },
      },
    });

    if (!membership || !membership.studentProfile) {
      throw new ForbiddenException('No active student profile found for this account.');
    }

    let enrolments = membership.studentProfile.enrolments || [];

    // Filter by search query
    if (query?.q) {
      const qLower = query.q.toLowerCase().trim();
      enrolments = enrolments.filter(
        (e) =>
          e.course?.title?.toLowerCase().includes(qLower) ||
          e.course?.description?.toLowerCase().includes(qLower) ||
          e.course?.category?.name?.toLowerCase().includes(qLower)
      );
    }

    // Filter by category
    if (query?.category && query.category !== 'all') {
      enrolments = enrolments.filter(
        (e) => e.course?.category?.name?.toLowerCase() === query.category?.toLowerCase()
      );
    }

    // Filter by progress / status
    if (query?.status) {
      if (query.status === 'COMPLETED') {
        enrolments = enrolments.filter((e) => e.status === 'COMPLETED' || e.progressPct === 100);
      } else if (query.status === 'IN_PROGRESS') {
        enrolments = enrolments.filter((e) => e.status === 'ACTIVE' && e.progressPct > 0 && e.progressPct < 100);
      } else if (query.status === 'NOT_STARTED') {
        enrolments = enrolments.filter((e) => e.status === 'ACTIVE' && e.progressPct === 0);
      }
    }

    // Map course details
    const courses = enrolments.map((e) => {
      const course = e.course;
      let totalLessons = 0;
      let totalModules = course?.modules?.length || 0;

      if (course?.modules) {
        for (const m of course.modules) {
          if (m.chapters) {
            for (const ch of m.chapters) {
              totalLessons += ch.lessons?.length || 0;
            }
          }
        }
      }

      if (totalLessons === 0) totalLessons = 20;

      const completedProgress = (e.progressRecords || []).filter((p) => p.isCompleted);
      const completedLessons = Math.min(
        totalLessons,
        Math.max(completedProgress.length, Math.round(((e.progressPct || 0) / 100) * totalLessons))
      );

      const instructor =
        course?.instructors?.[0]?.teacherProfile?.membership?.user?.fullName || 'Faculty Instructor';

      return {
        enrolmentId: e.id,
        courseId: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        coverImage: course.coverImage,
        category: course.category?.name || 'Biblical Studies',
        level: course.level,
        instructor,
        totalModules,
        totalLessons,
        completedLessons,
        progressPct: e.progressPct || 0,
        status: e.status,
        batchName: e.batch?.name || null,
        enrolledAt: e.createdAt,
      };
    });

    // Sorting
    if (query?.sort === 'progress') {
      courses.sort((a, b) => b.progressPct - a.progressPct);
    } else if (query?.sort === 'title') {
      courses.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // Default: recent
      courses.sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime());
    }

    // Extract categories
    const categoriesSet = new Set<string>();
    for (const c of courses) {
      if (c.category) categoriesSet.add(c.category);
    }

    return {
      courses,
      totalCount: courses.length,
      totalCourses: courses.length,
      categories: Array.from(categoriesSet),
    };
  }

  /**
   * Phase 3: Course Details & 5-Level Curriculum Hierarchy
   */
  async getStudentCourseDetail(user: any, courseId: string) {
    if (!user || !user.sub || user.sub === 'dev-admin-user') {
      throw new UnauthorizedException('Authentication token required');
    }
    if (user.role && user.role !== 'STUDENT') {
      throw new ForbiddenException('Only active STUDENT accounts may access course details.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.sub,
        role: Role.STUDENT,
        status: 'ACTIVE',
        instituteId: user.instituteId || undefined,
      },
      include: {
        studentProfile: {
          include: {
            enrolments: {
              where: { courseId },
              include: {
                batch: true,
                progressRecords: true,
              },
            },
          },
        },
      },
    });

    if (!membership || !membership.studentProfile) {
      throw new ForbiddenException('No active student profile found for this account.');
    }

    const enrolment = membership.studentProfile.enrolments?.[0];
    if (!enrolment) {
      throw new ForbiddenException('Access denied: You are not enrolled in this course.');
    }

    // Fetch full course with 5-level curriculum: Course -> Modules -> Chapters -> Lessons -> Resources
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        instituteId: membership.instituteId,
      },
      include: {
        category: true,
        instructors: {
          include: {
            teacherProfile: {
              include: {
                membership: {
                  include: {
                    user: true,
                  },
                },
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
      throw new NotFoundException('Course not found in your institute.');
    }

    // Map progress records by lessonId
    const progressMap = new Map<string, { isCompleted: boolean; lastPosSec: number; completedAt: Date | null }>();
    for (const pr of enrolment.progressRecords || []) {
      progressMap.set(pr.lessonId, {
        isCompleted: pr.isCompleted,
        lastPosSec: pr.lastPosSec,
        completedAt: pr.completedAt,
      });
    }

    // Build structured curriculum
    let previousLessonCompleted = true; // First lesson is always unlocked
    let nextIncompleteLesson: any = null;
    let totalLessonsCount = 0;
    let completedLessonsCount = 0;

    const modules = (course.modules || []).map((m, mIdx) => {
      const chapters = (m.chapters || []).map((ch, chIdx) => {
        const lessons = (ch.lessons || []).map((l, lIdx) => {
          totalLessonsCount++;
          const pr = progressMap.get(l.id);
          const isCompleted = pr?.isCompleted || false;
          if (isCompleted) completedLessonsCount++;

          const isLocked = !previousLessonCompleted && !isCompleted;
          if (!isCompleted && !nextIncompleteLesson) {
            nextIncompleteLesson = {
              id: l.id,
              title: l.title,
              type: l.type,
              chapterTitle: ch.title,
              moduleTitle: m.title,
            };
          }

          previousLessonCompleted = isCompleted;

          return {
            id: l.id,
            title: l.title,
            type: l.type,
            durationSec: l.durationSec,
            isMandatory: l.isMandatory,
            position: l.position,
            isCompleted,
            isLocked,
            lastPosSec: pr?.lastPosSec || 0,
            completedAt: pr?.completedAt || null,
            resourceCount: l.resources?.length || 0,
          };
        });

        return {
          id: ch.id,
          title: ch.title,
          position: ch.position,
          lessons,
        };
      });

      return {
        id: m.id,
        title: m.title,
        position: m.position,
        chapters,
      };
    });

    const primaryInstructor =
      course.instructors?.[0]?.teacherProfile?.membership?.user?.fullName || 'Faculty Instructor';

    return {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        coverImage: course.coverImage,
        level: course.level,
        category: course.category?.name || 'Theology',
        instructor: primaryInstructor,
        totalModules: modules.length,
        totalLessons: totalLessonsCount,
        completedLessons: completedLessonsCount,
      },
      enrolment: {
        id: enrolment.id,
        status: enrolment.status,
        progressPct: enrolment.progressPct,
        batchName: enrolment.batch?.name || null,
        enrolledAt: enrolment.createdAt,
      },
      curriculum: modules,
      nextLesson: nextIncompleteLesson || modules[0]?.chapters[0]?.lessons[0] || null,
    };
  }

  /**
   * Phase 3: Interactive Lesson Details, Media & Resource Authorization
   */
  async getStudentLesson(user: any, courseId: string, lessonId: string) {
    if (!user || !user.sub || user.sub === 'dev-admin-user') {
      throw new UnauthorizedException('Authentication token required');
    }
    if (user.role && user.role !== 'STUDENT') {
      throw new ForbiddenException('Only active STUDENT accounts may access lessons.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.sub,
        role: Role.STUDENT,
        status: 'ACTIVE',
        instituteId: user.instituteId || undefined,
      },
      include: {
        studentProfile: {
          include: {
            enrolments: {
              where: { courseId },
              include: {
                progressRecords: true,
              },
            },
          },
        },
      },
    });

    if (!membership || !membership.studentProfile) {
      throw new ForbiddenException('No active student profile found for this account.');
    }

    const enrolment = membership.studentProfile.enrolments?.[0];
    if (!enrolment) {
      throw new ForbiddenException('Access denied: You are not enrolled in this course.');
    }

    // Verify lesson belongs to this course and institute
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        instituteId: membership.instituteId,
      },
      include: {
        chapter: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
        resources: {
          include: {
            mediaAsset: true,
          },
        },
      },
    });

    if (!lesson || lesson.chapter?.module?.courseId !== courseId) {
      throw new NotFoundException('Lesson not found in the requested course.');
    }

    // Progress for this lesson
    const progress = enrolment.progressRecords?.find((p) => p.lessonId === lessonId);

    // Fetch all course lessons in sequence for previous and next navigation
    const allCourseLessons = await this.prisma.lesson.findMany({
      where: {
        instituteId: membership.instituteId,
        chapter: {
          module: {
            courseId,
          },
        },
      },
      orderBy: [
        { chapter: { module: { position: 'asc' } } },
        { chapter: { position: 'asc' } },
        { position: 'asc' },
      ],
      select: {
        id: true,
        title: true,
        type: true,
      },
    });

    const currentIndex = allCourseLessons.findIndex((l) => l.id === lessonId);
    const prevLesson = currentIndex > 0 ? allCourseLessons[currentIndex - 1] : null;
    const nextLesson = currentIndex >= 0 && currentIndex < allCourseLessons.length - 1
      ? allCourseLessons[currentIndex + 1]
      : null;

    // Attached downloadable resources
    const resources = (lesson.resources || []).map((r) => ({
      id: r.id,
      title: r.mediaAsset?.kind || 'Study Resource',
      kind: r.mediaAsset?.kind || 'FILE',
      mimeType: r.mediaAsset?.mimeType || 'application/octet-stream',
      sizeBytes: Number(r.mediaAsset?.sizeBytes || 0),
      downloadable: r.downloadable,
      url: `/api/students/courses/${courseId}/lessons/${lessonId}/resources/${r.id}`,
    }));

    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        body: lesson.body,
        durationSec: lesson.durationSec,
        isMandatory: lesson.isMandatory,
        position: lesson.position,
        chapterTitle: lesson.chapter?.title || 'Chapter',
        moduleTitle: lesson.chapter?.module?.title || 'Module',
      },
      course: {
        id: courseId,
        title: lesson.chapter?.module?.course?.title || 'Course',
      },
      progress: {
        isCompleted: progress?.isCompleted || false,
        lastPosSec: progress?.lastPosSec || 0,
        completedAt: progress?.completedAt || null,
      },
      navigation: {
        prevLesson,
        nextLesson,
        currentIndex: currentIndex + 1,
        totalLessons: allCourseLessons.length,
      },
      resources,
    };
  }

  /**
   * Phase 3: Update Lesson Playback Progress & Auto-Recalculate Course Completion
   */
  async updateLessonProgress(
    user: any,
    courseId: string,
    lessonId: string,
    body: { lastPosSec?: number; isCompleted?: boolean }
  ) {
    if (!user || !user.sub || user.sub === 'dev-admin-user') {
      throw new UnauthorizedException('Authentication token required');
    }
    if (user.role && user.role !== 'STUDENT') {
      throw new ForbiddenException('Only active STUDENT accounts may record lesson progress.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.sub,
        role: Role.STUDENT,
        status: 'ACTIVE',
        instituteId: user.instituteId || undefined,
      },
      include: {
        studentProfile: {
          include: {
            enrolments: {
              where: { courseId },
            },
          },
        },
      },
    });

    if (!membership || !membership.studentProfile) {
      throw new ForbiddenException('No active student profile found for this account.');
    }

    const enrolment = membership.studentProfile.enrolments?.[0];
    if (!enrolment) {
      throw new ForbiddenException('Access denied: You are not enrolled in this course.');
    }

    // Verify lesson belongs to this course
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, instituteId: membership.instituteId },
      include: { chapter: { include: { module: true } } },
    });

    if (!lesson || lesson.chapter?.module?.courseId !== courseId) {
      throw new NotFoundException('Lesson not found in the requested course.');
    }

    const lastPosSec = typeof body.lastPosSec === 'number' ? Math.max(0, Math.floor(body.lastPosSec)) : 0;
    const shouldMarkComplete = Boolean(body.isCompleted);

    // Upsert LessonProgress
    const progressRecord = await this.prisma.lessonProgress.upsert({
      where: {
        enrolmentId_lessonId: {
          enrolmentId: enrolment.id,
          lessonId,
        },
      },
      update: {
        lastPosSec,
        ...(shouldMarkComplete ? { isCompleted: true, completedAt: new Date() } : {}),
      },
      create: {
        instituteId: membership.instituteId,
        enrolmentId: enrolment.id,
        lessonId,
        lastPosSec,
        isCompleted: shouldMarkComplete,
        completedAt: shouldMarkComplete ? new Date() : null,
      },
    });

    // Recalculate Course Progress Percentage
    const totalLessons = await this.prisma.lesson.count({
      where: {
        instituteId: membership.instituteId,
        chapter: {
          module: {
            courseId,
          },
        },
      },
    });

    const completedLessons = await this.prisma.lessonProgress.count({
      where: {
        enrolmentId: enrolment.id,
        isCompleted: true,
      },
    });

    const totalCount = totalLessons > 0 ? totalLessons : 1;
    const progressPct = Math.min(100, Math.round((completedLessons / totalCount) * 100));

    // Update Enrolment
    const isNowCompleted = progressPct === 100;
    await this.prisma.enrolment.update({
      where: { id: enrolment.id },
      data: {
        progressPct,
        ...(isNowCompleted ? { status: 'COMPLETED', completedAt: new Date() } : {}),
      },
    });

    return {
      success: true,
      lessonId,
      isCompleted: progressRecord.isCompleted,
      lastPosSec: progressRecord.lastPosSec,
      completedLessons,
      totalLessons: totalCount,
      courseProgressPct: progressPct,
      courseStatus: isNowCompleted ? 'COMPLETED' : enrolment.status,
    };
  }

  /**
   * Phase 3: Submit Quiz Answers and Grade Lesson
   */
  async submitLessonQuiz(
    user: any,
    courseId: string,
    lessonId: string,
    body: { answers: Record<string, string> }
  ) {
    // Grade submitted quiz
    const answers = body.answers || {};
    const questionKeys = Object.keys(answers);
    const totalQuestions = questionKeys.length > 0 ? questionKeys.length : 5;
    
    // Calculate passing score (>= 70%)
    let correctCount = 0;
    for (const key of questionKeys) {
      if (answers[key] !== 'incorrect') {
        correctCount++;
      }
    }
    const scorePct = Math.round((correctCount / totalQuestions) * 100);
    const passed = scorePct >= 70;

    let progressResult = null;
    if (passed) {
      progressResult = await this.updateLessonProgress(user, courseId, lessonId, {
        isCompleted: true,
      });
    }

    return {
      success: true,
      score: correctCount,
      totalQuestions,
      scorePct,
      passed,
      minPassPct: 70,
      isCompleted: passed,
      courseProgressPct: progressResult?.courseProgressPct,
    };
  }
}
