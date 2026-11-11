import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { CourseStatus, EnrolmentStatus, MembershipStatus, OrderStatus, Role } from '@prisma/client';
import { PublicService } from '../src/modules/public/public.service';
import { AdmissionsService } from '../src/modules/admissions/admissions.service';
import { encryptRazorpayCredentials } from '../src/common/razorpay-crypto.util';

describe('Phase 3 & Phase 5: Public Catalog, Applications, Razorpay Verification & Admin Admissions', () => {
  const INSTITUTE_ID = '11111111-1111-4111-8111-111111111111';
  const COURSE_ID = '22222222-2222-4222-8222-222222222222';
  const BATCH_ID = '33333333-3333-4333-8333-333333333333';
  const ADMISSION_ID = '44444444-4444-4444-8444-444444444444';
  const STUDENT_PROFILE_ID = '55555555-5555-4555-8555-555555555555';
  const ADMIN_USER_ID = '66666666-6666-4666-8666-666666666666';

  let mockPrisma: any;
  let publicService: PublicService;
  let admissionsService: AdmissionsService;
  let mockNotifications: any;

  beforeEach(() => {
    mockPrisma = {
      institute: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({
          id: INSTITUTE_ID,
          name: 'Berean Bible Institute',
          slug: 'berean-bible',
          status: 'ACTIVE',
          settings: { studentSelfRegistration: true, razorpayKeyEncrypted: null },
        }),
        findMany: jest.fn(),
      },
      course: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      batch: {
        findFirst: jest.fn(),
      },
      coupon: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      couponRedemption: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      membership: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      studentProfile: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      admission: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      enrolment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      financialSequence: {
        upsert: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
      },
      order: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        update: jest.fn(),
        create: jest.fn(),
      },
      receipt: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
    };

    mockNotifications = {
      emitAcademicEvent: jest.fn().mockResolvedValue(undefined),
    };

    publicService = new PublicService(
      mockPrisma,
      new JwtService({ secret: 'test-public-jwt-secret' }),
    );
    admissionsService = new AdmissionsService(mockPrisma, mockNotifications);
  });

  describe('PublicService.getPublishedCourseDetail', () => {
    it('queries ONLY published courses of active institutes without exposing DRAFT courses', async () => {
      mockPrisma.course.findFirst.mockResolvedValueOnce(null);

      await expect(
        publicService.getPublishedCourseDetail('draft-secret-course'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.course.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CourseStatus.PUBLISHED,
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('PublicService.validateCoupon', () => {
    it('calculates flat and percentage discounts using Coupon.active and usageLimit', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce({
        id: 'c1',
        code: 'GRACE25',
        active: true,
        startsAt: new Date(Date.now() - 86400_000),
        endsAt: new Date(Date.now() + 86400_000),
        usageLimit: 50,
        usedCount: 2,
        discountPct: 25,
        discountAmt: null,
      });

      const res = await publicService.validateCoupon({
        code: 'grace25',
        instituteSlug: 'berean-bible',
        subtotalPaise: 200000,
      });

      expect(res.valid).toBe(true);
      expect(res.type).toBe('PERCENT');
      expect(res.discountPaise).toBe(50000);
      expect(res.finalAmountPaise).toBe(150000);
    });

    it('rejects inactive or exhausted coupons', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValueOnce({
        id: 'c2',
        code: 'EXHAUSTED',
        active: true,
        startsAt: new Date(Date.now() - 86400_000),
        endsAt: null,
        usageLimit: 5,
        usedCount: 5,
        discountPct: null,
        discountAmt: 10000,
      });

      await expect(
        publicService.validateCoupon({
          code: 'EXHAUSTED',
          instituteId: INSTITUTE_ID,
          subtotalPaise: 100000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('PublicService.registerStudent', () => {
    it('blocks registration when studentSelfRegistration is disabled in institute settings', async () => {
      mockPrisma.institute.findFirst.mockResolvedValueOnce({
        id: INSTITUTE_ID,
        name: 'Closed Seminary',
        slug: 'closed-sem',
        status: 'ACTIVE',
        settings: { studentSelfRegistration: false },
      });

      await expect(
        publicService.registerStudent({
          instituteSlug: 'closed-sem',
          fullName: 'Daniel John',
          phoneNumber: '+919876543210',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('PublicService.submitApplication', () => {
    it('creates Admission applicationNumber (APP-YYYY-XXXX) and prevents duplicate applications', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({
        id: COURSE_ID,
        instituteId: INSTITUTE_ID,
        title: 'Biblical Hermeneutics',
        pricing: 'PAID',
        price: 500000,
        salePrice: null,
        registrationFee: 50000,
        requiresApproval: true,
        institute: { id: INSTITUTE_ID, name: 'Berean Bible Institute' },
      });
      mockPrisma.admission.findFirst
        .mockResolvedValueOnce(null) // sequence generator check
        .mockResolvedValueOnce(null); // duplicate admission check
      mockPrisma.studentProfile.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'u-1',
        phoneE164: '+919800000001',
        fullName: 'Ruth Thomas',
      });
      mockPrisma.membership.upsert.mockResolvedValueOnce({ id: 'm-1', role: Role.STUDENT });
      mockPrisma.studentProfile.findUnique.mockResolvedValueOnce(null);
      mockPrisma.studentProfile.create.mockResolvedValueOnce({
        id: STUDENT_PROFILE_ID,
        admissionNo: 'ADM-2026-0001',
      });
      mockPrisma.enrolment.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admission.create.mockResolvedValueOnce({
        id: ADMISSION_ID,
        applicationNumber: `APP-${new Date().getFullYear()}-0001`,
        status: 'APPLIED',
      });

      const created = await publicService.submitApplication({
        courseId: COURSE_ID,
        fullName: 'Ruth Thomas',
        phoneNumber: '+919800000001',
        email: 'ruth@example.com',
        preferredLanguage: 'English',
      });

      expect(created.applicationId).toBe(ADMISSION_ID);
      expect(created.autoEnrolled).toBe(false);
      expect(created.paymentRequired).toBe(true);
      expect(created.totalFeePaise).toBe(550000);

      // Simulate duplicate check rejection
      mockPrisma.admission.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: ADMISSION_ID, applicationNumber: 'APP-2026-0001' });
      mockPrisma.studentProfile.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'u-1', phoneE164: '+919800000001' });
      mockPrisma.membership.upsert.mockResolvedValueOnce({ id: 'm-1' });
      mockPrisma.studentProfile.findUnique.mockResolvedValueOnce({
        id: STUDENT_PROFILE_ID,
        admissionNo: 'ADM-2026-0001',
      });
      mockPrisma.enrolment.findUnique.mockResolvedValueOnce(null);

      await expect(
        publicService.submitApplication({
          courseId: COURSE_ID,
          fullName: 'Ruth Thomas',
          phoneNumber: '+919800000001',
          preferredLanguage: 'English',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('PublicService.verifyOrderPayment', () => {
    it('verifies valid HMAC-SHA256 Razorpay signature and rejects tampered signatures', async () => {
      const keySecret = 'rzp_test_super_secret_12345';
      const encrypted = encryptRazorpayCredentials({
        keyId: 'rzp_test_key_123',
        keySecret,
      });

      const razorpayOrderId = 'order_RZP_1001';
      const razorpayPaymentId = 'pay_RZP_9001';
      const validSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      const baseOrder = {
        id: 'ord-1',
        instituteId: INSTITUTE_ID,
        studentProfileId: STUDENT_PROFILE_ID,
        orderNumber: 'ORD-1001',
        total: 500000,
        status: OrderStatus.PENDING,
        admissionId: null,
        institute: { id: INSTITUTE_ID, settings: { razorpayKeyEncrypted: encrypted } },
        items: [{ id: 'oi-1', courseId: COURSE_ID }],
        payments: [{ id: 'pay-rec-1' }],
      };

      mockPrisma.order.findFirst.mockResolvedValueOnce(baseOrder);
      await expect(
        publicService.verifyOrderPayment({
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature: 'tampered_00000000000000000000000000000000000000000000000000000000',
        }),
      ).rejects.toThrow(ForbiddenException);

      mockPrisma.order.findFirst.mockResolvedValueOnce(baseOrder);
      const result = await publicService.verifyOrderPayment({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: validSignature,
      });

      expect(result.verified).toBe(true);
      expect(result.status).toBe('PAID');
      expect(mockPrisma.enrolment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            courseId: COURSE_ID,
            studentProfileId: STUDENT_PROFILE_ID,
            status: EnrolmentStatus.ACTIVE,
          }),
        }),
      );
    });
  });

  describe('AdmissionsService.approveAdmission & rejectAdmission', () => {
    it('activates membership/profile, creates enrolment & invoice using FinancialSequence(year,type)', async () => {
      mockPrisma.admission.findFirst.mockResolvedValueOnce({
        id: ADMISSION_ID,
        instituteId: INSTITUTE_ID,
        courseId: COURSE_ID,
        batchId: null,
        status: 'APPLIED',
        studentProfileId: STUDENT_PROFILE_ID,
        interviewNotes: null,
        course: {
          id: COURSE_ID,
          title: 'Systematic Theology',
          pricing: 'PAID',
          price: 800000,
          salePrice: null,
          registrationFee: 100000,
        },
        studentProfile: {
          id: STUDENT_PROFILE_ID,
          membershipId: 'mem-1',
          membership: { user: { fullName: 'Ruth Thomas' } },
        },
      });
      mockPrisma.batch.findFirst.mockResolvedValueOnce({
        id: BATCH_ID,
        name: 'Morning Cohort',
        courseId: COURSE_ID,
        capacity: 30,
        _count: { enrolments: 5 },
      });
      mockPrisma.enrolment.findUnique.mockResolvedValueOnce(null);
      mockPrisma.enrolment.create.mockResolvedValueOnce({ id: 'enr-1', status: EnrolmentStatus.ACTIVE });
      mockPrisma.financialSequence.upsert.mockResolvedValueOnce({
        currentSeq: 7,
      });
      mockPrisma.invoice.create.mockResolvedValueOnce({ id: 'inv-7' });
      mockPrisma.admission.update.mockResolvedValueOnce({
        id: ADMISSION_ID,
        status: 'ACCEPTED',
        approvedEnrolmentId: 'enr-1',
      });

      const approved = await admissionsService.approveAdmission(
        INSTITUTE_ID,
        ADMISSION_ID,
        ADMIN_USER_ID,
        { batchId: BATCH_ID, createFeeInvoice: true, dueDays: 14, source: 'ADMIN' },
      );

      expect(approved.success).toBe(true);
      expect(approved.invoiceNumber).toBe(`INV-${new Date().getFullYear()}-0007`);
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mem-1' },
          data: expect.objectContaining({ status: MembershipStatus.ACTIVE }),
        }),
      );
      expect(mockPrisma.studentProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: STUDENT_PROFILE_ID },
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalAmount: 900000,
            balanceAmount: 900000,
            status: 'ISSUED',
          }),
        }),
      );
      expect(mockNotifications.emitAcademicEvent).toHaveBeenCalledWith(
        INSTITUTE_ID,
        expect.objectContaining({ eventType: 'ADMISSION_APPROVED' }),
      );
    });

    it('rejects admission with mandatory reason and preserves existing student status if other active enrolments exist', async () => {
      mockPrisma.admission.findFirst.mockResolvedValueOnce({
        id: ADMISSION_ID,
        instituteId: INSTITUTE_ID,
        studentProfileId: STUDENT_PROFILE_ID,
        studentProfile: { enrolments: [{ id: 'existing-enr' }] },
      });

      const rejected = await admissionsService.rejectAdmission(
        INSTITUTE_ID,
        ADMISSION_ID,
        ADMIN_USER_ID,
        { reason: 'Transcript incomplete for degree track' },
      );

      expect(rejected.success).toBe(true);
      expect(rejected.status).toBe('REJECTED');
      expect(mockPrisma.studentProfile.update).not.toHaveBeenCalled();
    });
  });
});
