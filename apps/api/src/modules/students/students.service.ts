import {
  Injectable,
  Optional,
  NotFoundException,
  ConflictException,
  BadRequestException,
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
}
