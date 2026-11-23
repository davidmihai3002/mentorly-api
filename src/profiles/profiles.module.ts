import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/index.js';
import { DomainsModule } from '../domains/index.js';
import { EnrolmentsModule } from '../enrolments/index.js';
import { FilesModule } from '../files/index.js';
import {
  MentorCredential,
  MentorProfile,
  MentorSocialLink,
} from './entities/index.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  imports: [
    AuthModule,
    DomainsModule,
    EnrolmentsModule,
    FilesModule,
    TypeOrmModule.forFeature([
      MentorProfile,
      MentorCredential,
      MentorSocialLink,
    ]),
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
