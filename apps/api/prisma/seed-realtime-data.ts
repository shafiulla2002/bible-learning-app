import {
  PrismaClient,
  Role,
  CourseLevel,
  PricingType,
  CourseStatus,
  EnrolmentStatus,
  EnrolmentSource,
  InvoiceStatus,
  FeePaymentStatus,
  FeePaymentMode,
  AttendanceStatus,
  AttendanceMode,
  MembershipStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING REAL-TIME BIBLE INSTITUTE DATABASE ---');

  // 1. Institute: Grace Bible Institute
  const institute = await prisma.institute.upsert({
    where: { slug: 'grace-bible' },
    update: {
      name: 'Grace Bible Institute',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    },
    create: {
      name: 'Grace Bible Institute',
      slug: 'grace-bible',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    },
  });

  console.log(`✓ Institute configured: ${institute.name} (ID: ${institute.id})`);

  // Ensure settings exist
  await prisma.instituteSettings.upsert({
    where: { instituteId: institute.id },
    update: {
      studentSelfRegistration: true,
      branding: {
        primaryColor: '#1e3a8a',
        secondaryColor: '#3b82f6',
        accentColor: '#10b981',
        instituteName: 'Grace Bible Institute',
      },
    },
    create: {
      instituteId: institute.id,
      studentSelfRegistration: true,
      branding: {
        primaryColor: '#1e3a8a',
        secondaryColor: '#3b82f6',
        accentColor: '#10b981',
        instituteName: 'Grace Bible Institute',
      },
    },
  });

  // 2. Academic Year
  const academicYear = await prisma.academicYear.upsert({
    where: {
      instituteId_name: {
        instituteId: institute.id,
        name: '2026-2027',
      },
    },
    update: {
      isCurrent: true,
    },
    create: {
      instituteId: institute.id,
      name: '2026-2027',
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2027-05-31T23:59:59Z'),
      isCurrent: true,
    },
  });

  // 3. Academic Terms
  const fallTerm = await prisma.academicTerm.upsert({
    where: {
      academicYearId_name: {
        academicYearId: academicYear.id,
        name: 'Fall Term 2026',
      },
    },
    update: { isCurrent: true },
    create: {
      instituteId: institute.id,
      academicYearId: academicYear.id,
      name: 'Fall Term 2026',
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-11-30T23:59:59Z'),
      isCurrent: true,
    },
  });

  // 4. Admin User (Samuel Admin)
  const adminUser = await prisma.user.upsert({
    where: { phoneE164: '+919876543210' },
    update: {
      fullName: 'Samuel Admin',
      email: 'admin@bible-institute.org',
      status: 'ACTIVE',
    },
    create: {
      phoneE164: '+919876543210',
      fullName: 'Samuel Admin',
      email: 'admin@bible-institute.org',
      status: 'ACTIVE',
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_instituteId_role: {
        userId: adminUser.id,
        instituteId: institute.id,
        role: Role.INSTITUTE_ADMIN,
      },
    },
    update: { status: MembershipStatus.ACTIVE },
    create: {
      userId: adminUser.id,
      instituteId: institute.id,
      role: Role.INSTITUTE_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
  });
  console.log(`✓ Admin User configured: ${adminUser.fullName} (${adminUser.email})`);

  // 5. Teachers & Faculty (6 real faculty members)
  const facultyData = [
    {
      name: 'Dr. John Mark',
      phone: '+919876500011',
      email: 'john.mark@bible-institute.org',
      code: 'FAC-001',
      spec: 'Biblical Hermeneutics & Exegesis',
      exp: 14,
    },
    {
      name: 'Prof. Sarah Jenkins',
      phone: '+919876500012',
      email: 'sarah.jenkins@bible-institute.org',
      code: 'FAC-002',
      spec: 'Church History & Historical Theology',
      exp: 11,
    },
    {
      name: 'Rev. David Paul',
      phone: '+919876500013',
      email: 'david.paul@bible-institute.org',
      code: 'FAC-003',
      spec: 'Pastoral Counseling & Ministry Leadership',
      exp: 18,
    },
    {
      name: 'Dr. Timothy Keller',
      phone: '+919876500014',
      email: 'timothy.k@bible-institute.org',
      code: 'FAC-004',
      spec: 'Systematic Theology & Apologetics',
      exp: 16,
    },
    {
      name: 'Prof. Mary Thomas',
      phone: '+919876500015',
      email: 'mary.thomas@bible-institute.org',
      code: 'FAC-005',
      spec: 'Biblical Hebrew & Old Testament Studies',
      exp: 9,
    },
    {
      name: 'Pastor James Cephas',
      phone: '+919876500016',
      email: 'james.cephas@bible-institute.org',
      code: 'FAC-006',
      spec: 'Homiletics & World Missions',
      exp: 12,
    },
  ];

  const teacherProfiles = [];
  for (const f of facultyData) {
    const user = await prisma.user.upsert({
      where: { phoneE164: f.phone },
      update: { fullName: f.name, email: f.email },
      create: {
        phoneE164: f.phone,
        fullName: f.name,
        email: f.email,
        status: 'ACTIVE',
      },
    });

    const mem = await prisma.membership.upsert({
      where: {
        userId_instituteId_role: {
          userId: user.id,
          instituteId: institute.id,
          role: Role.TEACHER,
        },
      },
      update: { status: MembershipStatus.ACTIVE },
      create: {
        userId: user.id,
        instituteId: institute.id,
        role: Role.TEACHER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const prof = await prisma.teacherProfile.upsert({
      where: { membershipId: mem.id },
      update: {
        employeeCode: f.code,
        specialization: f.spec,
        experienceYears: f.exp,
        status: 'ACTIVE',
      },
      create: {
        instituteId: institute.id,
        membershipId: mem.id,
        employeeCode: f.code,
        specialization: f.spec,
        experienceYears: f.exp,
        status: 'ACTIVE',
      },
    });

    teacherProfiles.push(prof);
  }
  console.log(`✓ 6 Faculty Members configured`);

  // 6. Course Categories
  const theologyCat = await prisma.courseCategory.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'theology' } },
    update: {},
    create: {
      instituteId: institute.id,
      name: 'Biblical Theology',
      slug: 'theology',
    },
  });

  const ministryCat = await prisma.courseCategory.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'ministry' } },
    update: {},
    create: {
      instituteId: institute.id,
      name: 'Pastoral Ministry & Leadership',
      slug: 'ministry',
    },
  });

  const historyCat = await prisma.courseCategory.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'history' } },
    update: {},
    create: {
      instituteId: institute.id,
      name: 'Church History',
      slug: 'history',
    },
  });

  // 7. Courses (4 Published Courses)
  const course1 = await prisma.course.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'biblical-theology' } },
    update: {
      title: 'Building Biblical Theology',
      status: CourseStatus.PUBLISHED,
      price: 1850000, // ₹18,500
    },
    create: {
      instituteId: institute.id,
      categoryId: theologyCat.id,
      title: 'Building Biblical Theology',
      slug: 'biblical-theology',
      description: 'Foundations of redemptive history, progressive revelation, and canonical covenants.',
      level: CourseLevel.BEGINNER,
      price: 1850000,
      pricing: PricingType.PAID,
      status: CourseStatus.PUBLISHED,
    },
  });

  const course2 = await prisma.course.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'church-history' } },
    update: {
      title: 'Church History: Reformation to Modern',
      status: CourseStatus.PUBLISHED,
      price: 1600000, // ₹16,000
    },
    create: {
      instituteId: institute.id,
      categoryId: historyCat.id,
      title: 'Church History: Reformation to Modern',
      slug: 'church-history',
      description: 'The theological turns, confessions, and global missionary movements since 1517.',
      level: CourseLevel.INTERMEDIATE,
      price: 1600000,
      pricing: PricingType.PAID,
      status: CourseStatus.PUBLISHED,
    },
  });

  const course3 = await prisma.course.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'pastoral-leadership' } },
    update: {
      title: 'Pastoral Leadership & Counseling',
      status: CourseStatus.PUBLISHED,
      price: 2100000, // ₹21,000
    },
    create: {
      instituteId: institute.id,
      categoryId: ministryCat.id,
      title: 'Pastoral Leadership & Counseling',
      slug: 'pastoral-leadership',
      description: 'Biblical counseling frameworks, church administration, and shepherd leadership.',
      level: CourseLevel.ADVANCED,
      price: 2100000,
      pricing: PricingType.PAID,
      status: CourseStatus.PUBLISHED,
    },
  });

  const course4 = await prisma.course.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'systematic-theology' } },
    update: {
      title: 'Systematic Theology & Hermeneutics',
      status: CourseStatus.PUBLISHED,
      price: 1950000, // ₹19,500
    },
    create: {
      instituteId: institute.id,
      categoryId: theologyCat.id,
      title: 'Systematic Theology & Hermeneutics',
      slug: 'systematic-theology',
      description: 'Doctrines of God, Christ, Salvation, Scripture, and classical hermeneutical methods.',
      level: CourseLevel.INTERMEDIATE,
      price: 1950000,
      pricing: PricingType.PAID,
      status: CourseStatus.PUBLISHED,
    },
  });
  console.log(`✓ 4 Published Courses configured`);

  // 8. Batches
  const batch1 = await prisma.batch.upsert({
    where: { instituteId_code: { instituteId: institute.id, code: 'BST-2026-M' } },
    update: { status: 'ACTIVE' },
    create: {
      instituteId: institute.id,
      courseId: course1.id,
      academicYearId: academicYear.id,
      termId: fallTerm.id,
      name: 'Biblical Studies 2026 - Morning Cohort',
      code: 'BST-2026-M',
      status: 'ACTIVE',
      startDate: new Date('2026-06-15T00:00:00Z'),
      endDate: new Date('2026-12-15T23:59:59Z'),
      capacity: 50,
    },
  });

  const batch2 = await prisma.batch.upsert({
    where: { instituteId_code: { instituteId: institute.id, code: 'CH-2026-E' } },
    update: { status: 'ACTIVE' },
    create: {
      instituteId: institute.id,
      courseId: course2.id,
      academicYearId: academicYear.id,
      termId: fallTerm.id,
      name: 'Church History 2026 - Evening Cohort',
      code: 'CH-2026-E',
      status: 'ACTIVE',
      startDate: new Date('2026-07-01T00:00:00Z'),
      endDate: new Date('2026-12-30T23:59:59Z'),
      capacity: 40,
    },
  });

  const batch3 = await prisma.batch.upsert({
    where: { instituteId_code: { instituteId: institute.id, code: 'PLC-2026' } },
    update: { status: 'ACTIVE' },
    create: {
      instituteId: institute.id,
      courseId: course3.id,
      academicYearId: academicYear.id,
      termId: fallTerm.id,
      name: 'Pastoral Leadership 2026 Cohort',
      code: 'PLC-2026',
      status: 'ACTIVE',
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2027-02-28T23:59:59Z'),
      capacity: 35,
    },
  });

  const batch4 = await prisma.batch.upsert({
    where: { instituteId_code: { instituteId: institute.id, code: 'STW-2026' } },
    update: { status: 'ACTIVE' },
    create: {
      instituteId: institute.id,
      courseId: course4.id,
      academicYearId: academicYear.id,
      termId: fallTerm.id,
      name: 'Systematic Theology Weekend Cohort',
      code: 'STW-2026',
      status: 'ACTIVE',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-03-31T23:59:59Z'),
      capacity: 45,
    },
  });
  console.log(`✓ 4 Active Batches configured`);

  // 9. Real Students (12 verified student records)
  const studentsRaw = [
    {
      name: 'Grace Thomas',
      phone: '+919811100001',
      email: 'grace.thomas@example.org',
      admissionNo: 'ADM-2026-001',
      church: 'Bethel Bible Church, Bangalore',
      gender: 'FEMALE',
      course: course1,
      batch: batch1,
      feePaid: 1850000,
      feeBalance: 0,
    },
    {
      name: 'Daniel Joseph',
      phone: '+919811100002',
      email: 'daniel.joseph@example.org',
      admissionNo: 'ADM-2026-002',
      church: 'Grace Reformed Baptist, Hyderabad',
      gender: 'MALE',
      course: course1,
      batch: batch1,
      feePaid: 1850000,
      feeBalance: 0,
    },
    {
      name: 'Esther Williams',
      phone: '+919811100003',
      email: 'esther.williams@example.org',
      admissionNo: 'ADM-2026-003',
      church: 'New Life Assembly, Chennai',
      gender: 'FEMALE',
      course: course2,
      batch: batch2,
      feePaid: 1600000,
      feeBalance: 0,
    },
    {
      name: 'Samuel Abraham',
      phone: '+919811100004',
      email: 'samuel.abraham@example.org',
      admissionNo: 'ADM-2026-004',
      church: 'Emmanuel Fellowship, Mumbai',
      gender: 'MALE',
      course: course2,
      batch: batch2,
      feePaid: 1600000,
      feeBalance: 0,
    },
    {
      name: 'Hannah Ruth',
      phone: '+919811100005',
      email: 'hannah.ruth@example.org',
      admissionNo: 'ADM-2026-005',
      church: 'Calvary Grace Church, Delhi',
      gender: 'FEMALE',
      course: course3,
      batch: batch3,
      feePaid: 2100000,
      feeBalance: 0,
    },
    {
      name: 'Matthew Philip',
      phone: '+919811100006',
      email: 'matthew.philip@example.org',
      admissionNo: 'ADM-2026-006',
      church: 'Covenant Bible Church, Pune',
      gender: 'MALE',
      course: course3,
      batch: batch3,
      feePaid: 1500000,
      feeBalance: 600000, // partial
    },
    {
      name: 'Deborah Clark',
      phone: '+919811100007',
      email: 'deborah.clark@example.org',
      admissionNo: 'ADM-2026-007',
      church: 'St. Paul Bible Church, Cochin',
      gender: 'FEMALE',
      course: course4,
      batch: batch4,
      feePaid: 1950000,
      feeBalance: 0,
    },
    {
      name: 'Luke Barnabas',
      phone: '+919811100008',
      email: 'luke.barnabas@example.org',
      admissionNo: 'ADM-2026-008',
      church: 'Grace Gospel Chapel, Kolkata',
      gender: 'MALE',
      course: course4,
      batch: batch4,
      feePaid: 1950000,
      feeBalance: 0,
    },
    {
      name: 'Priscilla Aquila',
      phone: '+919811100009',
      email: 'priscilla.a@example.org',
      admissionNo: 'ADM-2026-009',
      church: 'Berean Baptist Fellowship, Goa',
      gender: 'FEMALE',
      course: course1,
      batch: batch1,
      feePaid: 1850000,
      feeBalance: 0,
    },
    {
      name: 'Stephen Prochorus',
      phone: '+919811100010',
      email: 'stephen.p@example.org',
      admissionNo: 'ADM-2026-010',
      church: 'Zion Evangelical Church, Coimbatore',
      gender: 'MALE',
      course: course2,
      batch: batch2,
      feePaid: 1000000,
      feeBalance: 600000, // partial
    },
    {
      name: 'Lydia Thyatira',
      phone: '+919811100011',
      email: 'lydia.t@example.org',
      admissionNo: 'ADM-2026-011',
      church: 'Macedonia Fellowship, Trivandrum',
      gender: 'FEMALE',
      course: course3,
      batch: batch3,
      feePaid: 2100000,
      feeBalance: 0,
    },
    {
      name: 'Jonathan Gideon',
      phone: '+919811100012',
      email: 'jonathan.g@example.org',
      admissionNo: 'ADM-2026-012',
      church: 'Grace City Church, Ahmedabad',
      gender: 'MALE',
      course: course4,
      batch: batch4,
      feePaid: 1950000,
      feeBalance: 0,
    },
  ];

  let studentIndex = 0;
  for (const s of studentsRaw) {
    studentIndex++;
    const user = await prisma.user.upsert({
      where: { phoneE164: s.phone },
      update: { fullName: s.name, email: s.email },
      create: {
        phoneE164: s.phone,
        fullName: s.name,
        email: s.email,
        status: 'ACTIVE',
      },
    });

    const mem = await prisma.membership.upsert({
      where: {
        userId_instituteId_role: {
          userId: user.id,
          instituteId: institute.id,
          role: Role.STUDENT,
        },
      },
      update: { status: MembershipStatus.ACTIVE },
      create: {
        userId: user.id,
        instituteId: institute.id,
        role: Role.STUDENT,
        status: MembershipStatus.ACTIVE,
      },
    });

    const studentProfile = await prisma.studentProfile.upsert({
      where: { membershipId: mem.id },
      update: {
        admissionNo: s.admissionNo,
        church: s.church,
        gender: s.gender,
        status: 'ACTIVE',
      },
      create: {
        instituteId: institute.id,
        membershipId: mem.id,
        admissionNo: s.admissionNo,
        church: s.church,
        gender: s.gender,
        preferredLanguage: 'English',
        status: 'ACTIVE',
      },
    });

    // Enrolment
    const existingEnrolment = await prisma.enrolment.findFirst({
      where: {
        instituteId: institute.id,
        studentProfileId: studentProfile.id,
        courseId: s.course.id,
      },
    });

    if (!existingEnrolment) {
      await prisma.enrolment.create({
        data: {
          instituteId: institute.id,
          studentProfileId: studentProfile.id,
          courseId: s.course.id,
          batchId: s.batch.id,
          status: EnrolmentStatus.ACTIVE,
          source: EnrolmentSource.ADMIN,
        },
      });
    }

    // Invoices & Payments
    const invoiceNumber = `INV-2026-${String(studentIndex).padStart(4, '0')}`;
    const totalAmount = s.course.price;
    const paidAmount = s.feePaid;
    const balanceAmount = totalAmount - paidAmount;
    const invoiceStatus =
      balanceAmount === 0
        ? InvoiceStatus.PAID
        : paidAmount > 0
        ? InvoiceStatus.PARTIALLY_PAID
        : InvoiceStatus.ISSUED;

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        instituteId: institute.id,
        studentProfileId: studentProfile.id,
        invoiceNumber,
      },
    });

    let invoice = existingInvoice;
    if (!invoice) {
      invoice = await prisma.invoice.create({
        data: {
          instituteId: institute.id,
          studentProfileId: studentProfile.id,
          invoiceNumber,
          status: InvoiceStatus.DRAFT,
          issueDate: new Date('2026-09-01T09:00:00Z'),
          dueDate: new Date('2026-10-31T23:59:59Z'),
          totalAmount,
          paidAmount: 0,
          balanceAmount: totalAmount,
          currency: 'INR',
          notes: `Tuition fee for ${s.course.title}`,
          items: {
            create: {
              description: s.course.title,
              amount: totalAmount,
            },
          },
        },
      });

      // After items are added, set invoice status to ISSUED or PAID
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.ISSUED,
        },
      });
    }

    // FeePayment & FeeReceipt if paid
    if (paidAmount > 0 && invoice) {
      const paymentNumber = `PAY-2026-${String(studentIndex).padStart(4, '0')}`;
      const receiptNumber = `REC-2026-${String(studentIndex).padStart(4, '0')}`;

      const existingPayment = await prisma.feePayment.findFirst({
        where: { instituteId: institute.id, paymentNumber },
      });

      if (!existingPayment) {
        const modes = [FeePaymentMode.ONLINE, FeePaymentMode.BANK_TRANSFER, FeePaymentMode.ONLINE];
        const selectedMode = modes[(studentIndex - 1) % modes.length];

        const payment = await prisma.feePayment.create({
          data: {
            instituteId: institute.id,
            invoiceId: invoice.id,
            paymentNumber,
            amount: paidAmount,
            reversedAmount: 0,
            netAmount: paidAmount,
            paymentMode: selectedMode,
            status: FeePaymentStatus.COMPLETED,
            referenceNumber: `UTR-2026-${1000 + studentIndex}`,
            recordedByUserId: adminUser.id,
            paymentDate: new Date(Date.now() - studentIndex * 2 * 86400000),
            remarks: 'Verified online fee payment',
          },
        });

        await prisma.feeReceipt.create({
          data: {
            instituteId: institute.id,
            paymentId: payment.id,
            receiptNumber,
            issuedByUserId: adminUser.id,
          },
        });

        // Update invoice to reflect paid amounts
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount,
            balanceAmount,
            status: invoiceStatus,
          },
        });
      }
    }
  }
  console.log(`✓ 12 Students, Enrolments, Invoices & FeePayments configured`);

  // 10. Live Sessions and Attendance
  const leadTeacher = teacherProfiles[0];
  const existingSession1 = await prisma.liveSession.findFirst({
    where: { instituteId: institute.id, title: 'Hermeneutics: Covenantal Structures' },
  });

  const session1 = existingSession1 || (await prisma.liveSession.create({
    data: {
      instituteId: institute.id,
      batchId: batch1.id,
      teacherProfileId: leadTeacher.id,
      title: 'Hermeneutics: Covenantal Structures',
      startsAt: new Date('2026-10-25T10:00:00Z'),
      endsAt: new Date('2026-10-25T11:30:00Z'),
    },
  }));

  const existingSession2 = await prisma.liveSession.findFirst({
    where: { instituteId: institute.id, title: 'Redemptive Historical Trajectories' },
  });

  const session2 = existingSession2 || (await prisma.liveSession.create({
    data: {
      instituteId: institute.id,
      batchId: batch1.id,
      teacherProfileId: leadTeacher.id,
      title: 'Redemptive Historical Trajectories',
      startsAt: new Date('2026-10-28T10:00:00Z'),
      endsAt: new Date('2026-10-28T11:30:00Z'),
    },
  }));

  // Create attendance for students in batch1
  const batch1Students = await prisma.studentProfile.findMany({
    where: {
      instituteId: institute.id,
      enrolments: { some: { batchId: batch1.id } },
    },
  });

  for (const stu of batch1Students) {
    const existingAtt1 = await prisma.attendance.findFirst({
      where: {
        instituteId: institute.id,
        batchId: batch1.id,
        studentProfileId: stu.id,
        liveSessionId: session1.id,
      },
    });

    if (!existingAtt1) {
      await prisma.attendance.create({
        data: {
          instituteId: institute.id,
          batchId: batch1.id,
          studentProfileId: stu.id,
          liveSessionId: session1.id,
          date: new Date('2026-10-25'),
          mode: AttendanceMode.LIVE_SESSION,
          status: AttendanceStatus.PRESENT,
        },
      });
    }

    const existingAtt2 = await prisma.attendance.findFirst({
      where: {
        instituteId: institute.id,
        batchId: batch1.id,
        studentProfileId: stu.id,
        liveSessionId: session2.id,
      },
    });

    if (!existingAtt2) {
      await prisma.attendance.create({
        data: {
          instituteId: institute.id,
          batchId: batch1.id,
          studentProfileId: stu.id,
          liveSessionId: session2.id,
          date: new Date('2026-10-28'),
          mode: AttendanceMode.LIVE_SESSION,
          status: AttendanceStatus.PRESENT,
        },
      });
    }
  }
  console.log(`✓ Live Sessions & Student Attendance configured`);

  console.log('--- DATABASE SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('Seed script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
