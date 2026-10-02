import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CentreDto } from './dto';
import { PaginationDto } from '../common/pagination.dto';
@Injectable()
/** Manages diagnostic centres and maps persistence errors to API responses. */
export class DiagnosticCentresService {
  constructor(private prisma: PrismaService) {}
  /** Returns centres ordered by name with a total for pagination. */
  async list(q: PaginationDto) {
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.diagnosticCentre.findMany({
        skip,
        take: q.limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.diagnosticCentre.count(),
    ]);
    return { data, page: q.page, limit: q.limit, total };
  }
  /** Persists a new diagnostic centre. */
  create(dto: CentreDto) {
    return this.prisma.diagnosticCentre.create({ data: dto });
  }
  /** Updates a centre and reports missing records as not found. */
  async update(id: string, dto: CentreDto) {
    try {
      return await this.prisma.diagnosticCentre.update({
        where: { id },
        data: dto,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      )
        throw new NotFoundException();
      throw e;
    }
  }
  /** Deletes a centre unless references or a missing record prevent deletion. */
  async remove(id: string) {
    try {
      return await this.prisma.diagnosticCentre.delete({ where: { id } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      )
        throw new ConflictException(
          'Centre is referenced by tests or bookings',
        );
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      )
        throw new NotFoundException();
      throw e;
    }
  }
}
