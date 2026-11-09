import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
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
}

