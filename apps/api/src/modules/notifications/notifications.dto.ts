import {
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export const NOTIFICATION_CATEGORIES = [
  'STUDENT',
  'TEACHER',
  'ATTENDANCE',
  'FEE',
  'ACADEMIC',
  'ADMIN',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export class NotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 15;

  @IsOptional()
  @IsString()
  @IsIn(['ALL', ...NOTIFICATION_CATEGORIES])
  category?: 'ALL' | NotificationCategory;

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'UNREAD', 'READ'])
  status?: 'ALL' | 'UNREAD' | 'READ';

  @IsOptional()
  @IsString()
  search?: string;
}

export class MarkAllNotificationsReadDto {
  @IsOptional()
  @IsString()
  @IsIn(['ALL', ...NOTIFICATION_CATEGORIES])
  category?: 'ALL' | NotificationCategory;
}

export class UpdateNotificationPreferencesDto {
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

export interface NotificationItemDto {
  id: string;
  instituteId: string | null;
  userId: string;
  category: NotificationCategory;
  eventType: string;
  referenceId: string | null;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedNotificationsDto {
  data: NotificationItemDto[];
  unreadCount: number;
  byCategory: Record<NotificationCategory, number>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface NotificationPreferencesResponseDto {
  notifyOnStudentRegistration: boolean;
  notifyOnFeePayment: boolean;
  notifyOnAttendanceAlert: boolean;
  notifyOnTeacherManagement: boolean;
  notifyOnAcademicActivity: boolean;
  notifyOnAdminSecurity: boolean;
}

export interface EmitNotificationEventInput {
  category: NotificationCategory;
  eventType: string;
  title: string;
  body: string;
  link: string;
  referenceId?: string;
  targetUserIds?: string[];
}

