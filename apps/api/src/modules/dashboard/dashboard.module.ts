import { Module } from '@nestjs/common';
import {
  DashboardController,
  DashboardContextController,
} from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthModule } from '../../core/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DashboardContextController, DashboardController],
  providers: [DashboardService, PrismaService],
  exports: [DashboardService],
})
export class DashboardModule {}
