import { Module } from '@nestjs/common';
import { DiagnosticTestsService } from './diagnostic-tests.service';
import { DiagnosticTestsController } from './diagnostic-tests.controller';

@Module({
  controllers: [DiagnosticTestsController],
  providers: [DiagnosticTestsService],
})
export class DiagnosticTestsModule {}
