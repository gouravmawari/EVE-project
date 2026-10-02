import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BookingDto, PaginationDto } from '../common/dto';
import { serialize } from '../common/serialize';
@Injectable()
/** Enforces booking availability, visibility, and state transitions. */
export class BookingsService {
  constructor(private prisma: PrismaService) {}
  /** Validates the appointment and test centre before creating a booking. */
  async create(userId: string, dto: BookingDto) {
    const when = new Date(dto.appointmentAt);
    if (when <= new Date())
      throw new BadRequestException('Appointment must be in the future');
    const test = await this.prisma.diagnosticTest.findUnique({
      where: { id: dto.testId },
    });
    if (!test || test.centreId !== dto.centreId)
      throw new BadRequestException('Test is not available at this centre');
    try {
      const booking = await this.prisma.booking.create({
        data: {
          userId,
          centreId: dto.centreId,
          testId: dto.testId,
          appointmentAt: when,
          amount: test.price,
        },
      });
      return serialize(booking);
    } catch (e: any) {
      if (e.code === 'P2002')
        throw new ConflictException('Active booking already exists');
      throw e;
    }
  }
  /** Returns a paginated booking view scoped by the caller's role. */
  async list(user: any, q: PaginationDto) {
    const skip = (q.page - 1) * q.limit;
    const where = user.role === 'ADMIN' ? {} : { userId: user.id };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        skip,
        take: q.limit,
        include: { centre: true, test: true, payment: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data: serialize(data), page: q.page, limit: q.limit, total };
  }
  /** Loads one booking and enforces ownership unless the caller is an admin. */
  async findOne(id: string, user: any) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: { centre: true, test: true, payment: true },
    });
    if (!b) throw new NotFoundException();
    if (user.role !== 'ADMIN' && b.userId !== user.id)
      throw new ForbiddenException();
    return serialize(b);
  }
  /** Atomically changes a pending booking to cancelled with serializable isolation. */
  async cancel(id: string, user: any) {
    return this.prisma.$transaction(
      async (tx) => {
        const b = await tx.booking.findUnique({ where: { id } });
        if (!b) throw new NotFoundException();
        if (user.role !== 'ADMIN' && b.userId !== user.id)
          throw new ForbiddenException();
        const changed = await tx.booking.updateMany({
          where: {
            id,
            status: 'PENDING',
            ...(user.role === 'ADMIN' ? {} : { userId: user.id }),
          },
          data: { status: 'CANCELLED' },
        });
        if (!changed.count) {
          const latest = await tx.booking.findUnique({
            where: { id },
            select: { status: true },
          });
          throw new ConflictException(
            `Booking is ${latest?.status ?? 'unavailable'}`,
          );
        }
        return serialize(await tx.booking.findUniqueOrThrow({ where: { id } }));
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
