import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentMeController } from './student-me.controller';
import { StudentsService } from './students.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthModule } from '../../core/auth/auth.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [AuthModule, CoursesModule],
  controllers: [StudentsController, StudentMeController],
  providers: [StudentsService, PrismaService],
  exports: [StudentsService],
})
export class StudentsModule {}
