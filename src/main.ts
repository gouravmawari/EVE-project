import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception/http-exception.filter';
import { loadConfig } from './config/env';

async function bootstrap() {
  loadConfig();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
