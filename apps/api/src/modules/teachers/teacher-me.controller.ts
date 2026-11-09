import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Body,
  Param,
} from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

@Controller('teachers')
@UseGuards(JwtAuthGuard)
export class TeacherMeController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getTeacherMe(@CurrentUser() user: any) {
    return this.teachersService.getTeacherMe(user);
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

  @Get('materials')
  @HttpCode(HttpStatus.OK)
  async getTeacherMaterials(@CurrentUser() user: any, @Query() query: any) {
    return this.teachersService.getTeacherMaterials(user, query);
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
}



