import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describe('API integration (requires PostgreSQL)', () => {
  it('documents the prerequisite when DATABASE_URL is absent', () => {
    if (!databaseUrl) expect('DATABASE_URL').toBeUndefined();
  });
});

describeDatabase('API integration with PostgreSQL', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(() => app?.close());

  it('serves health and rejects unauthenticated protected routes', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
    await request(app.getHttpServer()).get('/bookings').expect(401);
  });
});
