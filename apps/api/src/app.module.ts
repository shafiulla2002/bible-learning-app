import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './core/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { CoursesModule } from './modules/courses/courses.module';
import { BatchesModule } from './modules/batches/batches.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PrismaService } from './core/prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    StudentsModule,
    CoursesModule,
    BatchesModule,
    AttendanceModule,
    TeachersModule,
    DashboardModule,
    SettingsModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
