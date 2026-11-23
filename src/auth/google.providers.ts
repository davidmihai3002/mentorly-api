import type { Provider } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { getGoogleClientId } from '../config/index.js';

export const GOOGLE_CLIENT_ID = Symbol('GOOGLE_CLIENT_ID');

const createOAuth2Client = (): OAuth2Client => new OAuth2Client();

export const googleProviders: Provider[] = [
  { provide: GOOGLE_CLIENT_ID, useFactory: getGoogleClientId },
  { provide: OAuth2Client, useFactory: createOAuth2Client },
];
