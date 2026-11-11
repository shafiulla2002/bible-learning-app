import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ReviewAdmissionInput,
  ApproveAdmissionInput,
  RejectAdmissionInput,
} from '@bible-lms/shared';
import { EnrolmentSource, EnrolmentStatus, FinancialSequenceType, MembershipStatus } from '@prisma/client';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async listAdmissions(
    instituteId: string,
    query: { status?: string; courseId?: string; search?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { instituteId };
    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }
    if (query.courseId) {
      where.courseId = query.courseId;
    }
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { applicationNumber: { contains: s, mode: 'insensitive' } },
        {
          studentProfile: {
            admissionNo: { contains: s, mode: 'insensitive' },
          },
        },
        {
          studentProfile: {
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
        },
      ];
    }

    const [total, records, groupedCounts] = await Promise.all([
      this.prisma.admission.count({ where }),
      this.prisma.admission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          course: {
            select: { id: true, title: true, slug: true, price: true, registrationFee: true, pricing: true },
          },
          batch: {
            select: { id: true, name: true, code: true },
          },
          studentProfile: {
            include: {
              membership: {
                include: {
                  user: { select: { id: true, fullName: true, phoneE164: true, email: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.admission.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: { _all: true },
      }),
    ]);

    const statusSummary: Record<string, number> = {
      APPLIED: 0,
      UNDER_REVIEW: 0,
      INTERVIEW_SCHEDULED: 0,
      ACCEPTED: 0,
      REJECTED: 0,
    };
    for (const g of groupedCounts) {
      statusSummary[g.status] = g._count._all;
    }

    const data = records.map((a: any) => ({
      id: a.id,
      applicationNumber: a.applicationNumber || `APP-${a.id.slice(0, 8).toUpperCase()}`,
      status: a.status,
      statement: a.statement || undefined,
      interviewAt: a.interviewAt ? a.interviewAt.toISOString() : undefined,
      interviewNotes: a.interviewNotes || undefined,
      rejectionReason: a.rejectionReason || undefined,
      reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : undefined,
      approvedEnrolmentId: a.approvedEnrolmentId || undefined,
      createdAt: a.createdAt.toISOString(),
      course: a.course || null,
      batch: a.batch || null,
      studentProfile: {
        id: a.studentProfile.id,
        admissionNo: a.studentProfile.admissionNo,
        status: a.studentProfile.status,
        church: a.studentProfile.church || undefined,
        preferredLanguage: a.studentProfile.preferredLanguage,
        fullName: a.studentProfile.membership?.user?.fullName || 'Applicant',
        phoneNumber: a.studentProfile.membership?.user?.phoneE164 || '',
        email: a.studentProfile.membership?.user?.email || undefined,
      },
      documents: Array.isArray(a.documents) ? a.documents : [],
      applicantDetails: a.applicantDetails || null,
    }));

    return {
      data,
      summary: statusSummary,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getAdmission(instituteId: string, admissionId: string) {
    const admission: any = await this.prisma.admission.findFirst({
      where: { id: admissionId, instituteId },
      include: {
        course: { select: { id: true, title: true, slug: true, price: true, registrationFee: true, pricing: true } },
        batch: { select: { id: true, name: true, code: true, capacity: true } },
        studentProfile: {
          include: {
            membership: {
              include: {
                user: { select: { id: true, fullName: true, phoneE164: true, email: true, avatarUrl: true } },
              },
            },
            enrolments: {
              where: { instituteId },
              include: { course: { select: { id: true, title: true } } },
            },
          },
        },
      },
    });
    if (!admission) {
      throw new NotFoundException('Admission application not found in this institute');
    }

    return {
      id: admission.id,
      instituteId: admission.instituteId,
      applicationNumber: admission.applicationNumber || `APP-${admission.id.slice(0, 8).toUpperCase()}`,
      status: admission.status,
      statement: admission.statement || undefined,
      documents: Array.isArray(admission.documents) ? admission.documents : [],
      applicantDetails: admission.applicantDetails || null,
      interviewAt: admission.interviewAt ? admission.interviewAt.toISOString() : undefined,
      interviewNotes: admission.interviewNotes || undefined,
      rejectionReason: admission.rejectionReason || undefined,
      reviewedByUserId: admission.reviewedByUserId || undefined,
      reviewedAt: admission.reviewedAt ? admission.reviewedAt.toISOString() : undefined,
      approvedEnrolmentId: admission.approvedEnrolmentId || undefined,
      createdAt: admission.createdAt.toISOString(),
      updatedAt: admission.updatedAt.toISOString(),
      course: admission.course || null,
      batch: admission.batch || null,
      student: {
        id: admission.studentProfile.id,
        admissionNo: admission.studentProfile.admissionNo,
        status: admission.studentProfile.status,
        church: admission.studentProfile.church || undefined,
        preferredLanguage: admission.studentProfile.preferredLanguage,
        gender: admission.studentProfile.gender || undefined,
        dateOfBirth: admission.studentProfile.dateOfBirth
          ? admission.studentProfile.dateOfBirth.toISOString()
          : undefined,
        fullName: admission.studentProfile.membership?.user?.fullName || 'Applicant',
        phoneNumber: admission.studentProfile.membership?.user?.phoneE164 || '',
        email: admission.studentProfile.membership?.user?.email || undefined,
        existingEnrolments: admission.studentProfile.enrolments || [],
      },
    };
  }

  async reviewAdmission(
    instituteId: string,
    admissionId: string,
    reviewerUserId: string,
    input: ReviewAdmissionInput,
  ) {
    const admission = await this.prisma.admission.findFirst({
      where: { id: admissionId, instituteId },
    });
    if (!admission) {
      throw new NotFoundException('Admission application not found in this institute');
    }
    if (admission.status === 'ACCEPTED' || admission.status === 'REJECTED') {
      throw new ConflictException(`Admission already finalized with status ${admission.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.admission.update({
        where: { id: admissionId },
        data: {
          status: input.status,
          interviewAt: input.interviewAt ? new Date(input.interviewAt) : admission.interviewAt,
          interviewNotes: input.interviewNotes ?? admission.interviewNotes,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          instituteId,
          actorUserId: reviewerUserId,
          action: `ADMISSION_${input.status}`,
          entityType: 'Admission',
          entityId: admissionId,
          metadata: { interviewAt: input.interviewAt || null },
        },
      });
      return rec;
    });

    return {
      id: updated.id,
      status: updated.status,
      interviewAt: updated.interviewAt ? updated.interviewAt.toISOString() : undefined,
      interviewNotes: updated.interviewNotes || undefined,
    };
  }

  async approveAdmission(
    instituteId: string,
    admissionId: string,
    reviewerUserId: string,
    input: ApproveAdmissionInput,
  ) {
    const admission: any = await this.prisma.admission.findFirst({
      where: { id: admissionId, instituteId },
      include: {
        course: true,
        studentProfile: {
          include: { membership: { include: { user: true } } },
        },
      },
    });
    if (!admission) {
      throw new NotFoundException('Admission application not found in this institute');
    }
    if (admission.status === 'ACCEPTED') {
      throw new ConflictException('This admission application has already been approved');
    }
    if (admission.status === 'REJECTED') {
      throw new ConflictException('Rejected admission application cannot be approved directly');
    }

    const targetBatchId = input.batchId || admission.batchId || null;
    if (targetBatchId) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: targetBatchId, instituteId },
        include: { _count: { select: { enrolments: true } } },
      });
      if (!batch) {
        throw new BadRequestException('Selected batch does not belong to this institute');
      }
      if (admission.courseId && batch.courseId !== admission.courseId) {
        throw new BadRequestException('Selected batch does not belong to the applied course');
      }
      if (batch._count.enrolments >= batch.capacity) {
        throw new ConflictException(`Batch "${batch.name}" is already at capacity (${batch.capacity})`);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Activate StudentProfile & Membership
      await tx.studentProfile.update({
        where: { id: admission.studentProfileId },
        data: { status: 'ACTIVE' },
      });
      await tx.membership.update({
        where: { id: admission.studentProfile.membershipId },
        data: { status: MembershipStatus.ACTIVE },
      });

      // 2. Create or activate Enrolment if courseId exists
      let enrolmentId: string | null = null;
      if (admission.courseId) {
        const existingEnrolment = await tx.enrolment.findUnique({
          where: {
            studentProfileId_courseId: {
              studentProfileId: admission.studentProfileId,
              courseId: admission.courseId,
            },
          },
        });
        if (existingEnrolment) {
          const updatedEnrolment = await tx.enrolment.update({
            where: { id: existingEnrolment.id },
            data: {
              status: EnrolmentStatus.ACTIVE,
              batchId: targetBatchId || existingEnrolment.batchId,
            },
          });
          enrolmentId = updatedEnrolment.id;
        } else {
          const createdEnrolment = await tx.enrolment.create({
            data: {
              instituteId,
              studentProfileId: admission.studentProfileId,
              courseId: admission.courseId,
              batchId: targetBatchId,
              source: (input.source as EnrolmentSource) || EnrolmentSource.ADMIN,
              status: EnrolmentStatus.ACTIVE,
            },
          });
          enrolmentId = createdEnrolment.id;
        }
      }

      // 3. Issue initial Fee Invoice if course is PAID, createFeeInvoice is true, and not waived
      let createdInvoiceNumber: string | null = null;
      const totalCourseDuePaise =
        admission.course &&
        admission.course.pricing === 'PAID' &&
        input.source !== 'SCHOLARSHIP'
          ? (admission.course.salePrice ?? admission.course.price ?? 0) +
            (admission.course.registrationFee ?? 0)
          : 0;

      if (input.createFeeInvoice && totalCourseDuePaise > 0) {
        const currentYear = new Date().getFullYear();
        const seq = await tx.financialSequence.upsert({
          where: {
            instituteId_year_type: {
              instituteId,
              year: currentYear,
              type: FinancialSequenceType.INVOICE,
            },
          },
          update: { currentSeq: { increment: 1 } },
          create: {
            instituteId,
            year: currentYear,
            type: FinancialSequenceType.INVOICE,
            currentSeq: 1,
          },
        });
        const invoiceNumber = `INV-${currentYear}-${String(seq.currentSeq).padStart(4, '0')}`;
        const dueDate = new Date(Date.now() + (input.dueDays ?? 14) * 24 * 60 * 60 * 1000);

        await tx.invoice.create({
          data: {
            instituteId,
            studentProfileId: admission.studentProfileId,
            invoiceNumber,
            status: 'ISSUED',
            issueDate: new Date(),
            dueDate,
            totalAmount: totalCourseDuePaise,
            paidAmount: 0,
            balanceAmount: totalCourseDuePaise,
            notes: `Auto-generated upon admission approval for ${admission.course.title}`,
            items: {
              create: [
                {
                  description: `${admission.course.title} — Tuition & Registration`,
                  amount: totalCourseDuePaise,
                },
              ],
            },
            installments: {
              create: [
                {
                  installmentNumber: 1,
                  dueDate,
                  amount: totalCourseDuePaise,
                  paidAmount: 0,
                  status: 'PENDING',
                },
              ],
            },
          },
        });
        createdInvoiceNumber = invoiceNumber;
      }

      // 4. Mark Admission ACCEPTED
      const updatedAdmission = await tx.admission.update({
        where: { id: admissionId },
        data: {
          status: 'ACCEPTED',
          batchId: targetBatchId,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
          approvedEnrolmentId: enrolmentId,
          interviewNotes: input.notes ? `${admission.interviewNotes || ''}\n${input.notes}`.trim() : admission.interviewNotes,
        },
      });

      await tx.auditLog.create({
        data: {
          instituteId,
          actorUserId: reviewerUserId,
          action: 'ADMISSION_APPROVED',
          entityType: 'Admission',
          entityId: admissionId,
          metadata: {
            enrolmentId,
            invoiceNumber: createdInvoiceNumber,
            batchId: targetBatchId,
          },
        },
      });

      return { updatedAdmission, enrolmentId, createdInvoiceNumber };
    });

    if (this.notificationsService) {
      await this.notificationsService
        .emitAcademicEvent(instituteId, {
          eventType: 'ADMISSION_APPROVED',
          referenceId: admissionId,
          title: 'Admission Approved',
          body: `${admission.studentProfile?.membership?.user?.fullName || 'Applicant'} approved for ${admission.course?.title || 'program'}.`,
          link: `/admin/students/${admission.studentProfileId}`,
        })
        .catch(() => {});
    }

    return {
      success: true,
      admissionId: result.updatedAdmission.id,
      status: result.updatedAdmission.status,
      enrolmentId: result.enrolmentId,
      invoiceNumber: result.createdInvoiceNumber,
    };
  }

  async rejectAdmission(
    instituteId: string,
    admissionId: string,
    reviewerUserId: string,
    input: RejectAdmissionInput,
  ) {
    const admission = await this.prisma.admission.findFirst({
      where: { id: admissionId, instituteId },
      include: {
        studentProfile: {
          include: { enrolments: { where: { status: EnrolmentStatus.ACTIVE } } },
        },
      },
    });
    if (!admission) {
      throw new NotFoundException('Admission application not found in this institute');
    }
    if (admission.status === 'ACCEPTED') {
      throw new ConflictException('Cannot reject an already accepted admission');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.admission.update({
        where: { id: admissionId },
        data: {
          status: 'REJECTED',
          rejectionReason: input.reason,
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
        },
      });

      // Only update StudentProfile status if applicant has no other active enrolments
      if (admission.studentProfile.enrolments.length === 0) {
        await tx.studentProfile.update({
          where: { id: admission.studentProfileId },
          data: { status: 'REJECTED' },
        });
      }

      await tx.auditLog.create({
        data: {
          instituteId,
          actorUserId: reviewerUserId,
          action: 'ADMISSION_REJECTED',
          entityType: 'Admission',
          entityId: admissionId,
          metadata: { reason: input.reason },
        },
      });
    });

    return {
      success: true,
      admissionId,
      status: 'REJECTED',
      rejectionReason: input.reason,
    };
  }
}
