import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/index.js';
import { FilesModule } from '../files/index.js';
import { MentorCredential, MentorProfile } from './entities/index.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  imports: [
    AuthModule,
    FilesModule,
    TypeOrmModule.forFeature([MentorProfile, MentorCredential]),
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
