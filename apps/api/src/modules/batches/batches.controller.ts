import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { BatchesService } from './batches.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import {
  CreateAcademicYearSchema,
  CreateAcademicTermSchema,
  CreateBatchSchema,
  UpdateBatchSchema,
  BatchFilterQuerySchema,
  AssignBatchTeacherSchema,
  EnrollStudentBatchSchema,
  TransferStudentBatchSchema,
  CreateClassScheduleSchema,
  CheckScheduleConflictSchema,
  RecurringWeeklyScheduleSchema,
} from '@bible-lms/shared';

@Controller('institutes/:instituteId')
@UseGuards(JwtAuthGuard, InstituteTenantGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  // ---------------------------------------------------------------------------
  // ACADEMIC PERIODS
  // ---------------------------------------------------------------------------

  @Post('academic-years')
  @HttpCode(HttpStatus.CREATED)
  async createAcademicYear(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = CreateAcademicYearSchema.parse(body);
    return this.batchesService.createAcademicYear(instituteId, validated);
  }

  @Get('academic-years')
  async getAcademicYears(@Param('instituteId') instituteId: string) {
    return this.batchesService.getAcademicYears(instituteId);
  }

  @Post('academic-terms')
  @HttpCode(HttpStatus.CREATED)
  async createAcademicTerm(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = CreateAcademicTermSchema.parse(body);
    return this.batchesService.createAcademicTerm(instituteId, validated);
  }

  @Get('academic-terms')
  async getAcademicTerms(
    @Param('instituteId') instituteId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.batchesService.getAcademicTerms(instituteId, academicYearId);
  }

  // ---------------------------------------------------------------------------
  // BATCHES
  // ---------------------------------------------------------------------------

  @Post('batches')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = CreateBatchSchema.parse(body);
    return this.batchesService.createBatch(instituteId, validated);
  }

  @Get('batches')
  async getBatches(
    @Param('instituteId') instituteId: string,
    @Query() query: any,
  ) {
    const validated = BatchFilterQuerySchema.parse(query);
    return this.batchesService.findAll(instituteId, validated);
  }

  @Get('batches/:id')
  async getBatch(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
  ) {
    return this.batchesService.findOne(instituteId, id);
  }

  @Patch('batches/:id')
  async updateBatch(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const validated = UpdateBatchSchema.parse(body);
    return this.batchesService.updateBatch(instituteId, id, validated);
  }

  // ---------------------------------------------------------------------------
  // ENROLMENT & TRANSFERS
  // ---------------------------------------------------------------------------

  @Post('batches/:id/enroll')
  @HttpCode(HttpStatus.CREATED)
  async enrollStudent(
    @Param('instituteId') instituteId: string,
    @Param('id') batchId: string,
    @Body() body: any,
  ) {
    const validated = EnrollStudentBatchSchema.parse(body);
    return this.batchesService.enrollStudent(instituteId, batchId, validated.studentProfileId);
  }

  @Post('batches/:id/transfer')
  @HttpCode(HttpStatus.OK)
  async transferStudent(
    @Param('instituteId') instituteId: string,
    @Param('id') sourceBatchId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const validated = TransferStudentBatchSchema.parse({
      ...body,
      sourceBatchId,
    });
    return this.batchesService.transferStudent(instituteId, validated, user?.sub || user?.id);
  }

  @Get('batches/transfers/logs')
  async getTransferLogs(
    @Param('instituteId') instituteId: string,
    @Query('studentProfileId') studentProfileId?: string,
    @Query('batchId') batchId?: string,
  ) {
    return this.batchesService.getBatchTransferLogs(instituteId, studentProfileId, batchId);
  }

  // ---------------------------------------------------------------------------
  // FACULTY ASSIGNMENTS
  // ---------------------------------------------------------------------------

  @Post('batches/:id/teachers')
  @HttpCode(HttpStatus.CREATED)
  async assignTeacher(
    @Param('instituteId') instituteId: string,
    @Param('id') batchId: string,
    @Body() body: any,
  ) {
    const validated = AssignBatchTeacherSchema.parse(body);
    return this.batchesService.assignTeacher(instituteId, batchId, validated);
  }

  @Delete('batches/:id/teachers/:teacherProfileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTeacher(
    @Param('instituteId') instituteId: string,
    @Param('id') batchId: string,
    @Param('teacherProfileId') teacherProfileId: string,
  ) {
    await this.batchesService.removeTeacher(instituteId, batchId, teacherProfileId);
  }

  // ---------------------------------------------------------------------------
  // SCHEDULING & CONFLICT DETECTION
  // ---------------------------------------------------------------------------

  @Post('schedules/check-conflict')
  @HttpCode(HttpStatus.OK)
  async checkScheduleConflict(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = CheckScheduleConflictSchema.parse(body);
    return this.batchesService.detectConflict(instituteId, validated);
  }

  @Post('schedules')
  @HttpCode(HttpStatus.CREATED)
  async createSchedule(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = CreateClassScheduleSchema.parse(body);
    return this.batchesService.createSchedule(instituteId, validated);
  }

  @Post('schedules/recurring')
  @HttpCode(HttpStatus.CREATED)
  async generateRecurringWeeklySchedule(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = RecurringWeeklyScheduleSchema.parse(body);
    return this.batchesService.generateRecurringWeeklySchedule(instituteId, validated);
  }

  @Get('schedules')
  async getSchedules(
    @Param('instituteId') instituteId: string,
    @Query() query: any,
  ) {
    return this.batchesService.getSchedules(instituteId, query);
  }

  @Patch('schedules/:sessionId/status')
  async updateScheduleStatus(
    @Param('instituteId') instituteId: string,
    @Param('sessionId') sessionId: string,
    @Body('status') status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED',
  ) {
    return this.batchesService.updateScheduleStatus(instituteId, sessionId, status);
  }
}
