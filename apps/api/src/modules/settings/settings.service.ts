import {
  Injectable,
  Optional,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  UpdateInstituteProfileDto,
  UpdateBrandingDto,
  UpdateAcademicSettingsDto,
  UpdateFinancialSettingsDto,
  UpdateSecurityPreferencesDto,
  UpdateUserStatusDto,
  UpdatePaymentGatewayDto,
} from './settings.dto';
import {
  encryptRazorpayCredentials,
  resolveRazorpayConfig,
} from '../../common/razorpay-crypto.util';
import { Role, MembershipStatus } from '@prisma/client';

export interface InstituteProfileData {
  name: string;
  displayName: string;
  code: string;
  registrationNumber?: string;
  description?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  primaryContactName?: string;
  timezone: string;
  status: string;
}

export interface InstituteBrandingData {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  displayName?: string;
}

export interface AcademicSettingsData {
  currentAcademicYearId?: string | null;
  currentAcademicYearName?: string | null;
  currentAcademicTermId?: string | null;
  currentAcademicTermName?: string | null;
  timezone: string;
  workingDays: string[];
  defaultSessionDurationMinutes: number;
  minAttendancePercentage: number;
  academicCalendarType: string;
  availableYears: Array<{ id: string; name: string; isCurrent: boolean }>;
  availableTerms: Array<{ id: string; name: string; isCurrent: boolean; academicYearId: string }>;
}

export interface FinancialSettingsData {
  currency: string;
  invoicePrefix: string;
  receiptPrefix: string;
  defaultDueDays: number;
  financialContactEmail?: string;
  financialContactPhone?: string;
  billingAddress?: string;
  taxOrGstNumber?: string;
  showInstituteLogoOnInvoice: boolean;
}

export interface SecurityPreferencesData {
  sessionTimeoutMinutes: number;
  studentSelfRegistration: boolean;
  notifyOnStudentRegistration: boolean;
  notifyOnFeePayment: boolean;
  notifyOnAttendanceAlert: boolean;
  notifyOnTeacherManagement: boolean;
  notifyOnAcademicActivity: boolean;
  notifyOnAdminSecurity: boolean;
}

export interface FullInstituteSettingsResponse {
  profile: InstituteProfileData;
  branding: InstituteBrandingData;
  academic: AcademicSettingsData;
  financial: FinancialSettingsData;
  security: SecurityPreferencesData;
}

const DEFAULT_BRANDING: InstituteBrandingData = {
  primaryColor: '#2563eb',
  secondaryColor: '#1e2235',
  accentColor: '#10b981',
};

const DEFAULT_WORKING_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * Helper to verify target institute exists and return it.
   */
  private async findInstituteOrThrow(instituteId: string) {
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      include: {
        settings: true,
      },
    });

    if (!institute) {
      throw new NotFoundException(`Institute with ID ${instituteId} not found`);
    }

    return institute;
  }

  /**
   * Helper to ensure an InstituteSettings record exists.
   */
  private async ensureSettingsRecord(instituteId: string) {
    let settings = await this.prisma.instituteSettings.findUnique({
      where: { instituteId },
    });

    if (!settings) {
      settings = await this.prisma.instituteSettings.create({
        data: {
          instituteId,
          branding: DEFAULT_BRANDING as any,
          enrolmentRules: {
            workingDays: DEFAULT_WORKING_DAYS,
            defaultSessionDurationMinutes: 60,
            minAttendancePercentage: 75,
            academicCalendarType: 'SEMESTER',
          },
          notificationConfig: {
            sessionTimeoutMinutes: 60,
            notifyOnStudentRegistration: true,
            notifyOnFeePayment: true,
            notifyOnAttendanceAlert: true,
          },
        },
      });
    }

    return settings;
  }

  /**
   * Log administrative audit events.
   */
  private async logAuditEvent(
    instituteId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: any,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorUserId,
          action,
          entityType,
          entityId,
          metadata: metadata || {},
        },
      });
    } catch (err) {
      // Non-blocking for resilience
      console.warn('AuditLog creation notice:', err);
    }
  }

  /**
   * Get all consolidated settings for the institute.
   */
  async getSettings(instituteId: string): Promise<FullInstituteSettingsResponse> {
    const institute = await this.findInstituteOrThrow(instituteId);
    const settings = await this.ensureSettingsRecord(instituteId);

    // Fetch academic years & terms
    const [years, terms] = await Promise.all([
      this.prisma.academicYear.findMany({
        where: { instituteId },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, isCurrent: true },
      }),
      this.prisma.academicTerm.findMany({
        where: { instituteId },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, isCurrent: true, academicYearId: true },
      }),
    ]);

    const currentYear = years.find((y) => y.isCurrent) || null;
    const currentTerm = terms.find((t) => t.isCurrent) || null;

    // Parse JSON configurations safely
    const brandingJson = (settings.branding as any) || {};
    const enrolmentJson = (settings.enrolmentRules as any) || {};
    const notificationJson = (settings.notificationConfig as any) || {};
    const profileJson = enrolmentJson.profile || {};
    const financialJson = enrolmentJson.financialPreferences || {};

    const profile: InstituteProfileData = {
      name: institute.name,
      displayName: profileJson.displayName || brandingJson.displayName || institute.name,
      code: institute.slug,
      registrationNumber: profileJson.registrationNumber || '',
      description: profileJson.description || '',
      email: profileJson.email || '',
      phone: profileJson.phone || '',
      alternatePhone: profileJson.alternatePhone || '',
      website: profileJson.website || '',
      address: profileJson.address || '',
      city: profileJson.city || '',
      state: profileJson.state || '',
      country: profileJson.country || 'India',
      postalCode: profileJson.postalCode || '',
      primaryContactName: profileJson.primaryContactName || '',
      timezone: institute.timezone,
      status: institute.status,
    };

    const branding: InstituteBrandingData = {
      logoUrl: institute.logoUrl || brandingJson.logoUrl || undefined,
      faviconUrl: brandingJson.faviconUrl || undefined,
      primaryColor: brandingJson.primaryColor || DEFAULT_BRANDING.primaryColor,
      secondaryColor: brandingJson.secondaryColor || DEFAULT_BRANDING.secondaryColor,
      accentColor: brandingJson.accentColor || DEFAULT_BRANDING.accentColor,
      displayName: brandingJson.displayName || profile.displayName,
    };

    const academic: AcademicSettingsData = {
      currentAcademicYearId: currentYear?.id || null,
      currentAcademicYearName: currentYear?.name || null,
      currentAcademicTermId: currentTerm?.id || null,
      currentAcademicTermName: currentTerm?.name || null,
      timezone: institute.timezone,
      workingDays: enrolmentJson.workingDays || DEFAULT_WORKING_DAYS,
      defaultSessionDurationMinutes: enrolmentJson.defaultSessionDurationMinutes || 60,
      minAttendancePercentage: enrolmentJson.minAttendancePercentage || 75,
      academicCalendarType: enrolmentJson.academicCalendarType || 'SEMESTER',
      availableYears: years,
      availableTerms: terms,
    };

    const financial: FinancialSettingsData = {
      currency: institute.currency || 'INR',
      invoicePrefix: financialJson.invoicePrefix || 'INV',
      receiptPrefix: financialJson.receiptPrefix || 'RCP',
      defaultDueDays: financialJson.defaultDueDays || 15,
      financialContactEmail: financialJson.financialContactEmail || profile.email || '',
      financialContactPhone: financialJson.financialContactPhone || profile.phone || '',
      billingAddress: financialJson.billingAddress || profile.address || '',
      taxOrGstNumber: financialJson.taxOrGstNumber || '',
      showInstituteLogoOnInvoice: financialJson.showInstituteLogoOnInvoice !== false,
    };

    const security: SecurityPreferencesData = {
      sessionTimeoutMinutes: notificationJson.sessionTimeoutMinutes || 60,
      studentSelfRegistration: settings.studentSelfRegistration,
      notifyOnStudentRegistration: notificationJson.notifyOnStudentRegistration !== false,
      notifyOnFeePayment: notificationJson.notifyOnFeePayment !== false,
      notifyOnAttendanceAlert: notificationJson.notifyOnAttendanceAlert !== false,
      notifyOnTeacherManagement: notificationJson.notifyOnTeacherManagement !== false,
      notifyOnAcademicActivity: notificationJson.notifyOnAcademicActivity !== false,
      notifyOnAdminSecurity: notificationJson.notifyOnAdminSecurity !== false,
    };

    return {
      profile,
      branding,
      academic,
      financial,
      security,
    };
  }

  /**
   * Update Institute Profile information.
   */
  async updateProfile(
    instituteId: string,
    dto: UpdateInstituteProfileDto,
    actorUserId: string,
  ): Promise<InstituteProfileData> {
    const institute = await this.findInstituteOrThrow(instituteId);
    const settings = await this.ensureSettingsRecord(instituteId);

    const existingEnrolment = (settings.enrolmentRules as any) || {};
    const existingProfile = existingEnrolment.profile || {};

    const updatedProfile = {
      ...existingProfile,
      displayName: dto.displayName ?? existingProfile.displayName ?? dto.name,
      registrationNumber: dto.registrationNumber ?? existingProfile.registrationNumber,
      description: dto.description ?? existingProfile.description,
      email: dto.email ?? existingProfile.email,
      phone: dto.phone ?? existingProfile.phone,
      alternatePhone: dto.alternatePhone ?? existingProfile.alternatePhone,
      website: dto.website ?? existingProfile.website,
      address: dto.address ?? existingProfile.address,
      city: dto.city ?? existingProfile.city,
      state: dto.state ?? existingProfile.state,
      country: dto.country ?? existingProfile.country ?? 'India',
      postalCode: dto.postalCode ?? existingProfile.postalCode,
      primaryContactName: dto.primaryContactName ?? existingProfile.primaryContactName,
    };

    // Update institute name and timezone if changed
    await this.prisma.institute.update({
      where: { id: instituteId },
      data: {
        name: dto.name,
        timezone: dto.timezone || institute.timezone,
      },
    });

    // Update profile in settings
    await this.prisma.instituteSettings.update({
      where: { instituteId },
      data: {
        enrolmentRules: {
          ...existingEnrolment,
          profile: updatedProfile,
        },
      },
    });

    await this.logAuditEvent(
      instituteId,
      actorUserId,
      'UPDATE_INSTITUTE_PROFILE',
      'Institute',
      instituteId,
      { updatedFields: Object.keys(dto) },
    );

    if (this.notificationsService) {
      await this.notificationsService
        .emitAdminEvent(instituteId, {
          eventType: 'SETTINGS_UPDATED',
          title: 'Institute Profile Updated',
          body: `Institute profile settings for "${dto.name}" were updated.`,
          link: '/admin/settings',
        })
        .catch(() => {});
    }

    return {
      name: dto.name,
      displayName: updatedProfile.displayName,
      code: institute.slug,
      registrationNumber: updatedProfile.registrationNumber,
      description: updatedProfile.description,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      alternatePhone: updatedProfile.alternatePhone,
      website: updatedProfile.website,
      address: updatedProfile.address,
      city: updatedProfile.city,
      state: updatedProfile.state,
      country: updatedProfile.country,
      postalCode: updatedProfile.postalCode,
      primaryContactName: updatedProfile.primaryContactName,
      timezone: dto.timezone || institute.timezone,
      status: institute.status,
    };
  }

  /**
   * Update Institute Branding (colors, logo, favicon, display name).
   */
  async updateBranding(
    instituteId: string,
    dto: UpdateBrandingDto,
    actorUserId: string,
  ): Promise<InstituteBrandingData> {
    await this.findInstituteOrThrow(instituteId);
    const settings = await this.ensureSettingsRecord(instituteId);

    const existingBranding = (settings.branding as any) || {};

    const updatedBranding: InstituteBrandingData = {
      primaryColor: dto.primaryColor,
      secondaryColor: dto.secondaryColor,
      accentColor: dto.accentColor,
      logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : existingBranding.logoUrl,
      faviconUrl: dto.faviconUrl !== undefined ? dto.faviconUrl : existingBranding.faviconUrl,
      displayName: dto.displayName || existingBranding.displayName,
    };

    // Keep Institute.logoUrl in sync
    if (dto.logoUrl !== undefined) {
      await this.prisma.institute.update({
        where: { id: instituteId },
        data: { logoUrl: dto.logoUrl || null },
      });
    }

    await this.prisma.instituteSettings.update({
      where: { instituteId },
      data: {
        branding: updatedBranding as any,
      },
    });

    await this.logAuditEvent(
      instituteId,
      actorUserId,
      'UPDATE_INSTITUTE_BRANDING',
      'InstituteSettings',
      instituteId,
      { branding: updatedBranding },
    );

    if (this.notificationsService) {
      await this.notificationsService
        .emitAdminEvent(instituteId, {
          eventType: 'BRANDING_UPDATED',
          title: 'Institute Branding Updated',
          body: `Portal theme colors and branding preferences were updated.`,
          link: '/admin/settings',
        })
        .catch(() => {});
    }

    return updatedBranding;
  }

  /**
   * Reset branding to default system theme.
   */
  async resetBranding(
    instituteId: string,
    actorUserId: string,
  ): Promise<InstituteBrandingData> {
    await this.findInstituteOrThrow(instituteId);
    await this.ensureSettingsRecord(instituteId);

    await this.prisma.institute.update({
      where: { id: instituteId },
      data: { logoUrl: null },
    });

    await this.prisma.instituteSettings.update({
      where: { instituteId },
      data: {
        branding: DEFAULT_BRANDING as any,
      },
    });

    await this.logAuditEvent(
      instituteId,
      actorUserId,
      'RESET_INSTITUTE_BRANDING',
      'InstituteSettings',
      instituteId,
      { action: 'RESET_TO_DEFAULT' },
    );

    return DEFAULT_BRANDING;
  }

  /**
   * Update Academic Preferences and current Academic Year / Term.
   */
  async updateAcademicSettings(
    instituteId: string,
    dto: UpdateAcademicSettingsDto,
    actorUserId: string,
  ): Promise<AcademicSettingsData> {
    await this.findInstituteOrThrow(instituteId);
    const settings = await this.ensureSettingsRecord(instituteId);

    // If current year changed, set isCurrent atomically
    if (dto.currentAcademicYearId) {
      const targetYear = await this.prisma.academicYear.findFirst({
        where: { id: dto.currentAcademicYearId, instituteId },
      });
      if (!targetYear) {
        throw new BadRequestException('Selected academic year does not belong to this institute');
      }

      await this.prisma.$transaction([
        this.prisma.academicYear.updateMany({
          where: { instituteId, isCurrent: true },
          data: { isCurrent: false },
        }),
        this.prisma.academicYear.update({
          where: { id: dto.currentAcademicYearId },
          data: { isCurrent: true },
        }),
      ]);
    }

    // If current term changed, set isCurrent atomically
    if (dto.currentAcademicTermId) {
      const targetTerm = await this.prisma.academicTerm.findFirst({
        where: { id: dto.currentAcademicTermId, instituteId },
      });
      if (!targetTerm) {
        throw new BadRequestException('Selected academic term does not belong to this institute');
      }

      await this.prisma.$transaction([
        this.prisma.academicTerm.updateMany({
          where: { instituteId, isCurrent: true },
          data: { isCurrent: false },
        }),
        this.prisma.academicTerm.update({
          where: { id: dto.currentAcademicTermId },
          data: { isCurrent: true },
        }),
      ]);
    }

    // Update timezone on institute if provided
    if (dto.timezone) {
      await this.prisma.institute.update({
        where: { id: instituteId },
        data: { timezone: dto.timezone },
      });
    }

    // Update academic preferences in enrolmentRules
    const existingEnrolment = (settings.enrolmentRules as any) || {};
    const updatedEnrolment = {
      ...existingEnrolment,
      workingDays: dto.workingDays || existingEnrolment.workingDays || DEFAULT_WORKING_DAYS,
      defaultSessionDurationMinutes:
        dto.defaultSessionDurationMinutes || existingEnrolment.defaultSessionDurationMinutes || 60,
      minAttendancePercentage:
        dto.minAttendancePercentage !== undefined
          ? dto.minAttendancePercentage
          : existingEnrolment.minAttendancePercentage || 75,
      academicCalendarType:
        dto.academicCalendarType || existingEnrolment.academicCalendarType || 'SEMESTER',
    };

    await this.prisma.instituteSettings.update({
      where: { instituteId },
      data: {
        enrolmentRules: updatedEnrolment,
      },
    });

    await this.logAuditEvent(
      instituteId,
      actorUserId,
      'UPDATE_ACADEMIC_SETTINGS',
      'InstituteSettings',
      instituteId,
      { updatedFields: Object.keys(dto) },
    );

    const full = await this.getSettings(instituteId);
    return full.academic;
  }

  /**
   * Update Financial Settings (currency, invoice/receipt display, billing contacts).
   */
  async updateFinancialSettings(
    instituteId: string,
    dto: UpdateFinancialSettingsDto,
    actorUserId: string,
  ): Promise<FinancialSettingsData> {
    await this.findInstituteOrThrow(instituteId);
    const settings = await this.ensureSettingsRecord(instituteId);

    if (dto.currency) {
      await this.prisma.institute.update({
        where: { id: instituteId },
        data: { currency: dto.currency },
      });
    }

    const existingEnrolment = (settings.enrolmentRules as any) || {};
    const existingFinancial = existingEnrolment.financialPreferences || {};

    const updatedFinancial = {
      ...existingFinancial,
      invoicePrefix: dto.invoicePrefix ?? existingFinancial.invoicePrefix ?? 'INV',
      receiptPrefix: dto.receiptPrefix ?? existingFinancial.receiptPrefix ?? 'RCP',
      defaultDueDays: dto.defaultDueDays ?? existingFinancial.defaultDueDays ?? 15,
      financialContactEmail: dto.financialContactEmail ?? existingFinancial.financialContactEmail,
      financialContactPhone: dto.financialContactPhone ?? existingFinancial.financialContactPhone,
      billingAddress: dto.billingAddress ?? existingFinancial.billingAddress,
      taxOrGstNumber: dto.taxOrGstNumber ?? existingFinancial.taxOrGstNumber,
      showInstituteLogoOnInvoice:
        dto.showInstituteLogoOnInvoice !== undefined
          ? dto.showInstituteLogoOnInvoice
          : existingFinancial.showInstituteLogoOnInvoice !== false,
    };

    await this.prisma.instituteSettings.update({
      where: { instituteId },
      data: {
        enrolmentRules: {
          ...existingEnrolment,
          financialPreferences: updatedFinancial,
        },
      },
    });

    await this.logAuditEvent(
      instituteId,
      actorUserId,
      'UPDATE_FINANCIAL_SETTINGS',
      'InstituteSettings',
      instituteId,
      { updatedFields: Object.keys(dto) },
    );

    const full = await this.getSettings(instituteId);
    return full.financial;
  }

  /**
   * Update Security & Notification Preferences.
   */
  async updateSecurityPreferences(
    instituteId: string,
    dto: UpdateSecurityPreferencesDto,
    actorUserId: string,
  ): Promise<SecurityPreferencesData> {
    await this.findInstituteOrThrow(instituteId);
    const settings = await this.ensureSettingsRecord(instituteId);

    const existingNotification = (settings.notificationConfig as any) || {};
    const updatedNotification = {
      ...existingNotification,
      sessionTimeoutMinutes:
        dto.sessionTimeoutMinutes ?? existingNotification.sessionTimeoutMinutes ?? 60,
      notifyOnStudentRegistration:
        dto.notifyOnStudentRegistration ?? existingNotification.notifyOnStudentRegistration ?? true,
      notifyOnFeePayment:
        dto.notifyOnFeePayment ?? existingNotification.notifyOnFeePayment ?? true,
      notifyOnAttendanceAlert:
        dto.notifyOnAttendanceAlert ?? existingNotification.notifyOnAttendanceAlert ?? true,
      notifyOnTeacherManagement:
        dto.notifyOnTeacherManagement ?? existingNotification.notifyOnTeacherManagement ?? true,
      notifyOnAcademicActivity:
        dto.notifyOnAcademicActivity ?? existingNotification.notifyOnAcademicActivity ?? true,
      notifyOnAdminSecurity:
        dto.notifyOnAdminSecurity ?? existingNotification.notifyOnAdminSecurity ?? true,
    };

    const updateData: any = {
      notificationConfig: updatedNotification,
    };

    if (dto.studentSelfRegistration !== undefined) {
      updateData.studentSelfRegistration = dto.studentSelfRegistration;
    }

    await this.prisma.instituteSettings.update({
      where: { instituteId },
      data: updateData,
    });

    await this.logAuditEvent(
      instituteId,
      actorUserId,
      'UPDATE_SECURITY_PREFERENCES',
      'InstituteSettings',
      instituteId,
      { updatedFields: Object.keys(dto) },
    );

    const full = await this.getSettings(instituteId);
    return full.security;
  }

  /**
   * List users belonging to this institute (Users & Access section).
   */
  async getUsers(
    instituteId: string,
    query?: { role?: string; status?: string; search?: string },
  ) {
    await this.findInstituteOrThrow(instituteId);

    const whereClause: any = { instituteId };

    if (query?.role) {
      whereClause.role = query.role as Role;
    }

    if (query?.status) {
      whereClause.status = query.status as MembershipStatus;
    }

    if (query?.search) {
      whereClause.user = {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phoneE164: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const memberships = await this.prisma.membership.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneE164: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return memberships.map((m) => ({
      id: m.userId,
      membershipId: m.id,
      fullName: m.user.fullName,
      email: m.user.email,
      phone: m.user.phoneE164,
      role: m.role,
      status: m.status,
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Update membership status (activate / suspend access) for an institute user.
   * Prohibits altering SUPER_ADMIN roles or cross-tenant users.
   */
  async updateUserStatus(
    instituteId: string,
    membershipId: string,
    status: 'ACTIVE' | 'INVITED' | 'SUSPENDED',
    actorUserId: string,
    actorRole: string,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, instituteId },
      include: { user: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership record not found in this institute');
    }

    if (membership.role === Role.SUPER_ADMIN && actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot modify Super Admin membership');
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { status: status as MembershipStatus },
    });

    await this.logAuditEvent(
      instituteId,
      actorUserId,
      'UPDATE_USER_MEMBERSHIP_STATUS',
      'Membership',
      membershipId,
      { targetUserId: membership.userId, newStatus: status },
    );

    if (this.notificationsService) {
      await this.notificationsService
        .emitAdminEvent(instituteId, {
          eventType: 'USER_ACCESS_CHANGED',
          referenceId: `${membershipId}:${status}:${Date.now()}`,
          title: 'User Access Status Updated',
          body: `Access for ${membership.user.fullName} (${membership.role}) was changed to ${status}.`,
          link: '/admin/settings',
        })
        .catch(() => {});
    }

    return {
      membershipId: updated.id,
      userId: updated.userId,
      status: updated.status,
      message: `User status successfully updated to ${status}`,
    };
  }

  /**
   * Get administrative audit logs for the institute.
   */
  async getAuditLogs(instituteId: string, limit: number = 25) {
    await this.findInstituteOrThrow(instituteId);

    const logs = await this.prisma.auditLog.findMany({
      where: { instituteId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return logs;
  }

  /**
   * Return masked Razorpay gateway status without exposing secrets.
   */
  async getPaymentGatewaySettings(instituteId: string) {
    await this.findInstituteOrThrow(instituteId);
    const settings = await this.prisma.instituteSettings.findUnique({
      where: { instituteId },
    });

    const config = resolveRazorpayConfig(settings?.razorpayKeyEncrypted);
    const maskedKeyId = config.keyId
      ? `${config.keyId.slice(0, 12)}...${config.keyId.slice(-4)}`
      : null;

    return {
      configured: config.mode !== 'UNCONFIGURED',
      mode: config.mode,
      keyIdPreview: maskedKeyId,
      hasWebhookSecret: Boolean(config.webhookSecret),
      source: settings?.razorpayKeyEncrypted ? 'INSTITUTE_ENCRYPTED' : config.keyId ? 'ENVIRONMENT' : 'NONE',
    };
  }

  /**
   * Encrypt and store per-institute Razorpay credentials in InstituteSettings.razorpayKeyEncrypted.
   */
  async updatePaymentGatewaySettings(
    instituteId: string,
    dto: UpdatePaymentGatewayDto,
    actorUserId: string,
  ) {
    await this.findInstituteOrThrow(instituteId);

    const keyId = dto.keyId?.trim();
    const keySecret = dto.keySecret?.trim();
    const webhookSecret = dto.webhookSecret?.trim();

    if (!keyId || !/^rzp_(test|live)_/.test(keyId)) {
      throw new BadRequestException('Invalid Razorpay Key ID format.');
    }
    if (!keySecret || keySecret.length < 8) {
      throw new BadRequestException('Razorpay Key Secret must be at least 8 characters.');
    }

    const encrypted = encryptRazorpayCredentials({
      keyId,
      keySecret,
      ...(webhookSecret ? { webhookSecret } : {}),
    });

    await this.prisma.instituteSettings.upsert({
      where: { instituteId },
      create: {
        instituteId,
        razorpayKeyEncrypted: encrypted,
      },
      update: {
        razorpayKeyEncrypted: encrypted,
      },
    });

    await this.logAuditEvent(
      instituteId,
      actorUserId,
      'UPDATE_PAYMENT_GATEWAY',
      'InstituteSettings',
      instituteId,
      {
        mode: keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST',
        hasWebhookSecret: Boolean(webhookSecret),
      },
    );

    return {
      configured: true,
      mode: keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST',
      keyIdPreview: `${keyId.slice(0, 12)}...${keyId.slice(-4)}`,
      hasWebhookSecret: Boolean(webhookSecret),
      source: 'INSTITUTE_ENCRYPTED',
    };
  }
}

