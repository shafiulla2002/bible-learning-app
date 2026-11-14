import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { CoursesService } from './courses.service';
import { BookStorageService } from './book-storage.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import {
  CreateCourseSchema,
  UpdateCourseSchema,
  CreateCourseCategorySchema,
  UpdateCourseCategorySchema,
  UpsertCompletionRuleSchema,
  UpdateResourceSchema,
  CourseFilterQuerySchema,
  CreateModuleSchema,
  UpdateModuleSchema,
  CreateChapterSchema,
  UpdateChapterSchema,
  CreateLessonSchema,
  UpdateLessonSchema,
  CreateResourceSchema,
  AssignCourseInstructorSchema,
  ReorderCurriculumSchema,
} from '@bible-lms/shared';

@Controller('institutes/:instituteId/courses')
@UseGuards(JwtAuthGuard, InstituteTenantGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR)
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly bookStorageService: BookStorageService,
  ) {}

  @Post('upload-book-pdf')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 150 * 1024 * 1024 } }))
  async uploadBookPdf(
    @Param('instituteId') instituteId: string,
    @UploadedFile() file: any,
  ) {
    return this.bookStorageService.saveBookPdf(instituteId, file);
  }

  @Post('upload-book-pdf-chunk')
  async uploadBookPdfChunk(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    return this.bookStorageService.saveBookPdfChunk(instituteId, body);
  }

  @Delete('upload-book-pdf')
  async deleteUploadedPdf(
    @Param('instituteId') instituteId: string,
    @Query('storageKey') storageKey: string,
  ) {
    const deleted = await this.bookStorageService.deleteBookPdf(instituteId, storageKey);
    return { success: deleted };
  }

  @Get(':id/pdf')
  async previewBookPdf(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
    const course: any = await this.coursesService.findOne(instituteId, id);
    if (!course || !course.pdfStorageKey) {
      res.status(HttpStatus.NOT_FOUND).json({ message: 'No PDF associated with this course' });
      return;
    }
    const { stream, status, headers } = await this.bookStorageService.createPdfStream(
      course.pdfStorageKey,
      range,
    );
    res.status(status);
    Object.entries(headers).forEach(([key, val]) => res.setHeader(key, val));
    stream.pipe(res);
  }

  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.FINANCE_OFFICER,
  )
  async getCourses(
    @Param('instituteId') instituteId: string,
    @Query() query: any,
  ) {
    const validated = CourseFilterQuerySchema.parse(query);
    return this.coursesService.findAll(instituteId, validated);
  }

  @Get('categories')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.FINANCE_OFFICER,
  )
  async getCategories(@Param('instituteId') instituteId: string) {
    return this.coursesService.listCategories(instituteId);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = CreateCourseCategorySchema.parse(body);
    return this.coursesService.createCategory(instituteId, validated);
  }

  @Patch('categories/:categoryId')
  async updateCategory(
    @Param('instituteId') instituteId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: any,
  ) {
    const validated = UpdateCourseCategorySchema.parse(body);
    return this.coursesService.updateCategory(instituteId, categoryId, validated);
  }

  @Delete('categories/:categoryId')
  async deleteCategory(
    @Param('instituteId') instituteId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.coursesService.deleteCategory(instituteId, categoryId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCourse(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
  ) {
    const validated = CreateCourseSchema.parse(body);
    return this.coursesService.create(instituteId, validated);
  }

  @Get(':id')
  async getCourse(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
  ) {
    return this.coursesService.findOne(instituteId, id);
  }

  @Put(':id')
  async updateCourse(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const validated = UpdateCourseSchema.parse(body);
    return this.coursesService.update(instituteId, id, validated);
  }

  @Patch(':id/status')
  async updateCourseStatus(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body('status') status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
  ) {
    return this.coursesService.updateStatus(instituteId, id, status);
  }

  @Delete(':id')
  async deleteCourse(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
  ) {
    return this.coursesService.softDelete(instituteId, id);
  }

  @Put(':id/completion-rule')
  async upsertCompletionRule(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const validated = UpsertCompletionRuleSchema.parse(body);
    return this.coursesService.upsertCompletionRule(instituteId, id, validated);
  }

  @Get(':id/enrolments')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.FINANCE_OFFICER,
  )
  async getCourseEnrolments(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
  ) {
    return this.coursesService.listCourseEnrolments(instituteId, id);
  }

  @Post(':id/instructors')
  @HttpCode(HttpStatus.CREATED)
  async assignInstructor(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const validated = AssignCourseInstructorSchema.parse(body);
    return this.coursesService.assignInstructor(instituteId, id, validated);
  }

  @Delete(':id/instructors/:teacherProfileId')
  async removeInstructor(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('teacherProfileId') teacherProfileId: string,
  ) {
    return this.coursesService.removeInstructor(instituteId, id, teacherProfileId);
  }

  @Post(':id/modules')
  @HttpCode(HttpStatus.CREATED)
  async createModule(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const validated = CreateModuleSchema.parse(body);
    return this.coursesService.createModule(instituteId, id, validated);
  }

  @Put(':id/modules/:moduleId')
  async updateModule(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body() body: any,
  ) {
    const validated = UpdateModuleSchema.parse(body);
    return this.coursesService.updateModule(instituteId, id, moduleId, validated);
  }

  @Delete(':id/modules/:moduleId')
  async deleteModule(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.coursesService.deleteModule(instituteId, id, moduleId);
  }

  @Post(':id/modules/:moduleId/chapters')
  @HttpCode(HttpStatus.CREATED)
  async createChapter(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body() body: any,
  ) {
    const validated = CreateChapterSchema.parse(body);
    return this.coursesService.createChapter(instituteId, id, moduleId, validated);
  }

  @Put(':id/chapters/:chapterId')
  async updateChapter(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @Body() body: any,
  ) {
    const validated = UpdateChapterSchema.parse(body);
    return this.coursesService.updateChapter(instituteId, id, chapterId, validated);
  }

  @Delete(':id/chapters/:chapterId')
  async deleteChapter(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.coursesService.deleteChapter(instituteId, id, chapterId);
  }

  @Post(':id/chapters/:chapterId/lessons')
  @HttpCode(HttpStatus.CREATED)
  async createLesson(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @Body() body: any,
  ) {
    const validated = CreateLessonSchema.parse(body);
    return this.coursesService.createLesson(instituteId, id, chapterId, validated);
  }

  @Put(':id/lessons/:lessonId')
  async updateLesson(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: any,
  ) {
    const validated = UpdateLessonSchema.parse(body);
    return this.coursesService.updateLesson(instituteId, id, lessonId, validated);
  }

  @Delete(':id/lessons/:lessonId')
  async deleteLesson(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.deleteLesson(instituteId, id, lessonId);
  }

  @Post(':id/lessons/:lessonId/resources')
  @HttpCode(HttpStatus.CREATED)
  async attachResource(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: any,
  ) {
    const validated = CreateResourceSchema.parse(body);
    return this.coursesService.attachResource(instituteId, id, lessonId, validated);
  }

  @Patch(':id/resources/:resourceId')
  async updateResource(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('resourceId') resourceId: string,
    @Body() body: any,
  ) {
    const validated = UpdateResourceSchema.parse(body);
    return this.coursesService.updateResource(instituteId, id, resourceId, validated);
  }

  @Delete(':id/resources/:resourceId')
  async removeResource(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.coursesService.removeResource(instituteId, id, resourceId);
  }

  @Put(':id/curriculum/reorder')
  async reorderCurriculum(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const validated = ReorderCurriculumSchema.parse(body);
    return this.coursesService.reorderCurriculum(instituteId, id, validated);
  }

  @Get(':id/lessons/:lessonId/resources/:resourceId/access')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INSTITUTE_ADMIN,
    Role.ACADEMIC_COORDINATOR,
    Role.TEACHER,
    Role.STUDENT,
  )
  async getResourceAccess(
    @Param('instituteId') instituteId: string,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Param('resourceId') resourceId: string,
    @Query('download') download: string,
    @CurrentUser() user: any,
  ) {
    const requestDownload = download === 'true';
    return this.coursesService.authorizeResourceAccess(
      instituteId,
      id,
      lessonId,
      resourceId,
      user,
      requestDownload,
    );
  }
}
