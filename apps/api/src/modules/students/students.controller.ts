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
import { Role } from '@prisma/client';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import {
  CreateStudentAdmissionSchema,
  CreateStudentAdmissionInput,
  UpdateStudentProfileSchema,
  UpdateStudentProfileInput,
  UpdateStudentStatusSchema,
  UpdateStudentStatusInput,
  StudentFilterQuerySchema,
  StudentFilterQuery,
  BulkStudentImportRow,
} from '@bible-lms/shared';

@Controller('institutes/:instituteId/students')
@UseGuards(JwtAuthGuard, InstituteTenantGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createStudent(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = CreateStudentAdmissionSchema.parse(body);
    return this.studentsService.createStudent(instituteId, validated);
  }

  @Get()
  async getStudents(
    @Param('instituteId') instituteId: string,
    @Query() query: any,
  ) {
    const validated = StudentFilterQuerySchema.parse(query);
    return this.studentsService.findAll(instituteId, validated);
  }

  @Get('me')
  @Roles(Role.STUDENT)
  async getStudentMe(@CurrentUser() user: any) {
    return this.studentsService.getStudentMe(user);
  }

  @Get(':id')
  async getStudent(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
  ) {
    return this.studentsService.findOne(instituteId, id);
  }

  @Patch(':id')
  async updateStudent(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const validated = UpdateStudentProfileSchema.parse(body);
    return this.studentsService.update(instituteId, id, validated);
  }

  @Patch(':id/status')
  async updateStudentStatus(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const validated = UpdateStudentStatusSchema.parse(body);
    return this.studentsService.updateStatus(instituteId, id, validated.status, validated.notes);
  }

  @Post('bulk-import')
  @HttpCode(HttpStatus.OK)
  async bulkImport(
    @Param('instituteId') instituteId: string,
    @Body() body: { rows: BulkStudentImportRow[]; execute?: boolean },
  ) {
    return this.studentsService.processBulkImport(
      instituteId,
      body.rows || [],
      body.execute || false,
    );
  }

  @Post(':id/enrollments')
  @HttpCode(HttpStatus.CREATED)
  async enrollStudent(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: { courseId: string; batchId?: string },
  ) {
    return this.studentsService.enrollStudent(
      instituteId,
      id,
      body.courseId,
      body.batchId,
    );
  }

  @Delete(':id')
  async deleteStudent(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
  ) {
    return this.studentsService.deleteStudent(instituteId, id);
  }
}
