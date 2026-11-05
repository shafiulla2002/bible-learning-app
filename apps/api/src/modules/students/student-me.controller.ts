import {
  Controller,
  Get,
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
}

