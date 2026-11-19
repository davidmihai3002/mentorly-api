import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/index.js';
import { DomainsModule } from '../domains/index.js';
import { MenteeProfile } from '../users/index.js';
import { MenteeProfilesController } from './mentee-profiles.controller.js';
import { MenteeProfilesService } from './mentee-profiles.service.js';

@Module({
  imports: [
    AuthModule,
    DomainsModule,
    TypeOrmModule.forFeature([MenteeProfile]),
  ],
  controllers: [MenteeProfilesController],
  providers: [MenteeProfilesService],
})
export class MenteeProfilesModule {}
