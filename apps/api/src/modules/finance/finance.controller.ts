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
import { InstituteTenantGuard } from '../../core/auth/guards/institute-tenant.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { FinanceService } from './finance.service';

@Controller('institutes/:instituteId')
@UseGuards(JwtAuthGuard, InstituteTenantGuard, RolesGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.INSTITUTE_ADMIN,
  Role.FINANCE_OFFICER,
  Role.ACADEMIC_COORDINATOR,
)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('finance/overview')
  getOverview(@Param('instituteId') instituteId: string) {
    return this.financeService.getOverview(instituteId);
  }

  @Get('finance/categories')
  listCategories(@Param('instituteId') instituteId: string) {
    return this.financeService.listCategories(instituteId);
  }

  @Post('finance/categories')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.FINANCE_OFFICER)
  createCategory(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.financeService.createCategory(
      instituteId,
      body,
      user?.sub || user?.userId || 'system',
    );
  }

  @Get('finance/structures')
  listStructures(@Param('instituteId') instituteId: string) {
    return this.financeService.listStructures(instituteId);
  }

  @Post('finance/structures')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.FINANCE_OFFICER)
  createStructure(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.financeService.createStructure(
      instituteId,
      body,
      user?.sub || user?.userId || 'system',
    );
  }

  @Patch('finance/structures/:structureId')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.FINANCE_OFFICER)
  updateStructure(
    @Param('instituteId') instituteId: string,
    @Param('structureId') structureId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.financeService.updateStructure(
      instituteId,
      structureId,
      body,
      user?.sub || user?.userId || 'system',
    );
  }

  @Get('finance/allocations')
  listAllocations(
    @Param('instituteId') instituteId: string,
    @Query('studentProfileId') studentProfileId?: string,
  ) {
    return this.financeService.listAllocations(instituteId, studentProfileId);
  }

  @Post('finance/allocations')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.FINANCE_OFFICER)
  allocateStudentFee(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.financeService.allocateStudentFee(
      instituteId,
      body,
      user?.sub || user?.userId || 'system',
    );
  }

  @Get('finance/invoices')
  listInvoices(
    @Param('instituteId') instituteId: string,
    @Query('studentProfileId') studentProfileId?: string,
  ) {
    return this.financeService.listInvoices(instituteId, studentProfileId);
  }

  @Get('finance/invoices/:invoiceId')
  getInvoice(
    @Param('instituteId') instituteId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.financeService.getInvoice(instituteId, invoiceId);
  }

  @Post('finance/invoices')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.FINANCE_OFFICER)
  issueInvoice(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.financeService.issueInvoice(
      instituteId,
      body,
      user?.sub || user?.userId || 'system',
    );
  }

  @Get('finance/payments')
  listPayments(@Param('instituteId') instituteId: string) {
    return this.financeService.listPayments(instituteId);
  }

  @Post('finance/payments')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.FINANCE_OFFICER)
  recordPayment(
    @Param('instituteId') instituteId: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.financeService.recordPayment(
      instituteId,
      user?.sub || user?.userId || 'system',
      body,
    );
  }

  @Post('finance/payments/:paymentId/reverse')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.FINANCE_OFFICER)
  reversePayment(
    @Param('instituteId') instituteId: string,
    @Param('paymentId') paymentId: string,
    @Body() body: { reversedAmountPaise?: number; reason: string },
    @CurrentUser() user: any,
  ) {
    return this.financeService.reversePayment(
      instituteId,
      user?.sub || user?.userId || 'system',
      paymentId,
      body,
    );
  }

  @Post('finance/reversals')
  @Roles(Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN, Role.FINANCE_OFFICER)
  createReversal(
    @Param('instituteId') instituteId: string,
    @Body() body: { paymentId: string; reversedAmountPaise?: number; reason: string },
    @CurrentUser() user: any,
  ) {
    return this.financeService.reversePayment(
      instituteId,
      user?.sub || user?.userId || 'system',
      body.paymentId,
      body,
    );
  }

  @Get('students/:studentId/finance')
  getStudentFinance(
    @Param('instituteId') instituteId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.financeService.getStudentFinance(instituteId, studentId);
  }
}
