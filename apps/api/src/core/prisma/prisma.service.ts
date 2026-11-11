import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const omitUnmigratedColumns = process.env.PRISMA_MIGRATIONS_APPLIED !== 'true';
    super(
      omitUnmigratedColumns
        ? ({
            omit: {
              course: {
                courseType: true,
                learningMode: true,
                durationLabel: true,
                eligibility: true,
                registrationFee: true,
                enrollmentStartsAt: true,
                enrollmentEndsAt: true,
                requiresApproval: true,
              },
              admission: {
                applicationNumber: true,
                courseId: true,
                batchId: true,
                documents: true,
                applicantDetails: true,
                reviewedByUserId: true,
                reviewedAt: true,
                rejectionReason: true,
                approvedEnrolmentId: true,
              },
              order: {
                invoiceId: true,
                admissionId: true,
                signatureVerified: true,
              },
              payment: {
                providerOrderId: true,
                providerSignature: true,
                signatureVerified: true,
                rawPayload: true,
              },
              exam: {
                batchId: true,
                instructions: true,
                status: true,
                startAt: true,
                endAt: true,
              },
              examAttempt: {
                feedback: true,
              },
              attemptAnswer: {
                feedback: true,
              },
            },
          } as any)
        : undefined,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
