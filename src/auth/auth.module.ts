import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getJwtSecret } from '../config/index.js';
import { MenteeProfile, User, UserAuthProvider } from '../users/index.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleIdentityService } from './google-identity.service.js';
import { googleProviders } from './google.providers.js';

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;

@Module({
  imports: [
    TypeOrmModule.forFeature([User, MenteeProfile, UserAuthProvider]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleIdentityService, ...googleProviders],
  exports: [AuthService],
})
export class AuthModule {}
