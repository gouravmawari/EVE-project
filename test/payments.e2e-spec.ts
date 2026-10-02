import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac, randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

const describeDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeDatabase('Payment lifecycle with PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  let adminToken: string;
  let centreId: string;
  let testId: string;
  const bookingIds: string[] = [];
  const eventIds: string[] = [];
  const prefix = `payment-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const password = 'Payment-e2e-password-2026!';
  const ownerEmail = `${prefix}-owner@example.test`;
  const otherEmail = `${prefix}-other@example.test`;
  const adminEmail = `${prefix}-admin@example.test`;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function signup(email: string) {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password })
      .expect(201);
  }

  async function createBooking(hours: number) {
    const response = await request(app.getHttpServer())
      .post('/bookings')
      .set(auth(ownerToken))
      .send({
        centreId,
        testId,
        appointmentAt: new Date(Date.now() + hours * 3_600_000).toISOString(),
      })
      .expect(201);
    bookingIds.push(response.body.id);
    return response.body.id as string;
  }

  function prepare(bookingId: string, token = ownerToken) {
    return request(app.getHttpServer())
      .post('/payments/prepare')
      .set(auth(token))
      .send({ bookingId });
  }

  async function signedWebhook(payload: Record<string, string>) {
    const raw = JSON.stringify(payload);
    const signature = createHmac('sha256', process.env.WEBHOOK_SECRET!)
      .update(raw)
      .digest('hex');
    return request(app.getHttpServer())
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-provider-signature', signature)
      .send(raw);
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await signup(ownerEmail);
    ownerToken = owner.body.accessToken;
    const other = await signup(otherEmail);
    otherToken = other.body.accessToken;
    const admin = await signup(adminEmail);
    adminToken = admin.body.accessToken;
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    });

    const centre = await prisma.diagnosticCentre.create({
      data: { name: `${prefix} centre`, address: `${prefix} address` },
    });
    centreId = centre.id;
    const diagnosticTest = await prisma.diagnosticTest.create({
      data: { name: `${prefix} test`, price: '25.00', centreId },
    });
    testId = diagnosticTest.id;
  });

  afterAll(async () => {
    await prisma?.webhookEvent.deleteMany({
      where: { providerEventId: { in: eventIds } },
    });
    await prisma?.payment.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
    await prisma?.booking.deleteMany({ where: { id: { in: bookingIds } } });
    if (testId)
      await prisma?.diagnosticTest.deleteMany({ where: { id: testId } });
    if (centreId)
      await prisma?.diagnosticCentre.deleteMany({ where: { id: centreId } });
    await prisma?.user.deleteMany({
      where: { email: { in: [ownerEmail, otherEmail, adminEmail] } },
    });
    await app?.close();
  });

  it('authorizes and idempotently prepares one pending payment', async () => {
    const ownerBooking = await createBooking(48);
    await request(app.getHttpServer())
      .post('/payments/prepare')
      .send({ bookingId: ownerBooking })
      .expect(401);
    await prepare(ownerBooking, otherToken).expect(404);
    await prepare(ownerBooking).expect(201, {
      bookingId: ownerBooking,
      status: 'PENDING',
    });
    await prepare(ownerBooking).expect(201, {
      bookingId: ownerBooking,
      status: 'PENDING',
    });
    expect(
      await prisma.payment.count({ where: { bookingId: ownerBooking } }),
    ).toBe(1);

    const adminPrepared = await createBooking(49);
    await prepare(adminPrepared, adminToken).expect(201, {
      bookingId: adminPrepared,
      status: 'PENDING',
    });
  });

  it('keeps direct success and failure outcomes atomic and idempotent', async () => {
    const successBooking = await createBooking(50);
    await prepare(successBooking).expect(201);
    await request(app.getHttpServer())
      .post('/payments')
      .set(auth(ownerToken))
      .send({ bookingId: successBooking, outcome: 'SUCCESS' })
      .expect(201, { bookingId: successBooking, status: 'SUCCESS' });
    await request(app.getHttpServer())
      .post('/payments')
      .set(auth(ownerToken))
      .send({ bookingId: successBooking, outcome: 'SUCCESS' })
      .expect(201, { bookingId: successBooking, status: 'SUCCESS' });
    await request(app.getHttpServer())
      .post('/payments')
      .set(auth(ownerToken))
      .send({ bookingId: successBooking, outcome: 'FAILED' })
      .expect(409);
    await expect(
      prisma.booking.findUniqueOrThrow({
        where: { id: successBooking },
        include: { payment: true },
      }),
    ).resolves.toMatchObject({
      status: 'CONFIRMED',
      payment: { status: 'SUCCESS' },
    });

    const failedBooking = await createBooking(51);
    await prepare(failedBooking).expect(201);
    await request(app.getHttpServer())
      .post('/payments')
      .set(auth(ownerToken))
      .send({ bookingId: failedBooking, outcome: 'FAILED' })
      .expect(201, { bookingId: failedBooking, status: 'FAILED' });
    await request(app.getHttpServer())
      .post('/payments')
      .set(auth(ownerToken))
      .send({ bookingId: failedBooking, outcome: 'FAILED' })
      .expect(201, { bookingId: failedBooking, status: 'FAILED' });
    await expect(
      prisma.booking.findUniqueOrThrow({
        where: { id: failedBooking },
        include: { payment: true },
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      payment: { status: 'FAILED' },
    });
  });

  it('handles signed webhook success, replay, conflict, and failed outcome', async () => {
    const successBooking = await createBooking(52);
    await prepare(successBooking).expect(201);
    const eventId = randomUUID();
    eventIds.push(eventId);
    const successPayload = {
      providerEventId: eventId,
      bookingId: successBooking,
      outcome: 'SUCCESS',
    };
    await signedWebhook(successPayload).then((response) => {
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ accepted: true, replay: false });
    });
    await signedWebhook(successPayload).then((response) => {
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ accepted: true, replay: true });
    });
    await signedWebhook({ ...successPayload, outcome: 'FAILED' }).then(
      (response) => expect(response.status).toBe(409),
    );
    await expect(
      prisma.booking.findUniqueOrThrow({
        where: { id: successBooking },
        include: { payment: true },
      }),
    ).resolves.toMatchObject({
      status: 'CONFIRMED',
      payment: { status: 'SUCCESS' },
    });

    const failedBooking = await createBooking(53);
    await prepare(failedBooking).expect(201);
    const failedEventId = randomUUID();
    eventIds.push(failedEventId);
    await signedWebhook({
      providerEventId: failedEventId,
      bookingId: failedBooking,
      outcome: 'FAILED',
    }).then((response) => expect(response.status).toBe(201));
    await expect(
      prisma.booking.findUniqueOrThrow({
        where: { id: failedBooking },
        include: { payment: true },
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      payment: { status: 'FAILED' },
    });
  });

  it('rejects invalid signatures without partial state', async () => {
    const bookingId = await createBooking(54);
    await prepare(bookingId).expect(201);
    const providerEventId = randomUUID();
    eventIds.push(providerEventId);
    await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('x-provider-signature', 'invalid')
      .send({ providerEventId, bookingId, outcome: 'SUCCESS' })
      .expect(401);
    await expect(
      prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: { payment: true },
      }),
    ).resolves.toMatchObject({
      status: 'PENDING',
      payment: { status: 'PENDING' },
    });
    expect(
      await prisma.webhookEvent.count({ where: { providerEventId } }),
    ).toBe(0);
  });
});
