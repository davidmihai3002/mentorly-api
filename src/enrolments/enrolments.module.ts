import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrolmentsService } from './enrolments.service.js';
import { Enrolment } from './entities/index.js';

@Module({
  imports: [TypeOrmModule.forFeature([Enrolment])],
  providers: [EnrolmentsService],
  exports: [EnrolmentsService],
})
export class EnrolmentsModule {}
