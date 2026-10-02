import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const tx = {
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    webhookEvent: { findUnique: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: any) => fn(tx)),
    booking: { findUnique: jest.fn() },
    payment: { findUnique: jest.fn() },
    webhookEvent: { findUnique: jest.fn() },
  } as any;
  const service = new PaymentsService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('prepares one pending payment idempotently', async () => {
    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'u',
      status: 'PENDING',
      payment: null,
    });
    tx.payment.create.mockResolvedValue({ bookingId: 'b', status: 'PENDING' });

    await expect(
      service.prepare({ id: 'u', role: 'USER' }, 'b'),
    ).resolves.toEqual({ bookingId: 'b', status: 'PENDING' });

    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'u',
      status: 'PENDING',
      payment: { status: 'PENDING' },
    });
    await expect(
      service.prepare({ id: 'u', role: 'USER' }, 'b'),
    ).resolves.toEqual({ bookingId: 'b', status: 'PENDING' });
  });

  it('rejects prepare for another user or a terminal state', async () => {
    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'owner',
      status: 'PENDING',
      payment: null,
    });
    await expect(
      service.prepare({ id: 'other', role: 'USER' }, 'b'),
    ).rejects.toThrow();

    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'owner',
      status: 'CONFIRMED',
      payment: { status: 'SUCCESS' },
    });
    await expect(
      service.prepare({ id: 'owner', role: 'USER' }, 'b'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('consumes a prepared payment and confirms a pending booking atomically', async () => {
    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'u',
      status: 'PENDING',
      payment: { status: 'PENDING' },
    });
    await expect(
      service.pay({ id: 'u', role: 'USER' }, 'b', 'SUCCESS'),
    ).resolves.toEqual({ bookingId: 'b', status: 'SUCCESS' });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b', status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    });
  });

  it('returns the same terminal result and rejects a conflicting retry', async () => {
    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'u',
      status: 'CONFIRMED',
      payment: { status: 'SUCCESS' },
    });
    await expect(
      service.pay({ id: 'u', role: 'USER' }, 'b', 'SUCCESS'),
    ).resolves.toEqual({ bookingId: 'b', status: 'SUCCESS' });
    await expect(
      service.pay({ id: 'u', role: 'USER' }, 'b', 'FAILED'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('authorizes before terminal retry handling and rejects inconsistent pairs', async () => {
    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'owner',
      status: 'CONFIRMED',
      payment: { status: 'SUCCESS' },
    });
    await expect(
      service.pay({ id: 'other', role: 'USER' }, 'b', 'SUCCESS'),
    ).rejects.toBeInstanceOf(NotFoundException);

    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'owner',
      status: 'PENDING',
      payment: { status: 'SUCCESS' },
    });
    await expect(
      service.pay({ id: 'owner', role: 'USER' }, 'b', 'SUCCESS'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('moves both payment and booking to failed and retries idempotently', async () => {
    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'u',
      status: 'PENDING',
      payment: { status: 'PENDING' },
    });
    await expect(
      service.pay({ id: 'u', role: 'USER' }, 'b', 'FAILED'),
    ).resolves.toEqual({ bookingId: 'b', status: 'FAILED' });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'b', status: 'PENDING' },
      data: { status: 'FAILED' },
    });

    tx.booking.findUnique.mockResolvedValue({
      id: 'b',
      userId: 'u',
      status: 'FAILED',
      payment: { status: 'FAILED' },
    });
    await expect(
      service.pay({ id: 'u', role: 'USER' }, 'b', 'FAILED'),
    ).resolves.toEqual({ bookingId: 'b', status: 'FAILED' });
  });

  it('rejects invalid webhook signatures before opening a transaction', async () => {
    await expect(
      service.webhook(Buffer.from('{}'), 'bad', {
        providerEventId: '00000000-0000-4000-8000-000000000000',
        bookingId: '00000000-0000-4000-8000-000000000001',
        outcome: 'SUCCESS',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replays identical webhook payloads and conflicts on different hashes', async () => {
    const raw = Buffer.from('{}');
    const signature = createHmac('sha256', process.env.WEBHOOK_SECRET!)
      .update(raw)
      .digest('hex');
    tx.webhookEvent.findUnique.mockResolvedValue({
      payloadHash: require('crypto')
        .createHash('sha256')
        .update(raw)
        .digest('hex'),
    });
    await expect(service.webhook(raw, signature, {})).resolves.toEqual({
      accepted: true,
      replay: true,
    });
    tx.webhookEvent.findUnique.mockResolvedValue({ payloadHash: 'different' });
    await expect(service.webhook(raw, signature, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
