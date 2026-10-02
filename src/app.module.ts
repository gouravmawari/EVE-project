import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DiagnosticCentresModule } from './diagnostic-centres/diagnostic-centres.module';
import { DiagnosticTestsModule } from './diagnostic-tests/diagnostic-tests.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { LoggingModule } from './logging/logging.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from './config/config.module';
import { JwtGuard, RoleGuard } from './common/auth';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 100),
      },
    ]),
    UsersModule,
    AuthModule,
    DiagnosticCentresModule,
    DiagnosticTestsModule,
    BookingsModule,
    PaymentsModule,
    LoggingModule,
    DatabaseModule,
    ConfigModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtGuard,
    RoleGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
