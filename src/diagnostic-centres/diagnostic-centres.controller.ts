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
import { DiagnosticCentresService } from './diagnostic-centres.service';
import { CentreDto } from './dto';
import { JwtGuard, RoleGuard, Roles } from '../common/auth';
import { PaginationDto } from '../common/pagination.dto';
@Controller('diagnostic-centres')
/** Provides public centre listing and admin-only centre management. */
export class DiagnosticCentresController {
  constructor(private service: DiagnosticCentresService) {}
  /** Returns centres using the requested pagination window. */
  @Get() list(@Query() q: PaginationDto) {
    return this.service.list(q);
  }
  /** Creates a centre for an administrator. */
  @Post() @UseGuards(JwtGuard, RoleGuard) @Roles('ADMIN') create(
    @Body() dto: CentreDto,
  ) {
    return this.service.create(dto);
  }
  /** Updates a centre for an administrator. */
  @Patch(':id') @UseGuards(JwtGuard, RoleGuard) @Roles('ADMIN') update(
    @Param('id') id: string,
    @Body() dto: CentreDto,
  ) {
    return this.service.update(id, dto);
  }
  /** Removes an unreferenced centre for an administrator. */
  @Delete(':id') @UseGuards(JwtGuard, RoleGuard) @Roles('ADMIN') remove(
    @Param('id') id: string,
  ) {
    return this.service.remove(id);
  }
}
