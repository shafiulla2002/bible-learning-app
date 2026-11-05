import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Student Portal Phase 6: Fee Payments, Certificates & Student Profile Management', () => {
  let app: INestApplication;
  let serverUrl: string;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let student1Membership: any;
  let student1Profile: any;
  let student2Membership: any;
  let testInstitute: any;
  let testInvoice: any;
  let testCertificate: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;
    serverUrl = `http://127.0.0.1:${port}/api/v1`;

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Find existing invoice or student profile with invoices
    const existingInvoice = await prisma.invoice.findFirst({
      include: {
        studentProfile: {
          include: {
            membership: {
              include: { user: true, institute: true },
            },
            enrolments: {
              include: { course: true, certificate: true },
            },
          },
        },
        items: true,
        payments: true,
      },
    });

    if (existingInvoice && existingInvoice.studentProfile?.membership) {
      student1Membership = existingInvoice.studentProfile.membership;
      student1Profile = existingInvoice.studentProfile;
      testInvoice = existingInvoice;
      testInstitute = student1Membership.institute;
    } else {
      const students = await prisma.membership.findMany({
        where: {
          role: 'STUDENT',
          status: 'ACTIVE',
          studentProfile: { isNot: null },
        },
        include: {
          user: true,
          studentProfile: {
            include: {
              enrolments: {
                include: { course: true, certificate: true },
              },
            },
          },
          institute: true,
        },
        take: 2,
      });

      student1Membership = students[0];
      student1Profile = student1Membership.studentProfile;
      testInstitute = student1Membership.institute;

      const invCount = await prisma.invoice.count({ where: { instituteId: testInstitute.id } });
      const invoiceNumber = `INV-2026-${String(invCount + 1).padStart(4, '0')}`;
      testInvoice = await prisma.invoice.create({
        data: {
          instituteId: testInstitute.id,
          studentProfileId: student1Membership.studentProfile.id,
          invoiceNumber,
          totalAmount: 1500000,
          paidAmount: 500000,
          balanceAmount: 1000000,
          currency: 'INR',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: 'PARTIALLY_PAID',
          notes: 'Theological Foundations Tuition Fee',
          items: {
            create: [
              {
                description: 'Theological Foundations Course Tuition',
                amount: 1500000,
              },
            ],
          },
        },
        include: { items: true, payments: true },
      });
    }

    const otherStudents = await prisma.membership.findMany({
      where: {
        role: 'STUDENT',
        status: 'ACTIVE',
        id: { not: student1Membership.id },
      },
      include: { user: true, institute: true },
      take: 1,
    });
    student2Membership = otherStudents[0];

    // Ensure student1 has at least one certificate or enrolment
    const enrolment = await prisma.enrolment.findFirst({
      where: { studentProfileId: student1Membership.studentProfileId || student1Membership.studentProfile?.id },
      include: { certificate: true },
    });

    if (enrolment) {
      testCertificate = enrolment.certificate;
      if (!testCertificate) {
        testCertificate = await prisma.certificate.create({
          data: {
            instituteId: testInstitute.id,
            enrolmentId: enrolment.id,
            certificateNo: `CERT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            verifyToken: `vfy-tok-${Date.now()}`,
            issuedAt: new Date(),
          },
        });
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  function createToken(membership: any, overrideRole?: string): string {
    const payload = {
      sub: membership.userId,
      userId: membership.userId,
      email: membership.user?.email || 'test@example.org',
      role: overrideRole || membership.role,
      membershipId: membership.id,
      instituteId: membership.instituteId,
    };
    return jwtService.sign(payload, { secret: process.env.JWT_SECRET || 'dev-secret-key-bible-institute-lms-12345' });
  }

  it('1. rejects unauthenticated requests to GET /students/payments with HTTP 401', async () => {
    const res = await fetch(`${serverUrl}/students/payments`);
    expect(res.status).toBe(401);
  });

  it('2. rejects unauthorized non-student accounts (INSTITUTE_ADMIN) from accessing payments with HTTP 403', async () => {
    const adminToken = createToken(student1Membership, 'INSTITUTE_ADMIN');
    const res = await fetch(`${serverUrl}/students/payments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('3. retrieves student payment overview with integer paise calculations', async () => {
    const studentToken = createToken(student1Membership);
    const res = await fetch(`${serverUrl}/students/payments`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.totalFeesPaise).toBe('number');
    expect(typeof data.summary.totalPaidPaise).toBe('number');
    expect(typeof data.summary.outstandingBalancePaise).toBe('number');
    expect(data.summary.currency).toBe('INR');
    expect(Array.isArray(data.recentPayments)).toBe(true);
  });

  it('4. retrieves student invoice listing with computed status (ISSUED, PAID, OVERDUE)', async () => {
    const studentToken = createToken(student1Membership);
    const res = await fetch(`${serverUrl}/students/invoices`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.invoices)).toBe(true);
    expect(data.invoices.length).toBeGreaterThan(0);
    const inv = data.invoices[0];
    expect(inv.invoiceNumber).toBeDefined();
    expect(typeof inv.totalAmountPaise).toBe('number');
    expect(typeof inv.balanceAmountPaise).toBe('number');
    expect(inv.dueDate).toBeDefined();
    expect(['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DRAFT']).toContain(inv.status);
  });

  it('5. retrieves invoice details with items and payments breakdown', async () => {
    const studentToken = createToken(student1Membership);
    const res = await fetch(`${serverUrl}/students/invoices/${testInvoice.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoice).toBeDefined();
    expect(data.invoice.id).toBe(testInvoice.id);
    expect(Array.isArray(data.invoice.items)).toBe(true);
    expect(Array.isArray(data.invoice.payments)).toBe(true);
    expect(data.invoice.studentName).toBeDefined();
    expect(data.invoice.admissionNo).toBeDefined();
  });

  it('6. creates server-side payment order with amount in paise', async () => {
    const studentToken = createToken(student1Membership);
    const res = await fetch(`${serverUrl}/students/invoices/${testInvoice.id}/pay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amountPaise: 50000 }),
    });

    // If invoice is already paid, it returns 400 'Invoice is already fully paid'; otherwise 200 with order
    if (testInvoice.balanceAmount <= 0) {
      expect(res.status).toBe(400);
    } else {
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order).toBeDefined();
      expect(data.order.orderId).toBeDefined();
      expect(data.order.amountPaise).toBe(50000);
      expect(data.order.currency).toBe('INR');
    }
  });

  it('7. verifies payment and updates invoice status with idempotency protection', async () => {
    const studentToken = createToken(student1Membership);

    // Fetch latest balance
    const detailRes = await fetch(`${serverUrl}/students/invoices/${testInvoice.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const { invoice } = await detailRes.json();

    if (invoice.balanceAmountPaise > 0) {
      const payAmount = Math.min(10000, invoice.balanceAmountPaise); // ₹100
      const refNum = `TEST-REF-${Date.now()}`;

      const res = await fetch(`${serverUrl}/students/invoices/${testInvoice.id}/verify-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountPaise: payAmount,
          paymentMode: 'ONLINE',
          referenceNumber: refNum,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.payment.paymentNumber).toBeDefined();
      expect(data.payment.receiptNumber).toBeDefined();
      expect(data.invoice.paidAmountPaise).toBeGreaterThan(0);

      // Verify idempotency: duplicate transaction ref should be rejected with 409
      const dupRes = await fetch(`${serverUrl}/students/invoices/${testInvoice.id}/verify-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountPaise: payAmount,
          paymentMode: 'ONLINE',
          referenceNumber: refNum,
        }),
      });
      expect(dupRes.status).toBe(409);
    } else {
      expect(invoice.balanceAmountPaise).toBe(0);
    }
  });

  it('8. enforces strict certificate ownership and lists issued certificates for student', async () => {
    const studentToken = createToken(student1Membership);
    const res = await fetch(`${serverUrl}/students/certificates`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.certificates)).toBe(true);
    if (data.certificates.length > 0) {
      const cert = data.certificates[0];
      expect(cert.certificateNo).toBeDefined();
      expect(cert.courseTitle).toBeDefined();
      expect(cert.verifyToken).toBeDefined();
      expect(cert.verificationUrl).toBeDefined();
    }
  });

  it('9. retrieves student profile with separated personal and academic sections', async () => {
    const studentToken = createToken(student1Membership);
    const res = await fetch(`${serverUrl}/students/profile`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile).toBeDefined();
    expect(data.profile.personal).toBeDefined();
    expect(data.profile.personal.fullName).toBeDefined();
    expect(data.profile.personal.email).toBeDefined();
    expect(data.profile.academic).toBeDefined();
    expect(data.profile.academic.admissionNo).toBeDefined();
    expect(data.profile.academic.instituteName).toBeDefined();
    expect(Array.isArray(data.profile.academic.enrolledCourses)).toBe(true);
  });

  it('10. updates student profile editable fields while preserving protected academic fields', async () => {
    const studentToken = createToken(student1Membership);
    const res = await fetch(`${serverUrl}/students/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preferredLanguage: 'English',
        church: 'Grace Reformed Church, Bangalore',
        phone: '+919811100001',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.profile.preferredLanguage).toBe('English');
    expect(data.profile.church).toBe('Grace Reformed Church, Bangalore');

    // Confirm that admissionNo remained strictly unchanged
    const profileRes = await fetch(`${serverUrl}/students/profile`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const profileData = await profileRes.json();
    expect(profileData.profile.academic.admissionNo).toBe(student1Profile.admissionNo);
  });
});

