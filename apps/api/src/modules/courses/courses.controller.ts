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
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import {
  CreateCourseSchema,
  UpdateCourseSchema,
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
@UseGuards(JwtAuthGuard, InstituteTenantGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async getCourses(
    @Param('instituteId') instituteId: string,
    @Query() query: any,
  ) {
    const validated = CourseFilterQuerySchema.parse(query);
    return this.coursesService.findAll(instituteId, validated);
  }

  @Get('categories')
  async getCategories(@Param('instituteId') instituteId: string) {
    return this.coursesService.listCategories(instituteId);
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
