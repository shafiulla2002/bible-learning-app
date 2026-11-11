import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { PlatformService } from './platform.service';

@Controller('platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PLATFORM_SUPPORT)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  private actor(user: any) {
    return {
      userId: user?.sub || user?.userId || 'super-admin',
      role: user?.role || Role.SUPER_ADMIN,
    };
  }

  @Get('analytics')
  getAnalytics() {
    return this.platformService.getAnalytics();
  }

  @Get('institutes')
  listInstitutes() {
    return this.platformService.listInstitutes();
  }

  @Post('institutes')
  @Roles(Role.SUPER_ADMIN)
  createInstitute(@Body() body: any, @CurrentUser() user: any) {
    return this.platformService.createInstitute(body, this.actor(user));
  }

  @Patch('institutes/:id/status')
  @Roles(Role.SUPER_ADMIN)
  updateInstituteStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'CLOSED'; reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.platformService.updateInstituteStatus(id, body, this.actor(user));
  }

  @Get('applications')
  listApplications(@Query('status') status?: string) {
    return this.platformService.listApplications(status);
  }

  @Post('applications/:id/approve')
  @Roles(Role.SUPER_ADMIN)
  approveApplication(@Param('id') id: string, @CurrentUser() user: any) {
    return this.platformService.approveApplication(id, this.actor(user));
  }

  @Post('applications/:id/reject')
  @Roles(Role.SUPER_ADMIN)
  rejectApplication(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.platformService.rejectApplication(id, body?.reason || '', this.actor(user));
  }

  @Get('plans')
  listPlans() {
    return this.platformService.listPlans();
  }

  @Post('plans')
  @Roles(Role.SUPER_ADMIN)
  createPlan(@Body() body: any, @CurrentUser() user: any) {
    return this.platformService.createPlan(body, this.actor(user));
  }

  @Patch('plans/:id')
  @Roles(Role.SUPER_ADMIN)
  updatePlan(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.platformService.updatePlan(id, body, this.actor(user));
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.platformService.listSubscriptions();
  }

  @Post('subscriptions')
  @Roles(Role.SUPER_ADMIN)
  assignSubscription(@Body() body: any, @CurrentUser() user: any) {
    return this.platformService.assignSubscription(body, this.actor(user));
  }

  @Get('invoices')
  listPlatformInvoices() {
    return this.platformService.listPlatformInvoices();
  }

  @Patch('invoices/:id/mark-paid')
  @Roles(Role.SUPER_ADMIN)
  markPlatformInvoicePaid(@Param('id') id: string, @CurrentUser() user: any) {
    return this.platformService.markPlatformInvoicePaid(id, this.actor(user));
  }

  @Get('audit-logs')
  listAuditLogs(@Query('limit') limit?: string) {
    return this.platformService.listAuditLogs(limit ? parseInt(limit, 10) : 50);
  }
}

