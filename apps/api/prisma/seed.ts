import { PrismaClient, Role, CourseLevel, PricingType, CourseStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Bible Learning Institute Database...');

  // 1. Create Default Institute
  const institute = await prisma.institute.upsert({
    where: { slug: 'berean-bible' },
    update: {},
    create: {
      name: 'Berean Bible Institute',
      slug: 'berean-bible',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      settings: {
        create: {
          studentSelfRegistration: true,
          branding: {
            primaryColor: '#2563EB',
            accentColor: '#1E2235',
          },
        },
      },
    },
  });

  console.log(`Created Institute: ${institute.name} (${institute.id})`);

  // 2. Create Default Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_CAMPUS' },
    update: {},
    create: {
      code: 'PRO_CAMPUS',
      name: 'Pro Campus Plan',
      priceMonthly: 990000, // ₹9,900
      priceYearly: 9900000, // ₹99,000
      maxStudents: 500,
      maxTeachers: 25,
      maxCourses: 50,
      storageGb: 50,
    },
  });

  // 3. Create Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { phoneE164: '+919999900000' },
    update: {},
    create: {
      phoneE164: '+919999900000',
      fullName: 'Global Platform Admin',
      email: 'superadmin@bible-lms.platform',
      status: 'ACTIVE',
      memberships: {
        create: {
          role: Role.SUPER_ADMIN,
        },
      },
    },
  });

  // 4. Create Institute Admin
  const adminUser = await prisma.user.upsert({
    where: { phoneE164: '+919876500001' },
    update: {},
    create: {
      phoneE164: '+919876500001',
      fullName: 'Samuel Admin',
      email: 'admin@bible-institute.org',
      status: 'ACTIVE',
      memberships: {
        create: {
          instituteId: institute.id,
          role: Role.INSTITUTE_ADMIN,
        },
      },
    },
  });

  // 5. Create Teachers
  const teacherData = [
    {
      name: 'Dr. Samuel Mathew',
      phone: '+919876500002',
      email: 'samuel.m@example.com',
      spec: 'Theology & Hermeneutics',
      code: 'FAC-001',
    },
    {
      name: 'Dr. Mary Thomas',
      phone: '+919876500003',
      email: 'mary.t@example.com',
      spec: 'Biblical Studies & Exegesis',
      code: 'FAC-002',
    },
    {
      name: 'Rev. Joseph David',
      phone: '+919876500004',
      email: 'joseph.d@example.com',
      spec: 'Church History & Pastoral Care',
      code: 'FAC-003',
    },
  ];

  for (const t of teacherData) {
    const user = await prisma.user.upsert({
      where: { phoneE164: t.phone },
      update: {},
      create: {
        phoneE164: t.phone,
        fullName: t.name,
        email: t.email,
        memberships: {
          create: {
            instituteId: institute.id,
            role: Role.TEACHER,
            teacherProfile: {
              create: {
                instituteId: institute.id,
                employeeCode: t.code,
                specialization: t.spec,
              },
            },
          },
        },
      },
    });
  }

  // 6. Create Course Categories
  const theologyCat = await prisma.courseCategory.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'theology' } },
    update: {},
    create: {
      instituteId: institute.id,
      name: 'Biblical Theology',
      slug: 'theology',
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

  // 7. Create Courses
  const course1 = await prisma.course.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'biblical-theology' } },
    update: {},
    create: {
      instituteId: institute.id,
      categoryId: theologyCat.id,
      title: 'Building Biblical Theology',
      slug: 'biblical-theology',
      description: 'A comprehensive study of redemptive history, covenants, and biblical theology.',
      level: CourseLevel.BEGINNER,
      price: 1850000, // ₹18,500
      pricing: PricingType.PAID,
      status: CourseStatus.PUBLISHED,
    },
  });

  const course2 = await prisma.course.upsert({
    where: { instituteId_slug: { instituteId: institute.id, slug: 'church-history' } },
    update: {},
    create: {
      instituteId: institute.id,
      categoryId: historyCat.id,
      title: 'Church History: Reformation to Modern',
      slug: 'church-history',
      description: 'Surveying major turning points in the Christian church and historical theology.',
      level: CourseLevel.INTERMEDIATE,
      price: 1600000, // ₹16,000
      pricing: PricingType.PAID,
      status: CourseStatus.PUBLISHED,
    },
  });

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
