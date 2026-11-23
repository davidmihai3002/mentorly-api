import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { GOOGLE_CLIENT_ID } from './google.providers.js';
import { normalizeEmail } from './utils/index.js';

const GOOGLE_SIGN_IN_FAILED_MESSAGE = 'Google sign-in failed.';

export interface GoogleIdentity {
  googleUserId: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class GoogleIdentityService {
  constructor(
    private readonly oauthClient: OAuth2Client,
    @Inject(GOOGLE_CLIENT_ID) private readonly clientId: string,
  ) {}

  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    const payload = await this.findVerifiedPayload(idToken);
    const googleEmail = payload?.email;
    const hasVerifiedEmail =
      payload?.email_verified === true && googleEmail !== undefined;
    if (!hasVerifiedEmail) {
      throw new UnauthorizedException(GOOGLE_SIGN_IN_FAILED_MESSAGE);
    }

    const email = normalizeEmail(googleEmail);
    const firstName = payload.given_name ?? '';
    const lastName = payload.family_name ?? '';
    return { googleUserId: payload.sub, email, firstName, lastName };
  }

  private async findVerifiedPayload(
    idToken: string,
  ): Promise<TokenPayload | undefined> {
    try {
      const loginTicket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      const payload = loginTicket.getPayload();
      return payload;
    } catch {
      throw new UnauthorizedException(GOOGLE_SIGN_IN_FAILED_MESSAGE);
    }
  }
}
