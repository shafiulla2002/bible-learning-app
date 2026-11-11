import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  InstituteStatus,
  MembershipStatus,
  PlanCycle,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  private async logPlatformAudit(
    tx: any,
    actor: { userId: string; role: string },
    action: string,
    entityType: string,
    entityId: string,
    targetInstituteId?: string | null,
    metadata?: Record<string, any>,
  ) {
    await tx.platformAuditLog.create({
      data: {
        actorUserId: actor.userId,
        actorRole: actor.role,
        action,
        entityType,
        entityId,
        targetInstituteId: targetInstituteId || null,
        metadata: metadata || {},
      },
    });
  }

  async getAnalytics() {
    const [
      institutes,
      applications,
      subscriptions,
      studentsCount,
      teachersCount,
      coursesCount,
      paidPlatformInvoices,
      studentGroups,
      teacherGroups,
    ] = await Promise.all([
      this.prisma.institute.findMany({
        where: { deletedAt: null },
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              courses: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.instituteApplication.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      this.prisma.instituteSubscription.findMany({
        where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
        include: { plan: true },
      }),
      this.prisma.studentProfile.count(),
      this.prisma.teacherProfile.count(),
      this.prisma.course.count(),
      this.prisma.subscriptionInvoice.findMany({
        where: { status: 'PAID' },
        select: { total: true },
      }),
      this.prisma.studentProfile.groupBy({
        by: ['instituteId'],
        _count: { _all: true },
      }),
      this.prisma.teacherProfile.groupBy({
        by: ['instituteId'],
        _count: { _all: true },
      }),
    ]);

    const studentCountByInst = new Map<string, number>(
      studentGroups.map((g) => [g.instituteId, g._count._all]),
    );
    const teacherCountByInst = new Map<string, number>(
      teacherGroups.map((g) => [g.instituteId, g._count._all]),
    );

    const platformMrrPaise = subscriptions
      .filter((s) => s.status === SubscriptionStatus.ACTIVE)
      .reduce((sum, s) => {
        if (s.cycle === PlanCycle.YEARLY) {
          return sum + Math.round((s.plan?.priceYearly || 0) / 12);
        }
        return sum + (s.plan?.priceMonthly || 0);
      }, 0);

    const totalPlatformRevenuePaise = paidPlatformInvoices.reduce(
      (sum, inv) => sum + inv.total,
      0,
    );

    return {
      metrics: {
        totalInstitutes: institutes.length,
        activeInstitutes: institutes.filter((i) => i.status === InstituteStatus.ACTIVE).length,
        suspendedInstitutes: institutes.filter((i) => i.status === InstituteStatus.SUSPENDED).length,
        pendingApplications: applications.filter((a) =>
          ['PENDING', 'UNDER_REVIEW'].includes(a.status),
        ).length,
        totalStudents: studentsCount,
        totalTeachers: teachersCount,
        totalCourses: coursesCount,
        activeSubscriptions: subscriptions.length,
        platformMrrPaise,
        totalPlatformRevenuePaise,
      },
      institutes: institutes.map((inst) => ({
        id: inst.id,
        name: inst.name,
        slug: inst.slug,
        status: inst.status,
        currency: inst.currency,
        timezone: inst.timezone,
        createdAt: inst.createdAt.toISOString(),
        studentsCount: studentCountByInst.get(inst.id) ?? 0,
        teachersCount: teacherCountByInst.get(inst.id) ?? 0,
        coursesCount: inst._count.courses,
        subscription: inst.subscriptions[0]
          ? {
              id: inst.subscriptions[0].id,
              status: inst.subscriptions[0].status,
              cycle: inst.subscriptions[0].cycle,
              planName: inst.subscriptions[0].plan?.name,
              planCode: inst.subscriptions[0].plan?.code,
              periodEnd: inst.subscriptions[0].periodEnd.toISOString(),
            }
          : null,
      })),
      recentApplications: applications,
    };
  }

  async listInstitutes() {
    const analytics = await this.getAnalytics();
    return analytics.institutes;
  }

  async createInstitute(
    body: {
      name: string;
      slug: string;
      adminName: string;
      adminPhoneE164: string;
      adminEmail?: string;
      adminPassword?: string;
      planCode?: string;
      timezone?: string;
      currency?: string;
    },
    actor: { userId: string; role: string },
  ) {
    const name = body?.name?.trim();
    const slug = body?.slug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const adminName = body?.adminName?.trim();
    const adminPhone = body?.adminPhoneE164?.trim();

    if (!name || !slug || !adminName || !adminPhone) {
      throw new BadRequestException('name, slug, adminName, and adminPhoneE164 are required');
    }

    const existingSlug = await this.prisma.institute.findUnique({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException(`Institute slug "${slug}" is already in use`);
    }

    const passwordHash = body.adminPassword
      ? await bcrypt.hash(body.adminPassword, 10)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const institute = await tx.institute.create({
        data: {
          name,
          slug,
          status: InstituteStatus.ACTIVE,
          timezone: body.timezone?.trim() || 'Asia/Kolkata',
          currency: body.currency?.trim() || 'INR',
        },
      });

      await tx.instituteSettings.create({
        data: {
          instituteId: institute.id,
          studentSelfRegistration: true,
        },
      });

      let adminUser = await tx.user.findFirst({
        where: {
          OR: [
            { phoneE164: adminPhone },
            ...(body.adminEmail?.trim() ? [{ email: body.adminEmail.trim().toLowerCase() }] : []),
          ],
        },
      });

      if (!adminUser) {
        adminUser = await tx.user.create({
          data: {
            fullName: adminName,
            phoneE164: adminPhone,
            email: body.adminEmail?.trim().toLowerCase() || null,
            passwordHash: passwordHash || null,
            status: 'ACTIVE',
          },
        });
      }

      await tx.membership.upsert({
        where: {
          userId_instituteId_role: {
            userId: adminUser.id,
            instituteId: institute.id,
            role: Role.INSTITUTE_ADMIN,
          },
        },
        create: {
          instituteId: institute.id,
          userId: adminUser.id,
          role: Role.INSTITUTE_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        update: { status: MembershipStatus.ACTIVE },
      });

      let subscription: any = null;
      const plan = body.planCode
        ? await tx.plan.findUnique({ where: { code: body.planCode } })
        : await tx.plan.findFirst({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } });

      if (plan) {
        const now = new Date();
        const trialDays = plan.trialDays || 14;
        const trialEnd = new Date(now.getTime() + trialDays * 86400000);
        subscription = await tx.instituteSubscription.create({
          data: {
            instituteId: institute.id,
            planId: plan.id,
            status: SubscriptionStatus.TRIALING,
            cycle: PlanCycle.MONTHLY,
            trialEndsAt: trialEnd,
            periodStart: now,
            periodEnd: trialEnd,
          },
        });
      }

      await this.logPlatformAudit(
        tx,
        actor,
        'CREATE_INSTITUTE',
        'Institute',
        institute.id,
        institute.id,
        { slug, adminUserId: adminUser.id, planCode: plan?.code },
      );

      return { institute, adminUser: { id: adminUser.id, fullName: adminUser.fullName }, subscription };
    });
  }

  async updateInstituteStatus(
    instituteId: string,
    body: { status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'CLOSED'; reason?: string },
    actor: { userId: string; role: string },
  ) {
    const institute = await this.prisma.institute.findFirst({
      where: { id: instituteId, deletedAt: null },
    });
    if (!institute) {
      throw new NotFoundException('Institute not found');
    }

    const nextStatus = body?.status;
    if (!nextStatus || !(nextStatus in InstituteStatus)) {
      throw new BadRequestException('Invalid institute status');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.institute.update({
        where: { id: institute.id },
        data: { status: InstituteStatus[nextStatus] },
      });

      if (nextStatus === 'SUSPENDED') {
        await tx.instituteSubscription.updateMany({
          where: { instituteId: institute.id, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
          data: {
            status: SubscriptionStatus.SUSPENDED,
            suspendedAt: new Date(),
            suspendReason: body.reason?.trim() || 'Suspended by Platform Super Admin',
          },
        });
      } else if (nextStatus === 'ACTIVE') {
        await tx.instituteSubscription.updateMany({
          where: { instituteId: institute.id, status: SubscriptionStatus.SUSPENDED },
          data: {
            status: SubscriptionStatus.ACTIVE,
            suspendedAt: null,
            suspendReason: null,
          },
        });
      }

      await this.logPlatformAudit(
        tx,
        actor,
        'UPDATE_INSTITUTE_STATUS',
        'Institute',
        institute.id,
        institute.id,
        { previousStatus: institute.status, nextStatus, reason: body.reason },
      );

      return updated;
    });
  }

  async listApplications(status?: string) {
    return this.prisma.instituteApplication.findMany({
      where: status && status !== 'ALL' ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveApplication(
    applicationId: string,
    actor: { userId: string; role: string },
  ) {
    const app = await this.prisma.instituteApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app) {
      throw new NotFoundException('Institute application not found');
    }
    if (app.status === 'APPROVED' && app.createdInstituteId) {
      throw new ConflictException('Application has already been approved');
    }

    const provisioned = await this.createInstitute(
      {
        name: app.instituteName,
        slug: app.slug,
        adminName: app.applicantName,
        adminPhoneE164: app.applicantPhone,
        adminEmail: app.applicantEmail,
        planCode: app.planCode || undefined,
      },
      actor,
    );

    const updatedApp = await this.prisma.instituteApplication.update({
      where: { id: app.id },
      data: {
        status: 'APPROVED',
        reviewedByUserId: actor.userId,
        reviewedAt: new Date(),
        createdInstituteId: provisioned.institute.id,
      },
    });

    await this.logPlatformAudit(
      this.prisma,
      actor,
      'APPROVE_INSTITUTE_APPLICATION',
      'InstituteApplication',
      app.id,
      provisioned.institute.id,
      { slug: app.slug },
    );

    return { application: updatedApp, provisioned };
  }

  async rejectApplication(
    applicationId: string,
    reason: string,
    actor: { userId: string; role: string },
  ) {
    const app = await this.prisma.instituteApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app) {
      throw new NotFoundException('Institute application not found');
    }

    const updated = await this.prisma.instituteApplication.update({
      where: { id: app.id },
      data: {
        status: 'REJECTED',
        notes: reason?.trim() || app.notes,
        reviewedByUserId: actor.userId,
        reviewedAt: new Date(),
      },
    });

    await this.logPlatformAudit(
      this.prisma,
      actor,
      'REJECT_INSTITUTE_APPLICATION',
      'InstituteApplication',
      app.id,
      null,
      { reason },
    );

    return updated;
  }

  async listPlans() {
    return this.prisma.plan.findMany({
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async createPlan(
    body: {
      code: string;
      name: string;
      priceMonthly: number;
      priceYearly: number;
      trialDays?: number;
      maxStudents?: number;
      maxTeachers?: number;
      maxCourses?: number;
      storageGb?: number;
      features?: Record<string, any>;
      isActive?: boolean;
    },
    actor: { userId: string; role: string },
  ) {
    const code = body?.code?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]+$/.test(code)) {
      throw new BadRequestException('Plan code must be uppercase alphanumeric');
    }
    if (!body?.name?.trim()) {
      throw new BadRequestException('Plan name is required');
    }
    const existing = await this.prisma.plan.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Plan code ${code} already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.create({
        data: {
          code,
          name: body.name.trim(),
          priceMonthly: Math.max(0, Math.round(Number(body.priceMonthly))),
          priceYearly: Math.max(0, Math.round(Number(body.priceYearly))),
          trialDays: body.trialDays ?? 14,
          maxStudents: body.maxStudents ?? 100,
          maxTeachers: body.maxTeachers ?? 10,
          maxCourses: body.maxCourses ?? 20,
          storageGb: body.storageGb ?? 10,
          features: body.features || {},
          isActive: body.isActive ?? true,
        },
      });

      await this.logPlatformAudit(tx, actor, 'CREATE_PLAN', 'Plan', plan.id, null, { code });
      return plan;
    });
  }

  async updatePlan(
    planId: string,
    body: Partial<{
      name: string;
      priceMonthly: number;
      priceYearly: number;
      trialDays: number;
      maxStudents: number;
      maxTeachers: number;
      maxCourses: number;
      storageGb: number;
      features: Record<string, any>;
      isActive: boolean;
    }>,
    actor: { userId: string; role: string },
  ) {
    const existing = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!existing) {
      throw new NotFoundException('Subscription plan not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.plan.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.priceMonthly !== undefined ? { priceMonthly: Math.round(body.priceMonthly) } : {}),
          ...(body.priceYearly !== undefined ? { priceYearly: Math.round(body.priceYearly) } : {}),
          ...(body.trialDays !== undefined ? { trialDays: body.trialDays } : {}),
          ...(body.maxStudents !== undefined ? { maxStudents: body.maxStudents } : {}),
          ...(body.maxTeachers !== undefined ? { maxTeachers: body.maxTeachers } : {}),
          ...(body.maxCourses !== undefined ? { maxCourses: body.maxCourses } : {}),
          ...(body.storageGb !== undefined ? { storageGb: body.storageGb } : {}),
          ...(body.features !== undefined ? { features: body.features } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      await this.logPlatformAudit(tx, actor, 'UPDATE_PLAN', 'Plan', existing.id, null, body);
      return updated;
    });
  }

  async listSubscriptions() {
    return this.prisma.instituteSubscription.findMany({
      include: {
        institute: { select: { id: true, name: true, slug: true, status: true } },
        plan: true,
        invoices: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignSubscription(
    body: {
      instituteId: string;
      planId: string;
      cycle?: 'MONTHLY' | 'YEARLY';
      status?: 'TRIALING' | 'ACTIVE';
      generateInvoice?: boolean;
    },
    actor: { userId: string; role: string },
  ) {
    const [institute, plan] = await Promise.all([
      this.prisma.institute.findUnique({ where: { id: body.instituteId } }),
      this.prisma.plan.findUnique({ where: { id: body.planId } }),
    ]);
    if (!institute) throw new NotFoundException('Institute not found');
    if (!plan) throw new NotFoundException('Plan not found');

    const cycle = body.cycle === 'YEARLY' ? PlanCycle.YEARLY : PlanCycle.MONTHLY;
    const status = body.status === 'ACTIVE' ? SubscriptionStatus.ACTIVE : SubscriptionStatus.TRIALING;
    const now = new Date();
    const durationDays = cycle === PlanCycle.YEARLY ? 365 : 30;
    const periodEnd = new Date(now.getTime() + durationDays * 86400000);

    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.instituteSubscription.create({
        data: {
          instituteId: institute.id,
          planId: plan.id,
          status,
          cycle,
          periodStart: now,
          periodEnd,
          autoRenew: true,
        },
        include: { plan: true, institute: true },
      });

      let invoice: any = null;
      if (body.generateInvoice !== false) {
        const subtotal = cycle === PlanCycle.YEARLY ? plan.priceYearly : plan.priceMonthly;
        const tax = Math.round(subtotal * 0.18);
        const total = subtotal + tax;
        const invNum = `SUB-INV-${now.getFullYear()}-${Date.now().toString().slice(-5)}`;
        invoice = await tx.subscriptionInvoice.create({
          data: {
            instituteId: institute.id,
            subscriptionId: sub.id,
            number: invNum,
            subtotal,
            tax,
            total,
            status: total === 0 ? 'PAID' : 'OPEN',
            dueAt: new Date(now.getTime() + 7 * 86400000),
            ...(total === 0 ? { paidAt: now } : {}),
          },
        });
      }

      await this.logPlatformAudit(
        tx,
        actor,
        'ASSIGN_SUBSCRIPTION',
        'InstituteSubscription',
        sub.id,
        institute.id,
        { planCode: plan.code, cycle, status },
      );

      return { subscription: sub, invoice };
    });
  }

  async listPlatformInvoices() {
    return this.prisma.subscriptionInvoice.findMany({
      include: {
        institute: { select: { id: true, name: true, slug: true } },
        subscription: { include: { plan: { select: { name: true, code: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markPlatformInvoicePaid(
    invoiceId: string,
    actor: { userId: string; role: string },
  ) {
    const inv = await this.prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Platform subscription invoice not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscriptionInvoice.update({
        where: { id: inv.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      await tx.instituteSubscription.update({
        where: { id: inv.subscriptionId },
        data: { status: SubscriptionStatus.ACTIVE },
      });
      await this.logPlatformAudit(
        tx,
        actor,
        'MARK_SUBSCRIPTION_INVOICE_PAID',
        'SubscriptionInvoice',
        inv.id,
        inv.instituteId,
        { invoiceNumber: inv.number, totalPaise: inv.total },
      );
      return updated;
    });
  }

  async listAuditLogs(limit: number = 50) {
    return this.prisma.platformAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
