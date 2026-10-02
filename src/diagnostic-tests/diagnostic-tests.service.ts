import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto } from '../common/pagination.dto';
import { TestDto } from '../common/dto';

@Injectable()
/** Manages diagnostic tests while preserving centre and booking constraints. */
export class DiagnosticTestsService {
  constructor(private prisma: PrismaService) {}
  /** Returns tests with their centres and pagination metadata. */
  async list(q: PaginationDto) {
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.diagnosticTest.findMany({
        skip,
        take: q.limit,
        include: { centre: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.diagnosticTest.count(),
    ]);
    return { data, page: q.page, limit: q.limit, total };
  }
  /** Verifies the centre before creating a diagnostic test. */
  async create(dto: TestDto) {
    await this.ensureCentre(dto.centreId);
    return this.prisma.diagnosticTest.create({
      data: { name: dto.name, price: dto.price, centreId: dto.centreId },
    });
  }
  /** Updates a test while protecting centre and price data used by bookings. */
  async update(id: string, dto: TestDto) {
    const current = await this.prisma.diagnosticTest.findUnique({
      where: { id },
      include: { _count: { select: { bookings: true } } },
    });
    if (!current) throw new NotFoundException();
    if (
      current._count.bookings &&
      (current.centreId !== dto.centreId ||
        current.price.toString() !== dto.price)
    )
      throw new ConflictException('Booked tests cannot change centre or price');
    await this.ensureCentre(dto.centreId);
    try {
      return await this.prisma.diagnosticTest.update({
        where: { id },
        data: { name: dto.name, price: dto.price, centreId: dto.centreId },
      });
    } catch (e) {
      this.mapError(e);
    }
  }
  /** Deletes a test only when it has no bookings. */
  async remove(id: string) {
    const current = await this.prisma.diagnosticTest.findUnique({
      where: { id },
      include: { _count: { select: { bookings: true } } },
    });
    if (!current) throw new NotFoundException();
    if (current._count.bookings)
      throw new ConflictException('Booked tests cannot be deleted');
    try {
      return await this.prisma.diagnosticTest.delete({ where: { id } });
    } catch (e) {
      this.mapError(e);
    }
  }
  /** Rejects test operations that reference a missing centre. */
  private async ensureCentre(id: string) {
    if (
      !(await this.prisma.diagnosticCentre.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Centre not found');
  }
  /** Converts relevant Prisma constraint failures into API conflicts. */
  private mapError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2003', 'P2025'].includes(error.code)
    )
      throw new ConflictException(
        'Diagnostic test cannot be changed or deleted',
      );
    throw error;
  }
}
