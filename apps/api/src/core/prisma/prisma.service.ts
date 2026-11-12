import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function withSingleConnectionPool(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set('connection_limit', '2');
    parsed.searchParams.set('pool_timeout', '60');
    parsed.searchParams.set('connect_timeout', '15');
    return parsed.toString();
  } catch {
    const sep = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${sep}connection_limit=2&pool_timeout=60&connect_timeout=15`;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static initPromise: Promise<void> | null = null;
  private static lastReapAt = 0;

  constructor() {
    const existingSingleton = (globalThis as any).__bibleLmsPrismaService as
      | PrismaService
      | undefined;

    const omitUnmigratedColumns = process.env.PRISMA_MIGRATIONS_APPLIED !== 'true';
    const defaultCloudDbUrl =
      'postgresql://bible_app:bible%23123@8.231.106.67:5432/bible_lms_dev?sslmode=require&connection_limit=2&pool_timeout=60&connect_timeout=15';
    const rawEnvUrl = process.env.DATABASE_URL?.trim();
    const effectiveDbUrl = withSingleConnectionPool(rawEnvUrl ? rawEnvUrl : defaultCloudDbUrl);

    super({
      datasources: {
        db: {
          url: effectiveDbUrl,
        },
      },
      ...(omitUnmigratedColumns
        ? {
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
          }
        : {}),
    } as any);

    if (existingSingleton) {
      return existingSingleton;
    }
    (globalThis as any).__bibleLmsPrismaService = this;
  }

  async reapIdleConnections(force = false) {
    const now = Date.now();
    if (!force && now - PrismaService.lastReapAt < 5000) {
      return;
    }
    PrismaService.lastReapAt = now;
    try {
      await this.$queryRawUnsafe(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE usename = current_user
          AND state = 'idle'
          AND state_change < now() - interval '12 seconds'
          AND pid <> pg_backend_pid()
      `);
    } catch {
      // Ignore non-fatal connection cleanup warnings
    }
  }

  async onModuleInit() {
    if (!PrismaService.initPromise) {
      PrismaService.initPromise = this.$connect()
        .then(() => this.reapIdleConnections(true))
        .catch((err: any) => {
          PrismaService.initPromise = null;
          console.warn('PrismaService initial connect warning (will retry on query):', err?.message);
        });
    }
    await PrismaService.initPromise;
  }

  async onModuleDestroy() {
    PrismaService.initPromise = null;
    await this.$disconnect();
  }
}
