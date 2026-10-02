import { Module } from '@nestjs/common';
import { DiagnosticCentresService } from './diagnostic-centres.service';
import { DiagnosticCentresController } from './diagnostic-centres.controller';

@Module({
  controllers: [DiagnosticCentresController],
  providers: [DiagnosticCentresService],
})
export class DiagnosticCentresModule {}
