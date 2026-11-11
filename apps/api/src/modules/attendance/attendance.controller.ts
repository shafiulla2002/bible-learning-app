import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Header,
  Res,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import {
  MarkBulkAttendanceSchema,
  UpdateIndividualAttendanceSchema,
  AttendanceFilterQuerySchema,
} from '@bible-lms/shared';

@Controller('institutes/:instituteId/attendance')
@UseGuards(JwtAuthGuard, InstituteTenantGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ---------------------------------------------------------------------------
  // 1. OVERVIEW & METRICS
  // ---------------------------------------------------------------------------

  @Get('overview')
  async getOverview(
    @Param('instituteId') instituteId: string,
    @Query() query: any,
  ) {
    const validated = AttendanceFilterQuerySchema.parse(query);
    return this.attendanceService.getOverview(instituteId, validated);
  }

  @Get('records')
  async getRecords(
    @Param('instituteId') instituteId: string,
    @Query() query: any,
  ) {
    const validated = AttendanceFilterQuerySchema.parse(query);
    return this.attendanceService.getRecords(instituteId, validated);
  }

  // ---------------------------------------------------------------------------
  // 2. BATCH STUDENTS ROSTER FOR ATTENDANCE
  // ---------------------------------------------------------------------------

  @Get('batches/:batchId/roster')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.TEACHER,
  )
  async getBatchRoster(
    @Param('instituteId') instituteId: string,
    @Param('batchId') batchId: string,
    @Query('date') date: string,
    @Query('liveSessionId') liveSessionId: string,
    @CurrentUser() user: any,
  ) {
    const dateStr = date || new Date().toISOString().slice(0, 10);
    return this.attendanceService.getBatchRosterForDate(
      instituteId,
      batchId,
      dateStr,
      liveSessionId,
      user,
    );
  }

  // ---------------------------------------------------------------------------
  // 3. BULK ATTENDANCE RECORDING (ATOMIC)
  // ---------------------------------------------------------------------------

  @Post('batches/:batchId/bulk')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.TEACHER,
  )
  @HttpCode(HttpStatus.OK)
  async markBulkAttendance(
    @Param('instituteId') instituteId: string,
    @Param('batchId') batchId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const validated = MarkBulkAttendanceSchema.parse({
      ...body,
      batchId,
    });
    return this.attendanceService.markBulkAttendance(instituteId, validated, user);
  }

  // ---------------------------------------------------------------------------
  // 4. INDIVIDUAL ATTENDANCE RECORD UPDATE WITH AUDIT
  // ---------------------------------------------------------------------------

  @Patch(':attendanceId')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.TEACHER,
  )
  async updateIndividualAttendance(
    @Param('instituteId') instituteId: string,
    @Param('attendanceId') attendanceId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const validated = UpdateIndividualAttendanceSchema.parse(body);
    return this.attendanceService.updateIndividualAttendance(
      instituteId,
      attendanceId,
      validated,
      user,
    );
  }

  // ---------------------------------------------------------------------------
  // 5. BATCH ATTENDANCE HISTORY
  // ---------------------------------------------------------------------------

  @Get('batches/:batchId/history')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.TEACHER,
  )
  async getBatchAttendanceHistory(
    @Param('instituteId') instituteId: string,
    @Param('batchId') batchId: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ) {
    const validated = AttendanceFilterQuerySchema.parse(query);
    return this.attendanceService.getBatchAttendanceHistory(
      instituteId,
      batchId,
      validated,
      user,
    );
  }

  // ---------------------------------------------------------------------------
  // 6. STUDENT PERSONAL ATTENDANCE HISTORY
  // ---------------------------------------------------------------------------

  @Get('students/:studentProfileId')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.STUDENT,
  )
  async getStudentAttendanceHistory(
    @Param('instituteId') instituteId: string,
    @Param('studentProfileId') studentProfileId: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ) {
    const validated = AttendanceFilterQuerySchema.parse(query);
    return this.attendanceService.getStudentAttendanceHistory(
      instituteId,
      studentProfileId,
      validated,
      user,
    );
  }

  // ---------------------------------------------------------------------------
  // 7. CSV REPORT EXPORT
  // ---------------------------------------------------------------------------

  @Get('export')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.TEACHER,
  )
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="attendance-report.csv"')
  async exportAttendanceReport(
    @Param('instituteId') instituteId: string,
    @Query() query: any,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const validated = AttendanceFilterQuerySchema.parse(query);
    const csvData = await this.attendanceService.exportAttendanceReport(
      instituteId,
      validated,
      user,
    );
    res.attachment(`attendance-${new Date().toISOString().slice(0, 10)}.csv`);
    return res.send(csvData);
  }
}
