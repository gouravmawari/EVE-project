import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingDto, CancelDto, PaginationDto } from '../common/dto';
import { Query } from '@nestjs/common';
import { JwtGuard, RoleGuard } from '../common/auth';
@Controller('bookings')
@UseGuards(JwtGuard, RoleGuard)
/** Provides authenticated booking creation, lookup, listing, and cancellation. */
export class BookingsController {
  constructor(private service: BookingsService) {}
  /** Creates a booking for the authenticated user. */
  @Post() create(@Req() req: any, @Body() dto: BookingDto) {
    return this.service.create(req.user.id, dto);
  }
  /** Lists bookings visible to the authenticated user or administrator. */
  @Get() list(@Req() req: any, @Query() query: PaginationDto) {
    return this.service.list(req.user, query);
  }
  /** Returns one booking after applying ownership or administrator access rules. */
  @Get(':id') one(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(id, req.user);
  }
  /** Cancels a pending booking when the caller is allowed to manage it. */
  @Patch(':id') cancel(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ) {
    return this.service.cancel(id, req.user);
  }
}
