import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Body,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { TeachersService } from './teachers.service';
import {
  resolveResourceDelivery,
  resolveVideoSource,
} from '../courses/pdf-syllabus.util';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class TeacherMeController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getTeacherMe(@CurrentUser() user: any) {
    return this.teachersService.getTeacherMe(user);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateTeacherMe(@CurrentUser() user: any, @Body() body: any) {
    return this.teachersService.updateTeacherMe(user, body);
  }

  @Get('settings')
  @HttpCode(HttpStatus.OK)
  async getTeacherSettings(@CurrentUser() user: any) {
    return this.teachersService.getTeacherSettings(user);
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  async updateTeacherSettings(@CurrentUser() user: any, @Body() body: any) {
    return this.teachersService.updateTeacherSettings(user, body);
  }

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async getTeacherDashboard(@CurrentUser() user: any) {
    return this.teachersService.getTeacherDashboard(user);
  }

  @Get('students')
  @HttpCode(HttpStatus.OK)
  async getTeacherStudents(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherStudents(user, query);
  }

  @Get('attendance/batches')
  @HttpCode(HttpStatus.OK)
  async getTeacherAttendanceBatches(@CurrentUser() user: any) {
    return this.teachersService.getTeacherAttendanceBatches(user);
  }

  @Get('attendance/roster')
  @HttpCode(HttpStatus.OK)
  async getTeacherAttendanceRoster(
    @CurrentUser() user: any,
    @Query('batchId') batchId: string,
    @Query('date') date: string,
  ) {
    return this.teachersService.getTeacherAttendanceRoster(user, batchId, date);
  }

  @Post('attendance/mark')
  @HttpCode(HttpStatus.OK)
  async markTeacherAttendance(@CurrentUser() user: any, @Body() body: any) {
    return this.teachersService.markTeacherAttendance(user, body);
  }

  @Get('courses')
  @HttpCode(HttpStatus.OK)
  async getTeacherCourses(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherCourses(user, query);
  }

  @Get('courses/:courseId')
  @HttpCode(HttpStatus.OK)
  async getTeacherCourseDetail(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
  ) {
    return this.teachersService.getTeacherCourseDetail(user, courseId);
  }

  @Get('courses/:courseId/syllabus')
  @HttpCode(HttpStatus.OK)
  async getTeacherCourseSyllabus(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.teachersService.getTeacherCourseSyllabusPdf(user, courseId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Get('materials')
  @HttpCode(HttpStatus.OK)
  async getTeacherMaterials(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherMaterials(user, query);
  }

  @Post('materials')
  @HttpCode(HttpStatus.CREATED)
  async createTeacherMaterial(@CurrentUser() user: any, @Body() body: any) {
    return this.teachersService.createTeacherMaterial(user, body);
  }

  @Get('materials/:resourceId/content')
  async getTeacherMaterialContent(
    @CurrentUser() user: any,
    @Param('resourceId') resourceId: string,
    @Query('meta') meta: string | undefined,
    @Query('download') download: string | undefined,
    @Query('inline') inline: string | undefined,
    @Res() res: Response,
  ) {
    const info = await this.teachersService.getTeacherMaterialContent(user, resourceId);

    if (meta === '1' || meta === 'true') {
      const video = resolveVideoSource(info.storageKey);
      return res.status(HttpStatus.OK).json({
        success: true,
        data: {
          id: info.id,
          title: info.title,
          kind: info.kind,
          mimeType: info.mimeType,
          storageKey: info.storageKey,
          downloadable: info.downloadable,
          lessonId: info.lessonId,
          lessonTitle: info.lessonTitle,
          lessonBody: info.lessonBody,
          courseId: info.courseId,
          courseTitle: info.courseTitle,
          videoStreamId: info.videoStreamId,
          video,
        },
      });
    }

    const mode = inline === '1' || inline === 'true' ? 'inline' : download === '1' || download === 'true' ? 'download' : 'inline';
    const delivery = resolveResourceDelivery({
      title: info.title,
      resourceType: info.kind,
      url: info.storageKey,
      content: info.lessonBody,
      courseTitle: info.courseTitle,
      lessonTitle: info.lessonTitle,
      instituteName: info.instituteName,
      mode,
    });

    if (delivery.kind === 'redirect') {
      return res.redirect(delivery.url);
    }

    res.setHeader('Content-Type', delivery.mimeType);
    res.setHeader('Content-Disposition', `${delivery.disposition}; filename="${delivery.fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(delivery.buffer);
  }

  @Patch('materials/:resourceId/content')
  @HttpCode(HttpStatus.OK)
  async updateTeacherMaterialContent(
    @CurrentUser() user: any,
    @Param('resourceId') resourceId: string,
    @Body() body: any,
  ) {
    return this.teachersService.updateTeacherMaterialContent(user, resourceId, body);
  }

  @Post('courses/:courseId/lessons/:lessonId/resources')
  @HttpCode(HttpStatus.CREATED)
  async uploadTeacherResource(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: any,
  ) {
    return this.teachersService.uploadTeacherResource(user, courseId, lessonId, body);
  }

  @Get('assignments')
  @HttpCode(HttpStatus.OK)
  async getTeacherAssignments(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherAssignments(user, query);
  }

  @Get('assignments/:assignmentId')
  @HttpCode(HttpStatus.OK)
  async getTeacherAssignmentDetail(
    @CurrentUser() user: any,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.teachersService.getTeacherAssignmentDetail(user, assignmentId);
  }

  @Post('assignments')
  @HttpCode(HttpStatus.CREATED)
  async createTeacherAssignment(@CurrentUser() user: any, @Body() body: any) {
    return this.teachersService.createTeacherAssignment(user, body);
  }

  @Put('assignments/:assignmentId')
  @HttpCode(HttpStatus.OK)
  async updateTeacherAssignment(
    @CurrentUser() user: any,
    @Param('assignmentId') assignmentId: string,
    @Body() body: any,
  ) {
    return this.teachersService.updateTeacherAssignment(user, assignmentId, body);
  }

  @Post('assignments/:assignmentId/submissions/:submissionId/grade')
  @HttpCode(HttpStatus.OK)
  async gradeTeacherSubmission(
    @CurrentUser() user: any,
    @Param('assignmentId') assignmentId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: any,
  ) {
    return this.teachersService.gradeTeacherSubmission(user, assignmentId, submissionId, body);
  }

  // =========================================================================
  // PHASE 6: EXAMINATIONS & ONLINE TESTS MANAGEMENT
  // =========================================================================

  @Get('exams')
  @HttpCode(HttpStatus.OK)
  async getTeacherExams(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherExams(user, query);
  }

  @Get('exams/:examId')
  @HttpCode(HttpStatus.OK)
  async getTeacherExamDetail(@CurrentUser() user: any, @Param('examId') examId: string) {
    return this.teachersService.getTeacherExamDetail(user, examId);
  }

  @Post('exams')
  @HttpCode(HttpStatus.CREATED)
  async createTeacherExam(@CurrentUser() user: any, @Body() body: any) {
    return this.teachersService.createTeacherExam(user, body);
  }

  @Put('exams/:examId')
  @HttpCode(HttpStatus.OK)
  async updateTeacherExam(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Body() body: any,
  ) {
    return this.teachersService.updateTeacherExam(user, examId, body);
  }

  @Post('exams/:examId/publish')
  @HttpCode(HttpStatus.OK)
  async publishTeacherExam(@CurrentUser() user: any, @Param('examId') examId: string) {
    return this.teachersService.publishTeacherExam(user, examId);
  }

  @Post('exams/:examId/questions')
  @HttpCode(HttpStatus.CREATED)
  async addTeacherExamQuestion(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Body() body: any,
  ) {
    return this.teachersService.addTeacherExamQuestion(user, examId, body);
  }

  @Put('exams/:examId/questions/:questionId')
  @HttpCode(HttpStatus.OK)
  async updateTeacherExamQuestion(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
    @Body() body: any,
  ) {
    return this.teachersService.updateTeacherExamQuestion(user, examId, questionId, body);
  }

  @Delete('exams/:examId/questions/:questionId')
  @HttpCode(HttpStatus.OK)
  async deleteTeacherExamQuestion(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.teachersService.deleteTeacherExamQuestion(user, examId, questionId);
  }

  @Get('exams/:examId/results')
  @HttpCode(HttpStatus.OK)
  async getTeacherExamResults(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Query() query: any,
  ) {
    return this.teachersService.getTeacherExamResults(user, examId, query);
  }

  @Get('exams/:examId/attempts/:attemptId')
  @HttpCode(HttpStatus.OK)
  async getTeacherExamAttempt(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Param('attemptId') attemptId: string,
  ) {
    return this.teachersService.getTeacherExamAttempt(user, examId, attemptId);
  }

  @Post('exams/:examId/attempts/:attemptId/evaluate')
  @HttpCode(HttpStatus.OK)
  async evaluateTeacherExamAttempt(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Param('attemptId') attemptId: string,
    @Body() body: any,
  ) {
    return this.teachersService.evaluateTeacherExamAttempt(user, examId, attemptId, body);
  }

  // =========================================================================
  // PHASE 7: LIVE CLASSES & TIMETABLE MANAGEMENT
  // =========================================================================

  @Get('live-classes')
  @HttpCode(HttpStatus.OK)
  async getTeacherLiveClasses(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherLiveClasses(user, query);
  }

  @Get('live-classes/:sessionId')
  @HttpCode(HttpStatus.OK)
  async getTeacherLiveClassDetail(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
  ) {
    return this.teachersService.getTeacherLiveClassDetail(user, sessionId);
  }

  @Post('live-classes')
  @HttpCode(HttpStatus.CREATED)
  async createTeacherLiveClass(@CurrentUser() user: any, @Body() body: any) {
    return this.teachersService.createTeacherLiveClass(user, body);
  }

  @Put('live-classes/:sessionId')
  @HttpCode(HttpStatus.OK)
  async updateTeacherLiveClass(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() body: any,
  ) {
    return this.teachersService.updateTeacherLiveClass(user, sessionId, body);
  }

  @Post('live-classes/:sessionId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelTeacherLiveClass(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() body: any,
  ) {
    return this.teachersService.cancelTeacherLiveClass(user, sessionId, body);
  }

  @Get('timetable')
  @HttpCode(HttpStatus.OK)
  async getTeacherTimetable(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherTimetable(user, query);
  }

  @Get('live-classes/:sessionId/attendance')
  @HttpCode(HttpStatus.OK)
  async getTeacherLiveClassAttendance(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
  ) {
    return this.teachersService.getTeacherLiveClassAttendance(user, sessionId);
  }

  @Post('live-classes/:sessionId/attendance')
  @HttpCode(HttpStatus.OK)
  async markTeacherLiveClassAttendance(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
    @Body() body: any,
  ) {
    return this.teachersService.markTeacherLiveClassAttendance(user, sessionId, body);
  }

  // ==========================================
  // PHASE 8: TEACHER NOTIFICATIONS
  // ==========================================

  @Get('notifications')
  @HttpCode(HttpStatus.OK)
  async getTeacherNotifications(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherNotifications(user, query);
  }

  @Get('notifications/unread-count')
  @HttpCode(HttpStatus.OK)
  async getTeacherNotificationsUnreadCount(@CurrentUser() user: any) {
    return this.teachersService.getTeacherNotificationsUnreadCount(user);
  }

  @Patch('notifications/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  async markTeacherNotificationRead(
    @CurrentUser() user: any,
    @Param('notificationId') notificationId: string,
  ) {
    return this.teachersService.markTeacherNotificationRead(user, notificationId);
  }

  @Post('notifications/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  async markTeacherNotificationReadPost(
    @CurrentUser() user: any,
    @Param('notificationId') notificationId: string,
  ) {
    return this.teachersService.markTeacherNotificationRead(user, notificationId);
  }

  @Post('notifications')
  @HttpCode(HttpStatus.OK)
  async markAllTeacherNotificationsReadAlias(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.teachersService.markAllTeacherNotificationsRead(user, body);
  }

  @Post('notifications/mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllTeacherNotificationsRead(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.teachersService.markAllTeacherNotificationsRead(user, body);
  }

  // ==========================================
  // PHASE 9: TEACHER BATCHES & BATCH DETAILS
  // ==========================================

  @Get('batches')
  @HttpCode(HttpStatus.OK)
  async getTeacherBatches(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherBatches(user, query);
  }

  @Get('batches/:batchId')
  @HttpCode(HttpStatus.OK)
  async getTeacherBatchDetail(
    @CurrentUser() user: any,
    @Param('batchId') batchId: string,
  ) {
    return this.teachersService.getTeacherBatchDetail(user, batchId);
  }
}




