import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
export enum PaymentOutcome {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}
/** Credentials accepted by the account registration endpoint. */
export class SignupDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}
/** Credentials accepted by the login endpoint. */
export class LoginDto extends SignupDto {}
/** Diagnostic centre fields shared by create and update requests. */
export class CentreDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) address!: string;
}
/** Diagnostic test fields, including a decimal price and owning centre. */
export class TestDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/) price!: string;
  @IsUUID() centreId!: string;
}
/** Identifies the centre, test, and future appointment requested for a booking. */
export class BookingDto {
  @IsUUID() centreId!: string;
  @IsUUID() testId!: string;
  @IsISO8601() appointmentAt!: string;
}
/** Restricts cancellation requests to the supported terminal status. */
export class CancelDto {
  @IsEnum({ CANCELLED: 'CANCELLED' }) status!: 'CANCELLED';
}
/** Selects the booking and outcome for an authenticated payment update. */
export class PaymentDto {
  @IsUUID() bookingId!: string;
  @IsEnum(PaymentOutcome) outcome!: PaymentOutcome;
}
/** Identifies the booking whose pending payment should be prepared. */
export class PreparePaymentDto {
  @IsUUID() bookingId!: string;
}
/** Validated provider event payload used for idempotent payment webhooks. */
export class WebhookDto {
  @IsUUID() providerEventId!: string;
  @IsUUID() bookingId!: string;
  @IsEnum(PaymentOutcome) outcome!: PaymentOutcome;
}
/** Query pagination constrained to positive pages and a maximum page size. */
export class PaginationDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
