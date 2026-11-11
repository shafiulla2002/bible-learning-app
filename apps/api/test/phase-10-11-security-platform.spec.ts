import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InstituteStatus,
  PlanCycle,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { InstituteTenantGuard } from '../src/core/auth/guards/institute-tenant.guard';
import { PermissionsGuard } from '../src/core/auth/guards/permissions.guard';
import { JwtAuthGuard } from '../src/core/auth/guards/jwt-auth.guard';
import { AuthService } from '../src/core/auth/auth.service';
import { PlatformService } from '../src/modules/platform/platform.service';

describe('Phase 10 & 11: Security Hardening, Multi-Tenant Guards & Super Admin Platform', () => {
  const INST_A = '11111111-1111-4111-8111-111111111111';
  const INST_B = '22222222-2222-4222-8222-222222222222';
  const USER_ID = '33333333-3333-4333-8333-333333333333';
  const PLAN_ID = '44444444-4444-4444-8444-444444444444';

  const makeHttpContext = (req: any): any => ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  });

  describe('Multi-Tenant & Permission Guards', () => {
    it('blocks cross-tenant access on InstituteTenantGuard and allows matching tenant or SUPER_ADMIN', () => {
      const guard = new InstituteTenantGuard();

      expect(() =>
        guard.canActivate(
          makeHttpContext({
            user: { sub: USER_ID, role: Role.INSTITUTE_ADMIN, instituteId: INST_A },
            params: { instituteId: INST_B },
          }),
        ),
      ).toThrow(ForbiddenException);

      expect(
        guard.canActivate(
          makeHttpContext({
            user: { sub: USER_ID, role: Role.INSTITUTE_ADMIN, instituteId: INST_A },
            params: { instituteId: INST_A },
          }),
        ),
      ).toBe(true);

      expect(
        guard.canActivate(
          makeHttpContext({
            user: { sub: USER_ID, role: Role.SUPER_ADMIN },
            params: { instituteId: INST_B },
          }),
        ),
      ).toBe(true);
    });

    it('enforces @RequirePermissions via PermissionsGuard', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(['finance:reverse']),
      } as unknown as Reflector;
      const guard = new PermissionsGuard(reflector);

      expect(() =>
        guard.canActivate(
          makeHttpContext({
            user: { sub: USER_ID, role: Role.TEACHER, permissions: ['courses:read'] },
          }),
        ),
      ).toThrow(ForbiddenException);

      expect(
        guard.canActivate(
          makeHttpContext({
            user: { sub: USER_ID, role: Role.INSTITUTE_ADMIN, permissions: ['finance:reverse'] },
          }),
        ),
      ).toBe(true);

      expect(
        guard.canActivate(
          makeHttpContext({
            user: { sub: USER_ID, role: Role.SUPER_ADMIN },
          }),
        ),
      ).toBe(true);
    });

    it('validates cookie auth + double-submit CSRF protection on mutating methods', () => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-unit-suite-only';
      const jwt = new JwtService({ secret: process.env.JWT_SECRET });
      const guard = new JwtAuthGuard(jwt);
      const token = jwt.sign({ sub: USER_ID, role: Role.STUDENT, instituteId: INST_A });

      // Cookie GET allowed cleanly
      expect(
        guard.canActivate(
          makeHttpContext({
            method: 'GET',
            headers: {},
            cookies: { auth_token: token, csrf_token: 'csrf123' },
          }),
        ),
      ).toBe(true);

      // Cookie POST with missing/mismatched CSRF header blocked
      expect(() =>
        guard.canActivate(
          makeHttpContext({
            method: 'POST',
            headers: { 'x-csrf-token': 'wrong' },
            cookies: { auth_token: token, csrf_token: 'csrf123' },
          }),
        ),
      ).toThrow(ForbiddenException);

      // Cookie POST with valid CSRF header passes
      expect(
        guard.canActivate(
          makeHttpContext({
            method: 'POST',
            headers: { 'x-csrf-token': 'csrf123' },
            cookies: { auth_token: token, csrf_token: 'csrf123' },
          }),
        ),
      ).toBe(true);
    });
  });

  describe('Auth Dev-OTP Production Lockdown', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevDevOtp = process.env.AUTH_DEV_OTP;

    afterEach(() => {
      process.env.NODE_ENV = prevEnv;
      process.env.AUTH_DEV_OTP = prevDevOtp;
    });

    it('rejects static dev OTP bypass when NODE_ENV is production and never leaks devOtp', async () => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-unit-suite-only';
      process.env.NODE_ENV = 'production';
      process.env.AUTH_DEV_OTP = 'true';

      const jwt = new JwtService({ secret: process.env.JWT_SECRET });
      const authService = new AuthService({} as any, jwt);

      const challengeResp = await authService.requestPhoneOtp('+919876543210');
      expect((challengeResp as any).devOtp).toBeUndefined();

      await expect(
        authService.verifyPhoneOtp('+919876543210', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Super Admin PlatformModule & Audit Logging', () => {
    let mockPrisma: any;
    let platformService: PlatformService;

    beforeEach(() => {
      mockPrisma = {
        institute: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue({ id: INST_A, name: 'Berean Bible', status: InstituteStatus.ACTIVE }),
          create: jest.fn().mockImplementation(async ({ data }) => ({ id: INST_A, ...data })),
          update: jest.fn().mockImplementation(async ({ data }) => ({ id: INST_A, ...data })),
        },
        instituteSettings: {
          create: jest.fn().mockResolvedValue({ instituteId: INST_A }),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(async ({ data }) => ({ id: USER_ID, ...data })),
        },
        membership: {
          upsert: jest.fn().mockResolvedValue({ id: 'mem-1', role: Role.INSTITUTE_ADMIN }),
        },
        plan: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue({
            id: PLAN_ID,
            code: 'STARTER',
            name: 'Starter',
            priceMonthly: 299900,
            priceYearly: 2999000,
            trialDays: 14,
          }),
          create: jest.fn().mockImplementation(async ({ data }) => ({ id: PLAN_ID, ...data })),
        },
        instituteSubscription: {
          create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'sub-1', ...data })),
          update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'sub-1', ...data })),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        subscriptionInvoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'sinv-1',
            instituteId: INST_A,
            subscriptionId: 'sub-1',
            number: 'SUB-INV-2026-0001',
            total: 353882,
            status: 'OPEN',
          }),
          update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'sinv-1', ...data })),
        },
        instituteApplication: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            instituteName: 'Calvary Seminary',
            slug: 'calvary-seminary',
            applicantName: 'Pastor Thomas',
            applicantPhone: '+919988776655',
            applicantEmail: 'thomas@calvary.edu',
            planCode: 'STARTER',
            status: 'PENDING',
          }),
          update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'app-1', ...data })),
        },
        platformAuditLog: {
          create: jest.fn().mockResolvedValue({ id: 'pal-1' }),
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      mockPrisma.$transaction = jest.fn(async (cb: any) => cb(mockPrisma));
      platformService = new PlatformService(mockPrisma);
    });

    it('provisions tenant + settings + admin membership + trial subscription and emits PlatformAuditLog', async () => {
      const actor = { userId: USER_ID, role: Role.SUPER_ADMIN };
      const res = await platformService.createInstitute(
        {
          name: 'Berean Bible College',
          slug: 'berean-bible',
          adminName: 'Dr. Paul',
          adminPhoneE164: '+919000011111',
          adminEmail: 'paul@berean.edu',
        },
        actor,
      );

      expect(res.institute.slug).toBe('berean-bible');
      expect(mockPrisma.instituteSettings.create).toHaveBeenCalled();
      expect(mockPrisma.membership.upsert).toHaveBeenCalled();
      expect(mockPrisma.platformAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'CREATE_INSTITUTE' }),
        }),
      );
    });

    it('suspends institute and cascades suspension to active subscriptions with audit entry', async () => {
      const actor = { userId: USER_ID, role: Role.SUPER_ADMIN };
      const res = await platformService.updateInstituteStatus(
        INST_A,
        { status: 'SUSPENDED', reason: 'Non-payment' },
        actor,
      );

      expect(res.status).toBe(InstituteStatus.SUSPENDED);
      expect(mockPrisma.instituteSubscription.updateMany).toHaveBeenCalled();
      expect(mockPrisma.platformAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'UPDATE_INSTITUTE_STATUS' }),
        }),
      );
    });

    it('approves onboarding application, creates tenant, and marks billing invoice paid', async () => {
      const actor = { userId: USER_ID, role: Role.SUPER_ADMIN };
      const approval = await platformService.approveApplication('app-1', actor);
      expect(approval.application.status).toBe('APPROVED');
      expect(approval.provisioned.institute.id).toBe(INST_A);

      const paid = await platformService.markPlatformInvoicePaid('sinv-1', actor);
      expect(paid.status).toBe('PAID');
      expect(mockPrisma.instituteSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: SubscriptionStatus.ACTIVE },
        }),
      );
    });
  });
});

