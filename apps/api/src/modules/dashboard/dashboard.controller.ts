import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { DashboardService } from './dashboard.service';

@Controller('institutes/:instituteId/dashboard')
@UseGuards(JwtAuthGuard, InstituteTenantGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(
    @Param('instituteId') instituteId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dateRange =
      from || to
        ? {
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
          }
        : undefined;
    return this.dashboardService.getOverview(instituteId, dateRange);
  }
}

