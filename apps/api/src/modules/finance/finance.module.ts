import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { WebhooksController } from './webhooks.controller';
import { FinanceService } from './finance.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [FinanceController, WebhooksController],
  providers: [FinanceService, PrismaService],
  exports: [FinanceService],
})
export class FinanceModule {}

