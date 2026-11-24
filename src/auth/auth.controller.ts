import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthSession } from './auth-session.interface.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './authenticated-request.interface.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  GoogleLoginDto,
  GoogleRegisterDto,
  LoginDto,
  RegisterDto,
  type LoginResponseDto,
} from './dto/index.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from './refresh-token-cookie.js';
import { RefreshToken } from './refresh-token.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() signUp: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.authService.register(signUp);
    const loginResponse = this.respondWithSession(session, response);
    return loginResponse;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() credentials: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.authService.login(credentials);
    const loginResponse = this.respondWithSession(session, response);
    return loginResponse;
  }

  @Post('google/register')
  async googleRegister(
    @Body() signUp: GoogleRegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.authService.googleRegister(signUp);
    const loginResponse = this.respondWithSession(session, response);
    return loginResponse;
  }

  @Post('google/login')
  @HttpCode(HttpStatus.OK)
  async googleLogin(
    @Body() googleLogin: GoogleLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.authService.googleLogin(googleLogin.idToken);
    const loginResponse = this.respondWithSession(session, response);
    return loginResponse;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @RefreshToken() refreshToken: string,
  ): Promise<LoginResponseDto> {
    const refreshResponse = await this.authService.refresh(refreshToken);
    return refreshResponse;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(currentUser.id);
    response.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_OPTIONS);
  }

  private respondWithSession(
    { accessToken, refreshToken, user }: AuthSession,
    response: Response,
  ): LoginResponseDto {
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );
    return { accessToken, user };
  }
}
