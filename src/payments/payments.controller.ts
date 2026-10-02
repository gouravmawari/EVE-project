import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentDto, PreparePaymentDto, WebhookDto } from '../common/dto';
import { JwtGuard, RoleGuard } from '../common/auth';
@Controller('payments')
/** Exposes authenticated payment updates and provider webhook ingestion. */
export class PaymentsController {
  constructor(private service: PaymentsService) {}
  /** Creates or returns the booking's single pending payment. */
  @Post('prepare') @UseGuards(JwtGuard, RoleGuard) prepare(
    @Req() req: any,
    @Body() dto: PreparePaymentDto,
  ) {
    return this.service.prepare(req.user, dto.bookingId);
  }
  /** Applies a caller-authorized payment outcome to a booking. */
  @Post() @UseGuards(JwtGuard, RoleGuard) pay(
    @Req() req: any,
    @Body() dto: PaymentDto,
  ) {
    return this.service.pay(req.user, dto.bookingId, dto.outcome);
  }
  /** Passes the raw signed request and validated event data to the webhook handler. */
  @Post('webhook') webhook(
    @Req() req: any,
    @Headers('x-provider-signature') sig: string,
    @Body() dto: WebhookDto,
  ) {
    return this.service.webhook(req.rawBody, sig, dto);
  }
}
