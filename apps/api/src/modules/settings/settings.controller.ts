import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { SettingsService } from './settings.service';
import {
  UpdateInstituteProfileDto,
  UpdateBrandingDto,
  UpdateAcademicSettingsDto,
  UpdateFinancialSettingsDto,
  UpdateSecurityPreferencesDto,
  UpdateUserStatusDto,
  UpdatePaymentGatewayDto,
} from './settings.dto';
import { Role } from '@prisma/client';

@Controller('institutes/:instituteId/settings')
@UseGuards(JwtAuthGuard, InstituteTenantGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Helper to ensure user has administrative privileges for the institute.
   */
  private verifyAdminRole(user: any) {
    const allowedRoles: string[] = [
      Role.SUPER_ADMIN,
      Role.INSTITUTE_ADMIN,
      Role.ACADEMIC_COORDINATOR,
    ];

    if (!user || !allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Access denied: Only Institute Administrators can configure institute settings',
      );
    }
  }

  // 1. GET ALL SETTINGS
  @Get()
  async getSettings(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.getSettings(instituteId);
  }

  // 2. UPDATE INSTITUTE PROFILE
  @Patch('profile')
  async updateProfile(
    @Param('instituteId') instituteId: string,
    @Body() dto: UpdateInstituteProfileDto,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.updateProfile(
      instituteId,
      dto,
      user.userId || user.sub || 'system',
    );
  }

  // 3. UPDATE BRANDING
  @Patch('branding')
  async updateBranding(
    @Param('instituteId') instituteId: string,
    @Body() dto: UpdateBrandingDto,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.updateBranding(
      instituteId,
      dto,
      user.userId || user.sub || 'system',
    );
  }

  // 4. RESET BRANDING TO DEFAULT
  @Post('branding/reset')
  async resetBranding(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.resetBranding(
      instituteId,
      user.userId || user.sub || 'system',
    );
  }

  // 5. UPDATE ACADEMIC SETTINGS
  @Patch('academic')
  async updateAcademicSettings(
    @Param('instituteId') instituteId: string,
    @Body() dto: UpdateAcademicSettingsDto,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.updateAcademicSettings(
      instituteId,
      dto,
      user.userId || user.sub || 'system',
    );
  }

  // 6. UPDATE FINANCIAL SETTINGS
  @Patch('financial')
  async updateFinancialSettings(
    @Param('instituteId') instituteId: string,
    @Body() dto: UpdateFinancialSettingsDto,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.updateFinancialSettings(
      instituteId,
      dto,
      user.userId || user.sub || 'system',
    );
  }

  // 7. UPDATE SECURITY & PREFERENCES
  @Patch('security')
  async updateSecurityPreferences(
    @Param('instituteId') instituteId: string,
    @Body() dto: UpdateSecurityPreferencesDto,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.updateSecurityPreferences(
      instituteId,
      dto,
      user.userId || user.sub || 'system',
    );
  }

  // 8. GET INSTITUTE USERS (Users & Access section)
  @Get('users')
  async getUsers(
    @Param('instituteId') instituteId: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.getUsers(instituteId, { role, status, search });
  }

  // 9. UPDATE USER STATUS (Activate / Suspend Membership)
  @Patch('users/:membershipId/status')
  async updateUserStatus(
    @Param('instituteId') instituteId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.updateUserStatus(
      instituteId,
      membershipId,
      dto.status,
      user.userId || user.sub || 'system',
      user.role,
    );
  }

  // 10. GET AUDIT LOGS
  @Get('audit-logs')
  async getAuditLogs(
    @Param('instituteId') instituteId: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.getAuditLogs(
      instituteId,
      limit ? parseInt(limit, 10) : 25,
    );
  }

  // 11. GET PAYMENT GATEWAY SETTINGS (Masked)
  @Get('payment-gateway')
  async getPaymentGatewaySettings(
    @Param('instituteId') instituteId: string,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.getPaymentGatewaySettings(instituteId);
  }

  // 12. UPDATE PAYMENT GATEWAY SETTINGS (AES-256-GCM encrypted)
  @Patch('payment-gateway')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN)
  async updatePaymentGatewaySettings(
    @Param('instituteId') instituteId: string,
    @Body() dto: UpdatePaymentGatewayDto,
    @CurrentUser() user: any,
  ) {
    this.verifyAdminRole(user);
    return this.settingsService.updatePaymentGatewaySettings(
      instituteId,
      dto,
      user.userId || user.sub || 'system',
    );
  }
}

