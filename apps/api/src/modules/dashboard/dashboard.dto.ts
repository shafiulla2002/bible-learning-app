import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export const DATE_RANGE_PRESETS = [
  'TODAY',
  '7D',
  '30D',
  'THIS_MONTH',
  'PREV_MONTH',
  'THIS_TERM',
  'THIS_YEAR',
  'CUSTOM',
  'ALL',
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export const EXPORT_REPORT_TYPES = [
  'enrollments',
  'fee-collection',
  'pending-fees',
  'attendance',
  'teacher-workload',
  'transactions',
] as const;

export type ExportReportType = (typeof EXPORT_REPORT_TYPES)[number];

export class DashboardFilterQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([...DATE_RANGE_PRESETS])
  preset?: DateRangePreset;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class DashboardTransactionsQueryDto extends DashboardFilterQueryDto {
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
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;
}

export class DashboardExportQueryDto extends DashboardFilterQueryDto {
  @IsString()
  @IsIn([...EXPORT_REPORT_TYPES])
  type!: ExportReportType;
}

