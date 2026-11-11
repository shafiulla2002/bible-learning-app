import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { StudentsService } from './students.service';
import {
  resolveResourceDelivery,
  resolveVideoSource,
} from '../courses/pdf-syllabus.util';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class StudentMeController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getStudentMe(@CurrentUser() user: any) {
    return this.studentsService.getStudentMe(user);
  }

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async getStudentDashboard(@CurrentUser() user: any) {
    return this.studentsService.getStudentDashboard(user);
  }

  @Get('courses')
  @HttpCode(HttpStatus.OK)
  async getStudentCourses(
    @CurrentUser() user: any,
    @Query() query: { q?: string; category?: string; status?: string; sort?: string }
  ) {
    return this.studentsService.getStudentCourses(user, query);
  }

  @Get('courses/:courseId')
  @HttpCode(HttpStatus.OK)
  async getStudentCourseDetail(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string
  ) {
    return this.studentsService.getStudentCourseDetail(user, courseId);
  }

  @Get('courses/:courseId/syllabus')
  @HttpCode(HttpStatus.OK)
  async getStudentCourseSyllabus(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.studentsService.getStudentCourseSyllabusPdf(user, courseId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Get('courses/:courseId/lessons/:lessonId')
  @HttpCode(HttpStatus.OK)
  async getStudentLesson(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string
  ) {
    return this.studentsService.getStudentLesson(user, courseId, lessonId);
  }

  @Post('courses/:courseId/lessons/:lessonId/progress')
  @HttpCode(HttpStatus.OK)
  async updateLessonProgress(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: { lastPosSec?: number; isCompleted?: boolean }
  ) {
    return this.studentsService.updateLessonProgress(user, courseId, lessonId, body);
  }

  @Post('courses/:courseId/lessons/:lessonId/quiz-submit')
  @HttpCode(HttpStatus.OK)
  async submitLessonQuiz(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: { answers: Record<string, string> }
  ) {
    return this.studentsService.submitLessonQuiz(user, courseId, lessonId, body);
  }

  @Get('live-sessions')
  @HttpCode(HttpStatus.OK)
  async getStudentLiveSessions(
    @CurrentUser() user: any,
    @Query() query: { status?: string; batchId?: string; q?: string; date?: string }
  ) {
    return this.studentsService.getStudentLiveSessions(user, query);
  }

  @Get('live-sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async getStudentLiveSessionDetail(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string
  ) {
    return this.studentsService.getStudentLiveSessionDetail(user, sessionId);
  }

  @Post('live-sessions/:sessionId/join')
  @HttpCode(HttpStatus.OK)
  async joinStudentLiveSession(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string
  ) {
    return this.studentsService.joinStudentLiveSession(user, sessionId);
  }

  @Get('materials/:resourceId/content')
  @HttpCode(HttpStatus.OK)
  async getStudentMaterialContent(
    @CurrentUser() user: any,
    @Param('resourceId') resourceId: string,
    @Query('meta') meta: string | undefined,
    @Query('download') download: string | undefined,
    @Query('inline') inline: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const wantsStream =
      download === '1' ||
      download === 'true' ||
      inline === '1' ||
      inline === 'true';

    if (!wantsStream) {
      const payload = await this.studentsService.getStudentMaterialContent(user, resourceId);
      if (meta === '1' || meta === 'true') {
        const storageKey = (payload as any)?.data?.storageKey || (payload as any)?.storageKey || '';
        return {
          ...(payload as any),
          video: resolveVideoSource(storageKey),
        };
      }
      return payload;
    }

    const info = await this.studentsService.getStudentMaterialContentForStreaming(
      user,
      resourceId,
      download === '1' || download === 'true',
    );
    const mode = inline === '1' || inline === 'true' ? 'inline' : 'download';
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
      res.redirect(delivery.url);
      return;
    }

    res.setHeader('Content-Type', delivery.mimeType);
    res.setHeader('Content-Disposition', `${delivery.disposition}; filename="${delivery.fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(delivery.buffer);
  }

  @Get('attendance')
  @HttpCode(HttpStatus.OK)
  async getStudentAttendance(
    @CurrentUser() user: any,
    @Query() query: { batchId?: string; courseId?: string; status?: string; month?: string; startDate?: string; endDate?: string }
  ) {
    return this.studentsService.getStudentAttendance(user, query);
  }

  @Get('attendance/summary')
  @HttpCode(HttpStatus.OK)
  async getStudentAttendanceSummary(@CurrentUser() user: any) {
    return this.studentsService.getStudentAttendanceSummary(user);
  }

  // ----------------------------------------------------
  // Phase 5: Assignments & Online Examinations
  // ----------------------------------------------------

  @Get('assignments')
  @HttpCode(HttpStatus.OK)
  async getStudentAssignments(
    @CurrentUser() user: any,
    @Query() query: { status?: string; courseId?: string; q?: string }
  ) {
    return this.studentsService.getStudentAssignments(user, query);
  }

  @Get('assignments/:assignmentId')
  @HttpCode(HttpStatus.OK)
  async getStudentAssignmentDetail(
    @CurrentUser() user: any,
    @Param('assignmentId') assignmentId: string
  ) {
    return this.studentsService.getStudentAssignmentDetail(user, assignmentId);
  }

  @Post('assignments/:assignmentId/submit')
  @HttpCode(HttpStatus.OK)
  async submitStudentAssignment(
    @CurrentUser() user: any,
    @Param('assignmentId') assignmentId: string,
    @Body() body: { answerText?: string; fileUrl?: string }
  ) {
    return this.studentsService.submitStudentAssignment(user, assignmentId, body);
  }

  @Get('exams')
  @HttpCode(HttpStatus.OK)
  async getStudentExams(
    @CurrentUser() user: any,
    @Query() query: { status?: string; courseId?: string; q?: string }
  ) {
    return this.studentsService.getStudentExams(user, query);
  }

  @Get('exams/:examId')
  @HttpCode(HttpStatus.OK)
  async getStudentExamDetail(
    @CurrentUser() user: any,
    @Param('examId') examId: string
  ) {
    return this.studentsService.getStudentExamDetail(user, examId);
  }

  @Post('exams/:examId/start')
  @HttpCode(HttpStatus.OK)
  async startStudentExamAttempt(
    @CurrentUser() user: any,
    @Param('examId') examId: string
  ) {
    return this.studentsService.startStudentExamAttempt(user, examId);
  }

  @Get('exams/:examId/attempts/:attemptId')
  @HttpCode(HttpStatus.OK)
  async getStudentExamAttempt(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Param('attemptId') attemptId: string
  ) {
    return this.studentsService.getStudentExamAttempt(user, examId, attemptId);
  }

  @Post('exams/:examId/attempts/:attemptId/answers')
  @HttpCode(HttpStatus.OK)
  async saveStudentExamAnswers(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Param('attemptId') attemptId: string,
    @Body() body: { answers: Record<string, string> }
  ) {
    return this.studentsService.saveStudentExamAnswers(user, examId, attemptId, body);
  }

  @Post('exams/:examId/attempts/:attemptId/submit')
  @HttpCode(HttpStatus.OK)
  async submitStudentExamAttempt(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Param('attemptId') attemptId: string,
    @Body() body?: { answers?: Record<string, string> }
  ) {
    return this.studentsService.submitStudentExamAttempt(user, examId, attemptId, body);
  }

  @Get('exams/:examId/results')
  @HttpCode(HttpStatus.OK)
  async getStudentExamResults(
    @CurrentUser() user: any,
    @Param('examId') examId: string
  ) {
    return this.studentsService.getStudentExamResults(user, examId);
  }

  // =========================================================================
  // PHASE 6: PAYMENTS, CERTIFICATES & STUDENT PROFILE
  // =========================================================================

  @Get('payments')
  @HttpCode(HttpStatus.OK)
  async getStudentPaymentsOverview(@CurrentUser() user: any) {
    return this.studentsService.getStudentPaymentsOverview(user);
  }

  @Get('invoices')
  @HttpCode(HttpStatus.OK)
  async getStudentInvoices(
    @CurrentUser() user: any,
    @Query('status') status?: string
  ) {
    return this.studentsService.getStudentInvoices(user, { status });
  }

  @Get('invoices/:invoiceId')
  @HttpCode(HttpStatus.OK)
  async getStudentInvoiceDetail(
    @CurrentUser() user: any,
    @Param('invoiceId') invoiceId: string
  ) {
    return this.studentsService.getStudentInvoiceDetail(user, invoiceId);
  }

  @Post('invoices/:invoiceId/pay')
  @HttpCode(HttpStatus.OK)
  async createPaymentOrder(
    @CurrentUser() user: any,
    @Param('invoiceId') invoiceId: string,
    @Body() body?: { amountPaise?: number }
  ) {
    return this.studentsService.createPaymentOrder(user, invoiceId, body);
  }

  @Post('invoices/:invoiceId/verify-payment')
  @HttpCode(HttpStatus.OK)
  async verifyAndProcessPayment(
    @CurrentUser() user: any,
    @Param('invoiceId') invoiceId: string,
    @Body()
    body: {
      amountPaise?: number;
      razorpayOrderId?: string;
      razorpay_order_id?: string;
      razorpayPaymentId?: string;
      razorpay_payment_id?: string;
      razorpaySignature?: string;
      razorpay_signature?: string;
      method?: string;
    },
  ) {
    return this.studentsService.verifyAndProcessPayment(user, invoiceId, body);
  }

  @Get('payments/history')
  @HttpCode(HttpStatus.OK)
  async getStudentPaymentHistory(
    @CurrentUser() user: any,
    @Query('status') status?: string
  ) {
    return this.studentsService.getStudentPaymentHistory(user, { status });
  }

  @Get('certificates')
  @HttpCode(HttpStatus.OK)
  async getStudentCertificates(@CurrentUser() user: any) {
    return this.studentsService.getStudentCertificates(user);
  }

  @Get('certificates/:certificateId')
  @HttpCode(HttpStatus.OK)
  async getStudentCertificateDetail(
    @CurrentUser() user: any,
    @Param('certificateId') certificateId: string
  ) {
    return this.studentsService.getStudentCertificateDetail(user, certificateId);
  }

  @Get('certificates/:certificateId/document')
  @HttpCode(HttpStatus.OK)
  async getStudentCertificateDocument(
    @CurrentUser() user: any,
    @Param('certificateId') certificateId: string
  ) {
    return this.studentsService.getStudentCertificateDocument(user, certificateId);
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getStudentProfile(@CurrentUser() user: any) {
    return this.studentsService.getStudentProfile(user);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateStudentProfile(
    @CurrentUser() user: any,
    @Body()
    body: {
      phone?: string;
      avatarUrl?: string;
      address?: any;
      church?: string;
      guardian?: any;
      preferredLanguage?: string;
    }
  ) {
    return this.studentsService.updateStudentProfile(user, body);
  }

  @Get('settings')
  @HttpCode(HttpStatus.OK)
  async getStudentSettings(@CurrentUser() user: any) {
    return this.studentsService.getStudentSettings(user);
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  async updateStudentSettings(
    @CurrentUser() user: any,
    @Body() body: { preferredLanguage?: string; notifications?: any }
  ) {
    return this.studentsService.updateStudentSettings(user, body);
  }

  // ==========================================
  // PHASE 8: STUDENT NOTIFICATIONS
  // ==========================================

  @Get('notifications')
  @HttpCode(HttpStatus.OK)
  async getStudentNotifications(@CurrentUser() user: any, @Query() query: any) {
    return this.studentsService.getStudentNotifications(user, query);
  }

  @Get('notifications/unread-count')
  @HttpCode(HttpStatus.OK)
  async getStudentNotificationsUnreadCount(@CurrentUser() user: any) {
    return this.studentsService.getStudentNotificationsUnreadCount(user);
  }

  @Patch('notifications/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  async markStudentNotificationRead(
    @CurrentUser() user: any,
    @Param('notificationId') notificationId: string,
  ) {
    return this.studentsService.markStudentNotificationRead(user, notificationId);
  }

  @Post('notifications/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  async markStudentNotificationReadPost(
    @CurrentUser() user: any,
    @Param('notificationId') notificationId: string,
  ) {
    return this.studentsService.markStudentNotificationRead(user, notificationId);
  }

  @Post('notifications')
  @HttpCode(HttpStatus.OK)
  async markAllStudentNotificationsReadAlias(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.studentsService.markAllStudentNotificationsRead(user, body);
  }

  @Post('notifications/mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllStudentNotificationsRead(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.studentsService.markAllStudentNotificationsRead(user, body);
  }
}


