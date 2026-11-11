import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdmissionsService } from './admissions.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import {
  ReviewAdmissionSchema,
  ApproveAdmissionSchema,
  RejectAdmissionSchema,
} from '@bible-lms/shared';

@Controller('institutes/:instituteId/admissions')
@UseGuards(JwtAuthGuard, InstituteTenantGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.ACADEMIC_COORDINATOR)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get()
  async listAdmissions(
    @Param('instituteId') instituteId: string,
    @Query('status') status?: string,
    @Query('courseId') courseId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admissionsService.listAdmissions(instituteId, {
      status,
      courseId,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':admissionId')
  async getAdmission(
    @Param('instituteId') instituteId: string,
    @Param('admissionId') admissionId: string,
  ) {
    return this.admissionsService.getAdmission(instituteId, admissionId);
  }

  @Patch(':admissionId/review')
  async reviewAdmission(
    @Param('instituteId') instituteId: string,
    @Param('admissionId') admissionId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const validated = ReviewAdmissionSchema.parse(body);
    return this.admissionsService.reviewAdmission(
      instituteId,
      admissionId,
      user?.sub || user?.userId || 'system',
      validated,
    );
  }

  @Post(':admissionId/approve')
  @HttpCode(HttpStatus.OK)
  async approveAdmission(
    @Param('instituteId') instituteId: string,
    @Param('admissionId') admissionId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const validated = ApproveAdmissionSchema.parse(body || {});
    return this.admissionsService.approveAdmission(
      instituteId,
      admissionId,
      user?.sub || user?.userId || 'system',
      validated,
    );
  }

  @Post(':admissionId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectAdmission(
    @Param('instituteId') instituteId: string,
    @Param('admissionId') admissionId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    const validated = RejectAdmissionSchema.parse(body);
    return this.admissionsService.rejectAdmission(
      instituteId,
      admissionId,
      user?.sub || user?.userId || 'system',
      validated,
    );
  }
}

