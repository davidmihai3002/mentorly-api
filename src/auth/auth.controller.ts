import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto, type RegisterResponseDto } from './dto/index.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() signUp: RegisterDto): Promise<RegisterResponseDto> {
    const registeredUser = await this.authService.register(signUp);
    return registeredUser;
  }
}
