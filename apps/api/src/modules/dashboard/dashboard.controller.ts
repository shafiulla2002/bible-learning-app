import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import {
  DashboardFilterQueryDto,
  DashboardTransactionsQueryDto,
  DashboardExportQueryDto,
} from './dashboard.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.INSTITUTE_ADMIN,
  Role.ACADEMIC_COORDINATOR,
  Role.FINANCE_OFFICER,
)
export class DashboardContextController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('context')
  async getContext(@CurrentUser() user: any) {
    return this.dashboardService.resolveAdminContext(user);
  }
}

@Controller('institutes/:instituteId/dashboard')
@UseGuards(JwtAuthGuard, InstituteTenantGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.INSTITUTE_ADMIN,
  Role.ACADEMIC_COORDINATOR,
  Role.FINANCE_OFFICER,
)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(
    @Param('instituteId') instituteId: string,
    @Query() query: DashboardFilterQueryDto,
    @CurrentUser() user: any,
  ) {
    const viewer = await this.dashboardService.verifyDashboardAccess(
      user,
      instituteId,
    );
    return this.dashboardService.getOverview(viewer.instituteId, query, viewer);
  }

  @Get('transactions')
  async getTransactions(
    @Param('instituteId') instituteId: string,
    @Query() query: DashboardTransactionsQueryDto,
    @CurrentUser() user: any,
  ) {
    const viewer = await this.dashboardService.verifyDashboardAccess(
      user,
      instituteId,
    );
    return this.dashboardService.getTransactions(viewer.instituteId, query);
  }

  @Get('export')
  async exportReport(
    @Param('instituteId') instituteId: string,
    @Query() query: DashboardExportQueryDto,
    @CurrentUser() user: any,
  ) {
    const allowedRoles = this.dashboardService.getAllowedRolesForExport(
      query.type,
    );
    const viewer = await this.dashboardService.verifyDashboardAccess(
      user,
      instituteId,
      allowedRoles,
    );
    return this.dashboardService.exportReport(
      viewer.instituteId,
      query.type,
      query,
    );
  }
}
