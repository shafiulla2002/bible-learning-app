import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class UpdateInstituteProfileDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  primaryContactName?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'primaryColor must be a valid hex color code (e.g. #2563eb)',
  })
  primaryColor: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'secondaryColor must be a valid hex color code (e.g. #1e2235)',
  })
  secondaryColor: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'accentColor must be a valid hex color code (e.g. #10b981)',
  })
  accentColor: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class UpdateAcademicSettingsDto {
  @IsOptional()
  @IsString()
  currentAcademicYearId?: string;

  @IsOptional()
  @IsString()
  currentAcademicTermId?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  workingDays?: string[];

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(360)
  defaultSessionDurationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minAttendancePercentage?: number;

  @IsOptional()
  @IsString()
  academicCalendarType?: string;
}

export class UpdateFinancialSettingsDto {
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  receiptPrefix?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  defaultDueDays?: number;

  @IsOptional()
  @IsEmail()
  financialContactEmail?: string;

  @IsOptional()
  @IsString()
  financialContactPhone?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsString()
  taxOrGstNumber?: string;

  @IsOptional()
  @IsBoolean()
  showInstituteLogoOnInvoice?: boolean;
}

export class UpdateSecurityPreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  sessionTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  studentSelfRegistration?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnStudentRegistration?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnFeePayment?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnAttendanceAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnTeacherManagement?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnAcademicActivity?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnAdminSecurity?: boolean;
}

export class UpdateUserStatusDto {
  @IsString()
  @Matches(/^(ACTIVE|INVITED|SUSPENDED)$/, {
    message: 'status must be ACTIVE, INVITED, or SUSPENDED',
  })
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
}

export class UpdatePaymentGatewayDto {
  @IsString()
  @Matches(/^rzp_(test|live)_[A-Za-z0-9]+$/, {
    message: 'keyId must be a valid Razorpay Key ID starting with rzp_test_ or rzp_live_',
  })
  keyId: string;

  @IsString()
  keySecret: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}

