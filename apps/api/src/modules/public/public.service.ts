import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  PublicCourseCatalogQuery,
  PublicStudentRegisterInput,
  PublicSubmitApplicationInput,
  PublicCreateOrderInput,
  VerifyRazorpayPaymentInput,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_PORTAL_MAP,
} from '@bible-lms/shared';
import {
  CourseStatus,
  EnrolmentSource,
  EnrolmentStatus,
  InstituteStatus,
  MembershipStatus,
  OrderStatus,
  PaymentStatus,
  Role,
} from '@prisma/client';
import {
  createRazorpayRemoteOrder,
  resolveRazorpayConfig,
  verifyRazorpayPaymentSignature,
} from '../../common/razorpay-crypto.util';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private normalizePhone(rawPhone: string): string {
    return (rawPhone || '').trim().replace(/[\s()-]/g, '');
  }

  private async resolveActiveInstitute(instituteId?: string, instituteSlug?: string) {
    if (!instituteId && !instituteSlug) {
      // Fallback only if exactly one active institute exists, or default active first institute for single-tenant public domain
      const count = await this.prisma.institute.count({
        where: { status: InstituteStatus.ACTIVE, deletedAt: null },
      });
      if (count === 0) throw new NotFoundException('No active institute found');
      const first = await this.prisma.institute.findFirst({
        where: { status: InstituteStatus.ACTIVE, deletedAt: null },
        include: { settings: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!first) throw new NotFoundException('Institute not found');
      return first;
    }

    const inst = await this.prisma.institute.findFirst({
      where: {
        status: InstituteStatus.ACTIVE,
        deletedAt: null,
        ...(instituteId ? { id: instituteId } : { slug: instituteSlug }),
      },
      include: { settings: true },
    });
    if (!inst) {
      throw new NotFoundException('Active institute not found');
    }
    return inst;
  }

  private async generateAdmissionNo(instituteId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ADM-${year}-`;
    const last = await this.prisma.studentProfile.findFirst({
      where: { instituteId, admissionNo: { startsWith: prefix } },
      orderBy: { admissionNo: 'desc' },
      select: { admissionNo: true },
    });
    let seq = 1;
    if (last?.admissionNo) {
      const n = parseInt(last.admissionNo.split('-').pop() || '', 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async generateApplicationNumber(instituteId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;
    if (process.env.PRISMA_MIGRATIONS_APPLIED !== 'true') {
      const count = await this.prisma.admission.count({ where: { instituteId } });
      return `${prefix}${String(count + 1).padStart(4, '0')}`;
    }
    const last = await this.prisma.admission.findFirst({
      where: { instituteId, applicationNumber: { startsWith: prefix } },
      orderBy: { applicationNumber: 'desc' },
      select: { applicationNumber: true },
    });
    let seq = 1;
    if (last?.applicationNumber) {
      const n = parseInt(last.applicationNumber.split('-').pop() || '', 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  async listInstitutes() {
    const institutes = await this.prisma.institute.findMany({
      where: { status: InstituteStatus.ACTIVE, deletedAt: null },
      include: {
        settings: { select: { branding: true, studentSelfRegistration: true } },
        _count: {
          select: {
            courses: { where: { status: CourseStatus.PUBLISHED, deletedAt: null } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return institutes.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      logoUrl: i.logoUrl || undefined,
      timezone: i.timezone,
      currency: i.currency,
      branding: i.settings?.branding || null,
      studentSelfRegistration: i.settings?.studentSelfRegistration ?? true,
      publishedCoursesCount: i._count.courses,
    }));
  }

  async listPublishedCourses(query: PublicCourseCatalogQuery) {
    const page = query.page || 1;
    const limit = query.limit || 24;
    const skip = (page - 1) * limit;

    const where: any = {
      status: CourseStatus.PUBLISHED,
      deletedAt: null,
      institute: {
        status: InstituteStatus.ACTIVE,
        deletedAt: null,
        ...(query.instituteSlug ? { slug: query.instituteSlug } : {}),
        ...(query.instituteId ? { id: query.instituteId } : {}),
      },
    };

    if (query.level) where.level = query.level;
    if (query.courseType && query.courseType !== 'ALL') where.courseType = query.courseType;
    if (query.pricing) where.pricing = query.pricing;
    if (query.category) {
      where.category = {
        OR: [{ id: query.category }, { slug: query.category }],
      };
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { eligibility: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, courses] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          institute: { select: { id: true, name: true, slug: true, logoUrl: true } },
          category: { select: { id: true, name: true, slug: true } },
          instructors: {
            select: {
              role: true,
              teacherProfile: {
                select: {
                  membership: {
                    select: { user: { select: { fullName: true } } },
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
                  _count: { select: { lessons: true } },
                },
              },
            },
          },
          _count: { select: { enrolments: true } },
        },
      }),
    ]);

    const data = courses.map((c: any) => {
      let lessonCount = 0;
      for (const m of c.modules || []) {
        for (const ch of m.chapters || []) {
          lessonCount += ch._count?.lessons || 0;
        }
      }
      const totalDurationSec = lessonCount * 900;
      const lead =
        c.instructors?.find((i: any) => i.role === 'LEAD') || c.instructors?.[0];

      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        coverImage: c.coverImage || undefined,
        level: c.level,
        courseType: c.courseType,
        learningMode: c.learningMode,
        author: c.author || undefined,
        pdfPageCount: c.pdfPageCount || undefined,
        pdfFileSize: c.pdfFileSize || undefined,
        publicationInfo: c.publicationInfo || undefined,
        hasPdf: Boolean(c.pdfStorageKey),
        durationLabel: c.durationLabel || undefined,
        eligibility: c.eligibility || undefined,
        language: c.language,
        pricing: c.pricing,
        price: c.price,
        salePrice: c.salePrice || undefined,
        registrationFee: c.registrationFee ?? 0,
        requiresApproval: c.requiresApproval ?? true,
        institute: c.institute,
        category: c.category,
        leadInstructorName: lead?.teacherProfile?.membership?.user?.fullName || undefined,
        moduleCount: c.modules?.length || 0,
        lessonCount,
        durationHours: Math.max(1, Math.round(totalDurationSec / 3600)),
        enrolledCount: c._count?.enrolments || 0,
      };
    });

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

  async getPublishedCourseDetail(idOrSlug: string, instituteSlug?: string) {
    const course: any = await this.prisma.course.findFirst({
      where: {
        status: CourseStatus.PUBLISHED,
        deletedAt: null,
        institute: {
          status: InstituteStatus.ACTIVE,
          deletedAt: null,
          ...(instituteSlug ? { slug: instituteSlug } : {}),
        },
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        institute: { select: { id: true, name: true, slug: true, logoUrl: true } },
        category: { select: { id: true, name: true, slug: true } },
        instructors: {
          include: {
            teacherProfile: {
              select: {
                id: true,
                qualifications: true,
                specialization: true,
                bio: true,
                photoUrl: true,
                membership: { include: { user: { select: { fullName: true } } } },
              },
            },
          },
        },
        batches: {
          where: { status: { in: ['UPCOMING', 'ACTIVE'] } },
          select: { id: true, name: true, code: true, status: true, startDate: true, endDate: true, capacity: true },
        },
        modules: {
          orderBy: { position: 'asc' },
          include: {
            chapters: {
              orderBy: { position: 'asc' },
              include: {
                lessons: {
                  orderBy: { position: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    durationSec: true,
                    isPreview: true,
                    position: true,
                  },
                },
              },
            },
          },
        },
        _count: { select: { enrolments: true } },
      },
    });

    if (!course) {
      throw new NotFoundException('Published course not found');
    }

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      coverImage: course.coverImage || undefined,
      level: course.level,
      courseType: course.courseType,
      learningMode: course.learningMode,
      author: course.author || undefined,
      pdfPageCount: course.pdfPageCount || undefined,
      pdfFileSize: course.pdfFileSize || undefined,
      publicationInfo: course.publicationInfo || undefined,
      hasPdf: Boolean(course.pdfStorageKey),
      durationLabel: course.durationLabel || undefined,
      eligibility: course.eligibility || undefined,
      language: course.language,
      pricing: course.pricing,
      price: course.price,
      salePrice: course.salePrice || undefined,
      registrationFee: course.registrationFee ?? 0,
      requiresApproval: course.requiresApproval ?? true,
      enrollmentStartsAt: course.enrollmentStartsAt?.toISOString() || undefined,
      enrollmentEndsAt: course.enrollmentEndsAt?.toISOString() || undefined,
      institute: course.institute,
      category: course.category,
      instructors: (course.instructors || []).map((ins: any) => ({
        teacherProfileId: ins.teacherProfileId,
        role: ins.role,
        fullName: ins.teacherProfile?.membership?.user?.fullName || 'Instructor',
        qualifications: ins.teacherProfile?.qualifications || undefined,
        specialization: ins.teacherProfile?.specialization || undefined,
        bio: ins.teacherProfile?.bio || undefined,
        photoUrl: ins.teacherProfile?.photoUrl || undefined,
      })),
      batches: course.batches || [],
      modules: course.modules || [],
      enrolledCount: course._count?.enrolments || 0,
    };
  }

  async validateCoupon(params: {
    code: string;
    instituteId?: string;
    instituteSlug?: string;
    subtotalPaise?: number;
  }) {
    const inst = await this.resolveActiveInstitute(params.instituteId, params.instituteSlug);
    const coupon = await this.prisma.coupon.findUnique({
      where: {
        instituteId_code: {
          instituteId: inst.id,
          code: params.code.trim().toUpperCase(),
        },
      },
    });
    if (!coupon || !coupon.active) {
      throw new BadRequestException('Invalid or inactive coupon code');
    }
    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException('Coupon is not yet active');
    }
    if (coupon.endsAt && now > coupon.endsAt) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit has been reached');
    }
    const subtotal = Math.max(0, Number(params.subtotalPaise) || 0);

    const isPercent = typeof coupon.discountPct === 'number' && coupon.discountPct > 0;
    const discountPaise = isPercent
      ? Math.min(subtotal, Math.round((subtotal * (coupon.discountPct || 0)) / 100))
      : Math.min(subtotal, coupon.discountAmt || 0);

    return {
      valid: true,
      code: coupon.code,
      type: isPercent ? ('PERCENT' as const) : ('FLAT' as const),
      value: isPercent ? (coupon.discountPct || 0) : (coupon.discountAmt || 0),
      discountPaise,
      finalAmountPaise: Math.max(0, subtotal - discountPaise),
    };
  }

  async registerStudent(input: PublicStudentRegisterInput) {
    const inst = await this.resolveActiveInstitute(input.instituteId, input.instituteSlug);
    if (inst.settings && inst.settings.studentSelfRegistration === false) {
      throw new ForbiddenException('Self-registration is disabled for this institute. Please contact admissions.');
    }

    const phone = this.normalizePhone(input.phoneNumber);
    const emailClean = input.email?.trim() || null;

    const existingMembership = await this.prisma.membership.findFirst({
      where: {
        instituteId: inst.id,
        role: Role.STUDENT,
        user: { phoneE164: phone },
      },
      include: { studentProfile: true },
    });
    if (existingMembership?.studentProfile) {
      throw new ConflictException('A student account already exists for this phone number in this institute');
    }

    if (emailClean) {
      const emailOwner = await this.prisma.user.findUnique({ where: { email: emailClean } });
      if (emailOwner && emailOwner.phoneE164 !== phone) {
        throw new ConflictException('This email address is already registered with a different phone number');
      }
    }

    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
    const admissionNo = await this.generateAdmissionNo(inst.id);

    const created = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { phoneE164: phone } });
      if (!user) {
        user = await tx.user.create({
          data: {
            phoneE164: phone,
            fullName: input.fullName.trim(),
            email: emailClean,
            passwordHash: passwordHash || null,
            status: 'ACTIVE',
          },
        });
      } else if (passwordHash && !user.passwordHash) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });
      }

      const membership = await tx.membership.upsert({
        where: {
          userId_instituteId_role: {
            userId: user.id,
            instituteId: inst.id,
            role: Role.STUDENT,
          },
        },
        update: { status: MembershipStatus.ACTIVE },
        create: {
          userId: user.id,
          instituteId: inst.id,
          role: Role.STUDENT,
          status: MembershipStatus.ACTIVE,
        },
      });

      const studentProfile = await tx.studentProfile.create({
        data: {
          instituteId: inst.id,
          membershipId: membership.id,
          admissionNo,
          preferredLanguage: input.preferredLanguage || 'English',
          church: input.church || null,
          gender: input.gender || null,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          status: 'APPLICANT',
        },
      });

      return { user, membership, studentProfile };
    });

    const permissions = DEFAULT_ROLE_PERMISSIONS.STUDENT;
    const accessToken = this.jwtService.sign({
      sub: created.user.id,
      phone: created.user.phoneE164,
      role: 'STUDENT',
      instituteId: inst.id,
      permissions,
    });

    return {
      accessToken,
      redirectUrl: ROLE_PORTAL_MAP.STUDENT,
      user: {
        id: created.user.id,
        fullName: created.user.fullName,
        phone: created.user.phoneE164,
        email: created.user.email,
        role: 'STUDENT',
        instituteId: inst.id,
        instituteName: inst.name,
        studentProfileId: created.studentProfile.id,
        admissionNo: created.studentProfile.admissionNo,
      },
    };
  }

  async submitApplication(input: PublicSubmitApplicationInput) {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        status: CourseStatus.PUBLISHED,
        deletedAt: null,
        institute: { status: InstituteStatus.ACTIVE, deletedAt: null },
      },
      include: { institute: true },
    });
    if (!course) {
      throw new NotFoundException('Selected published course not found');
    }

    const instituteId = course.instituteId;
    if (input.batchId) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: input.batchId, instituteId, courseId: course.id },
      });
      if (!batch) {
        throw new BadRequestException('Selected batch does not belong to this course');
      }
    }

    const phone = this.normalizePhone(input.phoneNumber);
    const emailClean = input.email?.trim() || null;
    const applicationNumber = await this.generateApplicationNumber(instituteId);
    const admissionNo = await this.generateAdmissionNo(instituteId);

    const outcome = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { phoneE164: phone } });
      if (!user) {
        user = await tx.user.create({
          data: {
            phoneE164: phone,
            fullName: input.fullName.trim(),
            email: emailClean,
            status: 'ACTIVE',
          },
        });
      }

      const membership = await tx.membership.upsert({
        where: {
          userId_instituteId_role: {
            userId: user.id,
            instituteId,
            role: Role.STUDENT,
          },
        },
        update: {},
        create: {
          userId: user.id,
          instituteId,
          role: Role.STUDENT,
          status: MembershipStatus.ACTIVE,
        },
      });

      let profile = await tx.studentProfile.findUnique({
        where: { membershipId: membership.id },
      });
      if (!profile) {
        profile = await tx.studentProfile.create({
          data: {
            instituteId,
            membershipId: membership.id,
            admissionNo,
            gender: input.gender || null,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            church: input.church || null,
            preferredLanguage: input.preferredLanguage || 'English',
            status: 'APPLIED',
          },
        });
      }

      // Prevent duplicate active enrolment or pending application for same course
      const existingEnrolment = await tx.enrolment.findUnique({
        where: {
          studentProfileId_courseId: {
            studentProfileId: profile.id,
            courseId: course.id,
          },
        },
      });
      if (existingEnrolment && existingEnrolment.status === EnrolmentStatus.ACTIVE) {
        throw new ConflictException('You are already enrolled in this course');
      }

      const migrationsApplied = process.env.PRISMA_MIGRATIONS_APPLIED === 'true';
      if (migrationsApplied) {
        const duplicateAdmission = await tx.admission.findFirst({
          where: {
            instituteId,
            studentProfileId: profile.id,
            courseId: course.id,
            status: { in: ['APPLIED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'ACCEPTED'] },
          },
        });
        if (duplicateAdmission) {
          throw new ConflictException(
            `An active admission application (${duplicateAdmission.applicationNumber || duplicateAdmission.id}) already exists for this course`,
          );
        }
      }

      // Direct auto-enrolment only for FREE courses with requiresApproval=false
      const autoAccept = course.pricing === 'FREE' && course.requiresApproval === false;

      let approvedEnrolmentId: string | null = null;
      if (autoAccept) {
        const enrolment = await tx.enrolment.create({
          data: {
            instituteId,
            studentProfileId: profile.id,
            courseId: course.id,
            batchId: input.batchId || null,
            source: EnrolmentSource.FREE,
            status: EnrolmentStatus.ACTIVE,
          },
        });
        approvedEnrolmentId = enrolment.id;
        await tx.studentProfile.update({
          where: { id: profile.id },
          data: { status: 'ACTIVE' },
        });
      }

      const admission = await tx.admission.create({
        data: {
          instituteId,
          studentProfileId: profile.id,
          status: autoAccept ? 'ACCEPTED' : 'APPLIED',
          statement: input.statement || null,
          ...(migrationsApplied
            ? {
                applicationNumber,
                courseId: course.id,
                batchId: input.batchId || null,
                documents: input.documents || [],
                applicantDetails: {
                  ...(input.applicantDetails || {}),
                  educationLevel: input.educationLevel || null,
                },
                approvedEnrolmentId,
              }
            : {}),
        },
      });

      return { admission, profile, autoAccept };
    });

    return {
      applicationId: outcome.admission.id,
      applicationNumber: outcome.admission.applicationNumber || applicationNumber,
      admissionNo: outcome.profile.admissionNo,
      status: outcome.admission.status,
      autoEnrolled: outcome.autoAccept,
      courseTitle: course.title,
      instituteName: course.institute.name,
      paymentRequired: course.pricing === 'PAID',
      totalFeePaise:
        course.pricing === 'PAID'
          ? (course.salePrice ?? course.price) + (course.registrationFee ?? 0)
          : 0,
    };
  }

  async trackApplicationStatus(applicationNumber: string, phoneNumber: string) {
    const cleanPhone = this.normalizePhone(phoneNumber);
    const cleanAppNo = (applicationNumber || '').trim().toUpperCase();
    if (!cleanAppNo || !cleanPhone) {
      throw new BadRequestException('Both application number and registered phone number are required');
    }

    const admission: any = await this.prisma.admission.findFirst({
      where: {
        applicationNumber: cleanAppNo,
        studentProfile: {
          membership: { user: { phoneE164: cleanPhone } },
        },
      },
      include: {
        course: { select: { title: true, slug: true, pricing: true, price: true, registrationFee: true } },
        batch: { select: { name: true, startDate: true } },
        studentProfile: {
          select: {
            admissionNo: true,
            membership: {
              select: {
                institute: { select: { name: true, slug: true } },
                user: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });

    if (!admission) {
      throw new NotFoundException('No matching application found for those credentials');
    }

    return {
      applicationNumber: admission.applicationNumber,
      status: admission.status,
      submittedAt: admission.createdAt.toISOString(),
      reviewedAt: admission.reviewedAt?.toISOString() || undefined,
      interviewAt: admission.interviewAt?.toISOString() || undefined,
      rejectionReason: admission.status === 'REJECTED' ? admission.rejectionReason : undefined,
      applicantName: admission.studentProfile?.membership?.user?.fullName || 'Applicant',
      admissionNo: admission.studentProfile?.admissionNo,
      institute: admission.studentProfile?.membership?.institute || null,
      course: admission.course || null,
      batch: admission.batch || null,
    };
  }

  async createOrder(input: PublicCreateOrderInput, authenticatedUserId?: string) {
    const courses = await this.prisma.course.findMany({
      where: {
        id: { in: input.courseIds },
        status: CourseStatus.PUBLISHED,
        deletedAt: null,
        institute: { status: InstituteStatus.ACTIVE, deletedAt: null },
      },
      include: {
        institute: { include: { settings: true } },
      },
    });

    if (courses.length === 0 || courses.length !== input.courseIds.length) {
      throw new NotFoundException('One or more selected courses were not found or not published');
    }

    const instituteIds = new Set(courses.map((c) => c.instituteId));
    if (instituteIds.size > 1) {
      throw new BadRequestException('All courses in a single checkout order must belong to the same institute');
    }

    const institute = courses[0].institute;
    const instituteId = institute.id;

    // Resolve or provision StudentProfile cleanly
    let studentProfile: any = null;
    if (authenticatedUserId) {
      studentProfile = await this.prisma.studentProfile.findFirst({
        where: { instituteId, membership: { userId: authenticatedUserId } },
      });
    }
    if (!studentProfile) {
      if (!input.phoneNumber || !input.fullName) {
        throw new BadRequestException('Applicant phone number and full name are required for checkout');
      }
      const phone = this.normalizePhone(input.phoneNumber);
      const admNo = await this.generateAdmissionNo(instituteId);
      studentProfile = await this.prisma.$transaction(async (tx) => {
        let user = await tx.user.findUnique({ where: { phoneE164: phone } });
        if (!user) {
          user = await tx.user.create({
            data: {
              phoneE164: phone,
              fullName: input.fullName!.trim(),
              email: input.email?.trim() || null,
              status: 'ACTIVE',
            },
          });
        }
        const membership = await tx.membership.upsert({
          where: {
            userId_instituteId_role: {
              userId: user.id,
              instituteId,
              role: Role.STUDENT,
            },
          },
          update: {},
          create: {
            userId: user.id,
            instituteId,
            role: Role.STUDENT,
            status: MembershipStatus.ACTIVE,
          },
        });
        const existingProfile = await tx.studentProfile.findUnique({
          where: { membershipId: membership.id },
        });
        if (existingProfile) return existingProfile;
        return tx.studentProfile.create({
          data: {
            instituteId,
            membershipId: membership.id,
            admissionNo: admNo,
            status: 'APPLIED',
          },
        });
      });
    }

    const subtotal = courses.reduce((sum, c) => {
      const unitPrice = c.pricing === 'PAID' ? (c.salePrice ?? c.price) + (c.registrationFee ?? 0) : 0;
      return sum + unitPrice;
    }, 0);

    let discount = 0;
    let couponRecord: any = null;
    if (input.couponCode?.trim()) {
      const validated = await this.validateCoupon({
        code: input.couponCode,
        instituteId,
        subtotalPaise: subtotal,
      });
      discount = validated.discountPaise;
      couponRecord = await this.prisma.coupon.findUnique({
        where: { instituteId_code: { instituteId, code: validated.code } },
      });
    }

    const total = Math.max(0, subtotal - discount);
    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const migrationsApplied = process.env.PRISMA_MIGRATIONS_APPLIED === 'true';
    const rzpConfig = resolveRazorpayConfig(institute.settings?.razorpayKeyEncrypted);
    const rzpConfigured =
      rzpConfig.mode !== 'UNCONFIGURED' && Boolean(rzpConfig.keyId && rzpConfig.keySecret);

    // Direct checkout when total === 0 or when Razorpay credentials are not configured (demo/sandbox checkout)
    if (total === 0 || !rzpConfigured) {
      const orderId = crypto.randomUUID();
      const receiptId = crypto.randomUUID();
      const receiptNumber = `REC-${Date.now()}`;
      const now = new Date();

      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "Order" ("id", "instituteId", "studentProfileId", "orderNumber", "subtotal", "discount", "total", "status", "createdAt", "updatedAt")
          VALUES (${orderId}, ${instituteId}, ${studentProfile.id}, ${orderNumber}, ${subtotal}, ${discount}, ${total}, 'PAID'::"OrderStatus", ${now}, ${now})
        `;

        for (const c of courses) {
          const itemId = crypto.randomUUID();
          const itemPrice = c.pricing === 'PAID' ? (c.salePrice ?? c.price) : 0;
          await tx.$executeRaw`
            INSERT INTO "OrderItem" ("id", "instituteId", "orderId", "courseId", "titleSnapshot", "price")
            VALUES (${itemId}, ${instituteId}, ${orderId}, ${c.id}, ${c.title}, ${itemPrice})
          `;
        }

        await tx.$executeRaw`
          INSERT INTO "Receipt" ("id", "instituteId", "orderId", "receiptNumber", "issuedAt")
          VALUES (${receiptId}, ${instituteId}, ${orderId}, ${receiptNumber}, ${now})
        `;

        if (total > 0) {
          const paymentId = crypto.randomUUID();
          const mockProviderPaymentId = `mock_pay_${Date.now()}`;
          await tx.$executeRaw`
            INSERT INTO "Payment" ("id", "instituteId", "orderId", "amount", "providerPaymentId", "status", "method", "createdAt", "updatedAt")
            VALUES (${paymentId}, ${instituteId}, ${orderId}, ${total}, ${mockProviderPaymentId}, 'CAPTURED'::"PaymentStatus", 'MOCK_GATEWAY', ${now}, ${now})
          `;
        }

        if (couponRecord) {
          await tx.coupon.update({
            where: { id: couponRecord.id },
            data: { usedCount: { increment: 1 } },
          });
          await tx.couponRedemption.create({
            data: { couponId: couponRecord.id, orderId },
          });
        }

        const enrolmentSource =
          total > 0
            ? EnrolmentSource.PURCHASE
            : discount > 0
              ? EnrolmentSource.SCHOLARSHIP
              : EnrolmentSource.FREE;

        for (const c of courses) {
          await tx.enrolment.upsert({
            where: {
              studentProfileId_courseId: {
                studentProfileId: studentProfile.id,
                courseId: c.id,
              },
            },
            update: {
              source: enrolmentSource,
              status: EnrolmentStatus.ACTIVE,
            },
            create: {
              instituteId,
              studentProfileId: studentProfile.id,
              courseId: c.id,
              source: enrolmentSource,
              status: EnrolmentStatus.ACTIVE,
            },
          });
        }
      });

      const studentUserRecord = await this.prisma.user.findFirst({
        where: { memberships: { some: { studentProfile: { id: studentProfile.id } } } },
        select: { id: true, fullName: true, phoneE164: true, email: true },
      });

      let studentAccessToken: string | undefined;
      if (studentUserRecord) {
        studentAccessToken = this.jwtService.sign(
          {
            sub: studentUserRecord.id,
            phone: studentUserRecord.phoneE164,
            role: Role.STUDENT,
            instituteId,
            permissions: DEFAULT_ROLE_PERMISSIONS[Role.STUDENT] || [],
          },
          { expiresIn: '30d' },
        );
      }

      return {
        orderId,
        orderNumber,
        receiptNumber,
        amountPaise: total,
        currency: institute.currency || 'INR',
        status: OrderStatus.PAID,
        paymentRequired: false,
        gatewayMode: !rzpConfigured && total > 0 ? 'MOCK' : 'FREE',
        mockPayment: !rzpConfigured && total > 0,
        mockPaymentMessage:
          !rzpConfigured && total > 0
            ? 'Razorpay keys are not added yet — Mock Payment completed. No amount will be debited from your account.'
            : undefined,
        accessToken: studentAccessToken,
        student: studentUserRecord
          ? {
              id: studentUserRecord.id,
              studentId: studentProfile.admissionNo || studentUserRecord.id.slice(0, 8).toUpperCase(),
              fullName: studentUserRecord.fullName,
              email: studentUserRecord.email || '',
              phone: studentUserRecord.phoneE164,
              role: 'Student',
              status: studentProfile.status || 'ACTIVE',
            }
          : undefined,
      };
    }

    const rzpOrder = await createRazorpayRemoteOrder({
      keyId: rzpConfig.keyId!,
      keySecret: rzpConfig.keySecret!,
      amountPaise: total,
      currency: institute.currency || 'INR',
      receipt: orderNumber,
      notes: {
        instituteId,
        studentProfileId: studentProfile.id,
        admissionId: input.admissionId || '',
      },
    });

    const createdOrderId = crypto.randomUUID();
    const createdPaymentId = crypto.randomUUID();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "Order" ("id", "instituteId", "studentProfileId", "orderNumber", "subtotal", "discount", "total", "status", "providerOrderId", "createdAt", "updatedAt")
        VALUES (${createdOrderId}, ${instituteId}, ${studentProfile.id}, ${orderNumber}, ${subtotal}, ${discount}, ${total}, 'AWAITING_PAYMENT'::"OrderStatus", ${rzpOrder.id}, ${now}, ${now})
      `;

      for (const c of courses) {
        const itemId = crypto.randomUUID();
        const itemPrice = c.pricing === 'PAID' ? (c.salePrice ?? c.price) : 0;
        await tx.$executeRaw`
          INSERT INTO "OrderItem" ("id", "instituteId", "orderId", "courseId", "titleSnapshot", "price")
          VALUES (${itemId}, ${instituteId}, ${createdOrderId}, ${c.id}, ${c.title}, ${itemPrice})
        `;
      }

      await tx.$executeRaw`
        INSERT INTO "Payment" ("id", "instituteId", "orderId", "amount", "status", "createdAt", "updatedAt")
        VALUES (${createdPaymentId}, ${instituteId}, ${createdOrderId}, ${total}, 'CREATED'::"PaymentStatus", ${now}, ${now})
      `;
    });

    return {
      orderId: createdOrderId,
      orderNumber,
      providerOrderId: rzpOrder.id,
      razorpayKeyId: rzpConfig.keyId,
      gatewayMode: rzpConfig.mode,
      amountPaise: total,
      currency: institute.currency || 'INR',
      status: OrderStatus.AWAITING_PAYMENT,
      paymentRequired: true,
    };
  }

  async verifyOrderPayment(input: VerifyRazorpayPaymentInput) {
    const order = await this.prisma.order.findFirst({
      where: { providerOrderId: input.razorpayOrderId },
      select: {
        id: true,
        instituteId: true,
        studentProfileId: true,
        orderNumber: true,
        total: true,
        status: true,
        items: { select: { id: true, courseId: true } },
        institute: { select: { id: true, settings: { select: { razorpayKeyEncrypted: true } } } },
        payments: { select: { id: true, status: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Order matching Razorpay order ID not found');
    }

    const rzpConfig = resolveRazorpayConfig(order.institute.settings?.razorpayKeyEncrypted);
    if (!rzpConfig.keySecret) {
      throw new ServiceUnavailableException('Razorpay verification secret is not configured');
    }

    const signatureOk = verifyRazorpayPaymentSignature({
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
      keySecret: rzpConfig.keySecret,
    });

    if (!signatureOk) {
      throw new ForbiddenException('Invalid Razorpay payment signature');
    }

    if (order.status === OrderStatus.PAID) {
      const existingReceipt = await this.prisma.receipt.findUnique({
        where: { orderId: order.id },
        select: { receiptNumber: true },
      });
      return {
        verified: true,
        alreadyProcessed: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        receiptNumber: existingReceipt?.receiptNumber,
        status: order.status,
      };
    }

    const receiptNumber = `REC-${Date.now()}`;
    const receiptId = crypto.randomUUID();
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "Order"
        SET "status" = 'PAID'::"OrderStatus", "updatedAt" = ${now}
        WHERE "id" = ${order.id}
      `;

      const pendingPayment = order.payments?.[0];
      if (pendingPayment) {
        const payMethod = input.method || 'RAZORPAY';
        await tx.$executeRaw`
          UPDATE "Payment"
          SET "providerPaymentId" = ${input.razorpayPaymentId},
              "status" = 'CAPTURED'::"PaymentStatus",
              "method" = ${payMethod},
              "updatedAt" = ${now}
          WHERE "id" = ${pendingPayment.id}
        `;
      } else {
        const newPayId = crypto.randomUUID();
        const payMethod = input.method || 'RAZORPAY';
        await tx.$executeRaw`
          INSERT INTO "Payment" ("id", "instituteId", "orderId", "amount", "providerPaymentId", "status", "method", "createdAt", "updatedAt")
          VALUES (${newPayId}, ${order.instituteId}, ${order.id}, ${order.total}, ${input.razorpayPaymentId}, 'CAPTURED'::"PaymentStatus", ${payMethod}, ${now}, ${now})
        `;
      }

      await tx.$executeRaw`
        INSERT INTO "Receipt" ("id", "instituteId", "orderId", "receiptNumber", "issuedAt")
        VALUES (${receiptId}, ${order.instituteId}, ${order.id}, ${receiptNumber}, ${now})
        ON CONFLICT ("orderId") DO NOTHING
      `;

      for (const item of order.items) {
        await tx.enrolment.upsert({
          where: {
            studentProfileId_courseId: {
              studentProfileId: order.studentProfileId,
              courseId: item.courseId,
            },
          },
          update: {
            source: EnrolmentSource.PURCHASE,
            status: EnrolmentStatus.ACTIVE,
          },
          create: {
            instituteId: order.instituteId,
            studentProfileId: order.studentProfileId,
            courseId: item.courseId,
            source: EnrolmentSource.PURCHASE,
            status: EnrolmentStatus.ACTIVE,
          },
        });
      }
    });

    return {
      verified: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      receiptNumber,
      status: 'PAID',
    };
  }

  async verifyCertificate(token: string) {
    const cert = await this.prisma.certificate.findFirst({
      where: { OR: [{ verifyToken: token }, { certificateNo: token }] },
    });
    if (!cert) {
      throw new NotFoundException('Certificate record not found');
    }

    const enrolment = await this.prisma.enrolment.findUnique({
      where: { id: cert.enrolmentId },
      include: {
        course: { select: { title: true, level: true } },
        studentProfile: {
          include: {
            membership: {
              include: {
                user: { select: { fullName: true } },
                institute: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    });

    return {
      valid: !cert.revokedAt,
      certificateNo: cert.certificateNo,
      issuedAt: cert.issuedAt.toISOString(),
      revokedAt: cert.revokedAt?.toISOString() || undefined,
      studentName: enrolment?.studentProfile?.membership?.user?.fullName || 'Graduate',
      courseTitle: enrolment?.course?.title || 'Program',
      instituteName: enrolment?.studentProfile?.membership?.institute?.name || 'Bible Institute',
    };
  }
}
