import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DiagnosticTestsService } from './diagnostic-tests.service';
import { TestDto } from '../common/dto';
import { JwtGuard, RoleGuard, Roles } from '../common/auth';
import { PaginationDto } from '../common/pagination.dto';
@Controller('diagnostic-tests')
/** Provides public test listing and admin-only test management. */
export class DiagnosticTestsController {
  constructor(private service: DiagnosticTestsService) {}
  /** Returns diagnostic tests with their centres and pagination metadata. */
  @Get() list(@Query() q: PaginationDto) {
    return this.service.list(q);
  }
  /** Creates a diagnostic test for an administrator. */
  @Post() @UseGuards(JwtGuard, RoleGuard) @Roles('ADMIN') create(
    @Body() dto: TestDto,
  ) {
    return this.service.create(dto);
  }
  /** Updates a diagnostic test for an administrator. */
  @Patch(':id') @UseGuards(JwtGuard, RoleGuard) @Roles('ADMIN') update(
    @Param('id') id: string,
    @Body() dto: TestDto,
  ) {
    return this.service.update(id, dto);
  }
  /** Removes an unbooked diagnostic test for an administrator. */
  @Delete(':id') @UseGuards(JwtGuard, RoleGuard) @Roles('ADMIN') remove(
    @Param('id') id: string,
  ) {
    return this.service.remove(id);
  }
}
