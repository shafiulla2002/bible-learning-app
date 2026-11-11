import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  NotificationQueryDto,
  MarkAllNotificationsReadDto,
  UpdateNotificationPreferencesDto,
} from './notifications.dto';

@Controller('institutes/:instituteId/notifications')
@UseGuards(JwtAuthGuard, InstituteTenantGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.INSTITUTE_ADMIN,
  Role.ACADEMIC_COORDINATOR,
  Role.FINANCE_OFFICER,
)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Param('instituteId') instituteId: string,
    @Query() query: NotificationQueryDto,
    @CurrentUser() user: any,
  ) {
    const ctx = await this.notificationsService.verifyAdminAccess(
      user,
      instituteId,
    );
    return this.notificationsService.getNotifications(
      ctx.instituteId,
      ctx.userId,
      query,
    );
  }

  @Get('unread-count')
  async getUnreadCount(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: any,
  ) {
    const ctx = await this.notificationsService.verifyAdminAccess(
      user,
      instituteId,
    );
    return this.notificationsService.getUnreadCount(
      ctx.instituteId,
      ctx.userId,
    );
  }

  @Get('preferences')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR)
  async getPreferences(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: any,
  ) {
    const ctx = await this.notificationsService.verifyAdminAccess(
      user,
      instituteId,
      [Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR],
    );
    return this.notificationsService.getPreferences(ctx.instituteId);
  }

  @Patch('preferences')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR)
  async updatePreferences(
    @Param('instituteId') instituteId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
    @CurrentUser() user: any,
  ) {
    const ctx = await this.notificationsService.verifyAdminAccess(
      user,
      instituteId,
      [Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR],
    );
    return this.notificationsService.updatePreferences(
      ctx.instituteId,
      dto,
      ctx.userId,
    );
  }

  @Patch(':notificationId/read')
  async markAsRead(
    @Param('instituteId') instituteId: string,
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: any,
  ) {
    const ctx = await this.notificationsService.verifyAdminAccess(
      user,
      instituteId,
    );
    return this.notificationsService.markAsRead(
      ctx.instituteId,
      ctx.userId,
      notificationId,
    );
  }

  @Post('mark-all-read')
  async markAllAsRead(
    @Param('instituteId') instituteId: string,
    @Body() body: MarkAllNotificationsReadDto,
    @CurrentUser() user: any,
  ) {
    const ctx = await this.notificationsService.verifyAdminAccess(
      user,
      instituteId,
    );
    return this.notificationsService.markAllAsRead(
      ctx.instituteId,
      ctx.userId,
      body?.category,
    );
  }
}

