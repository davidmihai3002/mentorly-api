import { Reflector } from '@nestjs/core';
import type { UserRole } from '../users/index.js';

export const Roles = Reflector.createDecorator<UserRole[]>();
