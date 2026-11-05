import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@Controller('students')
@UseGuards(JwtAuthGuard)
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
}

