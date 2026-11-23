import type { LoginResponseDto } from './dto/index.js';

export interface AuthSession extends LoginResponseDto {
  refreshToken: string;
}
