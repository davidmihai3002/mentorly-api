import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenteeProfile, User } from '../users/index.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, MenteeProfile])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
