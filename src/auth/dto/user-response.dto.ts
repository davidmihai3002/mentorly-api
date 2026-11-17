import type { UserRole } from '../../users/index.js';

export interface UserResponseDto {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}
