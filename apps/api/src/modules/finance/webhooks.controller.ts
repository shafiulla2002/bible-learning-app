import {
  Controller,
  Post,
  Param,
  Headers,
  Req,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FinanceService } from './finance.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('razorpay/:instituteId')
  @HttpCode(HttpStatus.OK)
  handleRazorpayWebhook(
    @Param('instituteId') instituteId: string,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId: string | undefined,
    @Req() req: any,
    @Body() body: any,
  ) {
    const rawBody: Buffer | string = req?.rawBody ?? JSON.stringify(body || {});
    return this.financeService.handleRazorpayWebhook({
      instituteId,
      rawBody,
      signature: signature || '',
      eventIdHeader: eventId,
      payload: body,
    });
  }
}

