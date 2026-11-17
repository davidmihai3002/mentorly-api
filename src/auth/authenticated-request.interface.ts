import type { Request } from 'express';
import type { UserRole } from '../users/index.js';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
