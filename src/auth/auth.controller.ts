import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './authenticated-request.interface.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  LoginDto,
  RegisterDto,
  type LoginResponseDto,
  type UserResponseDto,
} from './dto/index.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() signUp: RegisterDto): Promise<UserResponseDto> {
    const registeredUser = await this.authService.register(signUp);
    return registeredUser;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() credentials: LoginDto): Promise<LoginResponseDto> {
    const loginResponse = await this.authService.login(credentials);
    return loginResponse;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() currentUser: AuthenticatedUser): Promise<void> {
    await this.authService.logout(currentUser.id);
  }
}
