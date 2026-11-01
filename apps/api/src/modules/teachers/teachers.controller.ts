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
  Request,
} from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import {
  CreateTeacherSchema,
  UpdateTeacherProfileSchema,
  UpdateTeacherStatusSchema,
  TeacherFilterQuerySchema,
  AssignTeacherCourseSchema,
  AssignTeacherBatchSchema,
  CheckScheduleConflictSchema,
} from '@bible-lms/shared';

@Controller('institutes/:instituteId/teachers')
@UseGuards(JwtAuthGuard, InstituteTenantGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTeacher(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const validated = CreateTeacherSchema.parse(body);
    const actorUserId = req.user?.userId;
    return this.teachersService.createTeacher(instituteId, validated, actorUserId);
  }

  @Get()
  async getTeachers(
    @Param('instituteId') instituteId: string,
    @Query() query: any,
  ) {
    const validated = TeacherFilterQuerySchema.parse(query);
    return this.teachersService.findAll(instituteId, validated);
  }

  @Post('check-conflict')
  @HttpCode(HttpStatus.OK)
  async checkConflict(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = CheckScheduleConflictSchema.parse(body);
    return this.teachersService.checkScheduleConflict(instituteId, validated);
  }

  @Get(':id')
  async getTeacher(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
  ) {
    return this.teachersService.findOne(instituteId, id);
  }

  @Patch(':id')
  async updateTeacher(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const validated = UpdateTeacherProfileSchema.parse(body);
    const actorUserId = req.user?.userId;
    return this.teachersService.update(instituteId, id, validated, actorUserId);
  }

  @Patch(':id/status')
  async updateTeacherStatus(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const validated = UpdateTeacherStatusSchema.parse(body);
    const actorUserId = req.user?.userId;
    return this.teachersService.updateStatus(
      instituteId,
      id,
      validated.status,
      validated.reason ?? undefined,
      actorUserId,
    );
  }

  @Post(':id/courses')
  @HttpCode(HttpStatus.CREATED)
  async assignCourse(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const validated = AssignTeacherCourseSchema.parse(body);
    const actorUserId = req.user?.userId;
    return this.teachersService.assignCourse(
      instituteId,
      id,
      validated,
      actorUserId,
    );
  }

  @Delete(':id/courses/:courseId')
  async removeCourse(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('courseId') courseId: string,
    @Request() req: any,
  ) {
    const actorUserId = req.user?.userId;
    return this.teachersService.removeCourse(
      instituteId,
      id,
      courseId,
      actorUserId,
    );
  }

  @Post(':id/batches')
  @HttpCode(HttpStatus.CREATED)
  async assignBatch(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const validated = AssignTeacherBatchSchema.parse(body);
    const actorUserId = req.user?.userId;
    return this.teachersService.assignBatch(
      instituteId,
      id,
      validated,
      actorUserId,
    );
  }

  @Delete(':id/batches/:batchId')
  async removeBatch(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('batchId') batchId: string,
    @Request() req: any,
  ) {
    const actorUserId = req.user?.userId;
    return this.teachersService.removeBatch(
      instituteId,
      id,
      batchId,
      actorUserId,
    );
  }
}
