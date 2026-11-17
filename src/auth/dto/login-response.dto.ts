import type { UserResponseDto } from './user-response.dto.js';

export interface LoginResponseDto {
  accessToken: string;
  user: UserResponseDto;
}
