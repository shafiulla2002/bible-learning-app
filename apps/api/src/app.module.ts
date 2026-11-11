import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './core/auth/auth.module';
import { ZodExceptionFilter } from './core/filters/zod-exception.filter';
import { StudentsModule } from './modules/students/students.module';
import { CoursesModule } from './modules/courses/courses.module';
import { BatchesModule } from './modules/batches/batches.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { PublicModule } from './modules/public/public.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PrismaService } from './core/prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    NotificationsModule,
    StudentsModule,
    AdmissionsModule,
    CoursesModule,
    BatchesModule,
    AttendanceModule,
    TeachersModule,
    DashboardModule,
    SettingsModule,
    PublicModule,
    FinanceModule,
    // Super Admin Portal is currently on hold; opt in explicitly via ENABLE_SUPER_ADMIN=true
    ...(process.env.ENABLE_SUPER_ADMIN === 'true' ? [PlatformModule] : []),
  ],
  providers: [
    PrismaService,
    {
      provide: APP_FILTER,
      useClass: ZodExceptionFilter,
    },
  ],
  exports: [PrismaService],
})
export class AppModule {}
