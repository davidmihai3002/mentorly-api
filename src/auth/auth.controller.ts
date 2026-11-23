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
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './authenticated-request.interface.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto, RegisterDto, type LoginResponseDto } from './dto/index.js';
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
    const { accessToken, refreshToken, user } =
      await this.authService.register(signUp);
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );
    return { accessToken, user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() credentials: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const { accessToken, refreshToken, user } =
      await this.authService.login(credentials);
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );
    return { accessToken, user };
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
}
