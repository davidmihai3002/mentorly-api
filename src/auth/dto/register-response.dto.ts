import type { UserRole } from '../../users/index.js';

export interface RegisterResponseDto {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}
