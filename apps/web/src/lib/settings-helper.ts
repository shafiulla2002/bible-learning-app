import { queryDb } from '@/lib/server-db';

export async function buildFullSettingsResponse(instituteId: string) {
  const instRows = await queryDb(
    `SELECT
       i.id, i.name, i.slug, i.status, i.timezone, i.currency, i."logoUrl",
       s.branding, s."enrolmentRules", s."notificationConfig", s."studentSelfRegistration"
     FROM "Institute" i
     LEFT JOIN "InstituteSettings" s ON s."instituteId" = i.id
     WHERE i.id = $1`,
    [instituteId]
  );

  const inst = instRows[0] || {
    id: instituteId,
    name: 'Grace Bible Institute',
    slug: 'grace-bible-inst',
    status: 'ACTIVE',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    logoUrl: null,
    branding: {},
    enrolmentRules: {},
    notificationConfig: {},
    studentSelfRegistration: true,
  };

  const brandingJson = (inst.branding as any) || {};
  const rulesJson = (inst.enrolmentRules as any) || {};
  const notifJson = (inst.notificationConfig as any) || {};
  const profileMeta = rulesJson.profileMeta || {};
  const financialMeta = rulesJson.financialMeta || {};

  const years = await queryDb(
    `SELECT id, name, "isCurrent" FROM "AcademicYear" WHERE "instituteId" = $1 ORDER BY "startDate" DESC`,
    [instituteId]
  );
  const terms = await queryDb(
    `SELECT id, name, "isCurrent", "academicYearId" FROM "AcademicTerm" WHERE "instituteId" = $1 ORDER BY "startDate" ASC`,
    [instituteId]
  );

  const currentYear = years.find((y) => y.isCurrent) || years[0];
  const currentTerm = terms.find((t) => t.isCurrent) || terms[0];

  return {
    profile: {
      name: inst.name,
      displayName: brandingJson.displayName || inst.name,
      code: inst.slug,
      registrationNumber: profileMeta.registrationNumber || 'REG-THEO-2026-001',
      description:
        profileMeta.description ||
        'Dedicated to providing orthodox theological education, ministry leadership training, and biblical language studies.',
      email: profileMeta.email || 'admin@gracebible.edu',
      phone: profileMeta.phone || '+91 98765 43210',
      alternatePhone: profileMeta.alternatePhone || '',
      website: profileMeta.website || 'https://gracebible.edu',
      address: profileMeta.address || '42 Grace Campus, Seminary Road',
      city: profileMeta.city || 'Bangalore',
      state: profileMeta.state || 'Karnataka',
      country: profileMeta.country || 'India',
      postalCode: profileMeta.postalCode || '560066',
      primaryContactName: profileMeta.primaryContactName || 'Institute Principal',
      timezone: inst.timezone || 'Asia/Kolkata',
      status: inst.status || 'ACTIVE',
    },
    branding: {
      logoUrl: inst.logoUrl || brandingJson.logoUrl || '',
      primaryColor: brandingJson.primaryColor || '#2563eb',
      secondaryColor: brandingJson.secondaryColor || '#1e2235',
      accentColor: brandingJson.accentColor || '#10b981',
      displayName: brandingJson.displayName || inst.name,
    },
    academic: {
      currentAcademicYearId: currentYear?.id || null,
      currentAcademicYearName: currentYear?.name || null,
      currentAcademicTermId: currentTerm?.id || null,
      currentAcademicTermName: currentTerm?.name || null,
      timezone: inst.timezone || 'Asia/Kolkata',
      workingDays: rulesJson.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      defaultSessionDurationMinutes: rulesJson.defaultSessionDurationMinutes || 60,
      minAttendancePercentage: rulesJson.minAttendancePercentage || 75,
      academicCalendarType: rulesJson.academicCalendarType || 'SEMESTER',
      availableYears: years,
      availableTerms: terms,
    },
    financial: {
      currency: inst.currency || 'INR',
      invoicePrefix: financialMeta.invoicePrefix || 'INV-2026',
      receiptPrefix: financialMeta.receiptPrefix || 'REC-2026',
      defaultDueDays: financialMeta.defaultDueDays || 15,
      financialContactEmail: financialMeta.financialContactEmail || 'bursar@gracebible.edu',
      financialContactPhone: financialMeta.financialContactPhone || '+91 98765 43219',
      billingAddress: financialMeta.billingAddress || 'Bursar Office, Grace Campus',
      taxOrGstNumber: financialMeta.taxOrGstNumber || '',
      showInstituteLogoOnInvoice:
        financialMeta.showInstituteLogoOnInvoice !== undefined
          ? financialMeta.showInstituteLogoOnInvoice
          : true,
    },
    security: {
      sessionTimeoutMinutes: notifJson.sessionTimeoutMinutes || 60,
      studentSelfRegistration: Boolean(inst.studentSelfRegistration),
      notifyOnStudentRegistration:
        notifJson.notifyOnStudentRegistration !== undefined ? notifJson.notifyOnStudentRegistration : true,
      notifyOnFeePayment: notifJson.notifyOnFeePayment !== undefined ? notifJson.notifyOnFeePayment : true,
      notifyOnAttendanceAlert:
        notifJson.notifyOnAttendanceAlert !== undefined ? notifJson.notifyOnAttendanceAlert : true,
      notifyOnTeacherManagement:
        notifJson.notifyOnTeacherManagement !== undefined ? notifJson.notifyOnTeacherManagement : true,
      notifyOnAcademicActivity:
        notifJson.notifyOnAcademicActivity !== undefined ? notifJson.notifyOnAcademicActivity : true,
      notifyOnAdminSecurity:
        notifJson.notifyOnAdminSecurity !== undefined ? notifJson.notifyOnAdminSecurity : true,
    },
  };
}

