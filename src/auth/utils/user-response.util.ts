import type { User } from '../../users/index.js';
import type { UserResponseDto } from '../dto/index.js';

export const toUserResponse = (user: User): UserResponseDto => {
  const { id, email, role, firstName, lastName } = user;
  return { id, email, role, firstName, lastName };
};
