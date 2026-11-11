import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { PublicService } from './public.service';
import {
  PublicCourseCatalogQuerySchema,
  PublicStudentRegisterSchema,
  PublicSubmitApplicationSchema,
  PublicCreateOrderSchema,
  VerifyRazorpayPaymentSchema,
} from '@bible-lms/shared';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('institutes')
  async listInstitutes() {
    return this.publicService.listInstitutes();
  }

  @Get('institutes/:slug/courses')
  async listInstituteCourses(
    @Param('slug') slug: string,
    @Query() query: any,
  ) {
    const validated = PublicCourseCatalogQuerySchema.parse({
      ...query,
      instituteSlug: slug,
    });
    return this.publicService.listPublishedCourses(validated);
  }

  @Get('courses')
  async listPublishedCourses(@Query() query: any) {
    const validated = PublicCourseCatalogQuerySchema.parse(query);
    return this.publicService.listPublishedCourses(validated);
  }

  @Get('courses/:idOrSlug')
  async getPublishedCourseDetail(
    @Param('idOrSlug') idOrSlug: string,
    @Query('instituteSlug') instituteSlug?: string,
  ) {
    return this.publicService.getPublishedCourseDetail(idOrSlug, instituteSlug);
  }

  @Get('coupons/validate')
  async validateCoupon(
    @Query('code') code: string,
    @Query('instituteId') instituteId?: string,
    @Query('instituteSlug') instituteSlug?: string,
    @Query('subtotal') subtotal?: string,
  ) {
    return this.publicService.validateCoupon({
      code: code || '',
      instituteId,
      instituteSlug,
      subtotalPaise: subtotal ? Number(subtotal) : 0,
    });
  }

  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  async registerStudent(@Body() body: any) {
    const validated = PublicStudentRegisterSchema.parse(body);
    return this.publicService.registerStudent(validated);
  }

  @Post('applications')
  @HttpCode(HttpStatus.CREATED)
  async submitApplication(@Body() body: any) {
    const validated = PublicSubmitApplicationSchema.parse(body);
    return this.publicService.submitApplication(validated);
  }

  @Get('applications/status')
  async trackApplicationStatus(
    @Query('applicationNumber') applicationNumber: string,
    @Query('phone') phone: string,
  ) {
    return this.publicService.trackApplicationStatus(applicationNumber, phone);
  }

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() body: any, @Req() req: any) {
    const validated = PublicCreateOrderSchema.parse(body);
    return this.publicService.createOrder(validated, req?.user?.sub);
  }

  @Post('payments/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOrderPayment(@Body() body: any) {
    const validated = VerifyRazorpayPaymentSchema.parse(body);
    return this.publicService.verifyOrderPayment(validated);
  }

  @Get('verify/certificate/:token')
  async verifyCertificate(@Param('token') token: string) {
    return this.publicService.verifyCertificate(token);
  }
}

