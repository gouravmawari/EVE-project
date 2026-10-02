import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual, createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { config } from '../config/env';
@Injectable()
/** Applies idempotent payment transitions and verifies provider webhooks. */
export class PaymentsService {
  constructor(private prisma: PrismaService) {}
  /** Creates or reuses the one pending payment allowed for a pending booking. */
  async prepare(user: any, bookingId: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const booking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true },
          });
          if (!booking || (user.role !== 'ADMIN' && booking.userId !== user.id))
            throw new NotFoundException();
          if (booking.status !== 'PENDING')
            throw new ConflictException('Booking is not pending');
          if (booking.payment) {
            if (booking.payment.status === 'PENDING')
              return { bookingId, status: 'PENDING' as const };
            throw new ConflictException('Payment is terminal');
          }
          await tx.payment.create({
            data: { bookingId, status: 'PENDING' },
          });
          return { bookingId, status: 'PENDING' as const };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (e: any) {
      if (e.code === 'P2002') {
        const booking = await this.prisma.booking.findUnique({
          where: { id: bookingId },
          include: { payment: true },
        });
        if (!booking || (user.role !== 'ADMIN' && booking.userId !== user.id))
          throw new NotFoundException();
        if (
          booking.status === 'PENDING' &&
          booking.payment?.status === 'PENDING'
        )
          return { bookingId, status: 'PENDING' as const };
        throw new ConflictException('Payment state changed');
      }
      if (e.code === 'P2034')
        throw new ConflictException('Booking state changed; retry the request');
      throw e;
    }
  }
  /** Atomically records a payment outcome and confirms successful bookings. */
  async pay(user: any, bookingId: string, outcome: 'SUCCESS' | 'FAILED') {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const b = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true },
          });
          if (!b || (user.role !== 'ADMIN' && b.userId !== user.id))
            throw new NotFoundException();
          if (b.payment && b.payment.status !== 'PENDING') {
            const matchingBooking =
              outcome === 'SUCCESS' ? 'CONFIRMED' : 'FAILED';
            if (b.payment.status === outcome && b.status === matchingBooking)
              return { bookingId, status: outcome };
            throw new ConflictException('Payment and booking state conflict');
          }
          if (b.status !== 'PENDING')
            throw new ConflictException('Booking is not pending');
          const payment = b.payment
            ? await tx.payment.updateMany({
                where: { bookingId, status: 'PENDING' },
                data: { status: outcome },
              })
            : null;
          if (payment && !payment.count)
            throw new ConflictException('Payment is no longer pending');
          if (!b.payment)
            await tx.payment.create({ data: { bookingId, status: outcome } });
          const changed = await tx.booking.updateMany({
            where: { id: bookingId, status: 'PENDING' },
            data: { status: outcome === 'SUCCESS' ? 'CONFIRMED' : 'FAILED' },
          });
          if (!changed.count)
            throw new ConflictException('Booking is no longer pending');
          return { bookingId, status: outcome };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (e: any) {
      if (e.code === 'P2002') {
        const existing = await this.prisma.payment.findUnique({
          where: { bookingId },
        });
        if (existing?.status === outcome) {
          const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
          });
          if (
            booking?.status === (outcome === 'SUCCESS' ? 'CONFIRMED' : 'FAILED')
          )
            return { bookingId, status: outcome };
        }
        throw new ConflictException(
          'Payment already exists or booking state changed',
        );
      }
      if (e.code === 'P2034')
        throw new ConflictException('Booking state changed; retry the request');
      throw e;
    }
  }
  /** Verifies the raw-body signature before atomically applying an event once. */
  async webhook(raw: Buffer, signature: string, dto: any) {
    const expected = createHmac('sha256', config.WEBHOOK_SECRET)
      .update(raw)
      .digest('hex');
    const actual = Buffer.from(signature ?? '');
    const expectedBuffer = Buffer.from(expected);
    if (
      actual.length !== expectedBuffer.length ||
      !timingSafeEqual(expectedBuffer, actual)
    )
      throw new UnauthorizedException();
    const payloadHash = createHash('sha256').update(raw).digest('hex');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const old = await tx.webhookEvent.findUnique({
            where: { providerEventId: dto.providerEventId },
          });
          if (old) {
            if (old.payloadHash !== payloadHash)
              throw new ConflictException('Conflicting webhook payload');
            return { accepted: true, replay: true };
          }
          const booking = await tx.booking.findUnique({
            where: { id: dto.bookingId },
            include: { payment: true },
          });
          if (
            !booking?.payment ||
            booking.status !== 'PENDING' ||
            booking.payment.status !== 'PENDING'
          )
            throw new ConflictException('Invalid payment transition');
          await tx.webhookEvent.create({
            data: { providerEventId: dto.providerEventId, payloadHash },
          });
          const paymentChanged = await tx.payment.updateMany({
            where: { bookingId: dto.bookingId, status: 'PENDING' },
            data: { status: dto.outcome },
          });
          if (!paymentChanged.count)
            throw new ConflictException('Payment is no longer pending');
          const bookingChanged = await tx.booking.updateMany({
            where: { id: dto.bookingId, status: 'PENDING' },
            data: {
              status: dto.outcome === 'SUCCESS' ? 'CONFIRMED' : 'FAILED',
            },
          });
          if (!bookingChanged.count)
            throw new ConflictException('Booking is no longer pending');
          return { accepted: true, replay: false };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (e: any) {
      if (e.code === 'P2002') {
        const old = await this.prisma.webhookEvent.findUnique({
          where: { providerEventId: dto.providerEventId },
        });
        if (old?.payloadHash === payloadHash)
          return { accepted: true, replay: true };
        throw new ConflictException('Conflicting webhook payload');
      }
      if (e.code === 'P2034')
        throw new ConflictException('Booking state changed; retry the webhook');
      throw e;
    }
  }
}
