import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { REFRESH_TOKEN_COOKIE } from './refresh-token-cookie.js';

export const RefreshToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieValue: unknown = request.cookies[REFRESH_TOKEN_COOKIE];
    const refreshToken = typeof cookieValue === 'string' ? cookieValue : '';
    return refreshToken;
  },
);
