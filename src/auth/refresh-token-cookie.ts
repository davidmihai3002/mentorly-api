import type { CookieOptions } from 'express';

const MILLISECONDS_PER_SECOND = 1000;

export const REFRESH_TOKEN_COOKIE = 'refreshToken';

export const REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: REFRESH_TOKEN_LIFETIME_SECONDS * MILLISECONDS_PER_SECOND,
};
