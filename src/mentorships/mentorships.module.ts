import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/index.js';
import { AvailabilitySlot, Mentorship } from './entities/index.js';
import { MentorshipsController } from './mentorships.controller.js';
import { MentorshipsService } from './mentorships.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Mentorship, AvailabilitySlot]),
  ],
  controllers: [MentorshipsController],
  providers: [MentorshipsService],
})
export class MentorshipsModule {}
