import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  LoginTicket,
  OAuth2Client,
  type TokenPayload,
  type VerifyIdTokenOptions,
} from 'google-auth-library';
import { GoogleIdentityService } from './google-identity.service.js';
import { GOOGLE_CLIENT_ID } from './google.providers.js';

const CLIENT_ID = 'unit-test-only-client-id.apps.googleusercontent.com';
const ID_TOKEN = 'google-id-token-value';
const GOOGLE_USER_ID = '109876543210987654321';
const GOOGLE_SIGN_IN_FAILED = new UnauthorizedException(
  'Google sign-in failed.',
);

const verifiedPayload = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: GOOGLE_USER_ID,
  iat: 1795420800,
  exp: 1795424400,
  email: ' Ana.Pop@Example.COM ',
  email_verified: true,
  given_name: 'Ana',
  family_name: 'Pop',
} satisfies TokenPayload;

const ticketWith = (payload?: TokenPayload): LoginTicket =>
  new LoginTicket(undefined, payload);

describe('GoogleIdentityService', () => {
  const oauthClient = {
    verifyIdToken:
      vi.fn<(options: VerifyIdTokenOptions) => Promise<LoginTicket>>(),
  };
  let googleIdentityService: GoogleIdentityService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const testingModule = await Test.createTestingModule({
      providers: [
        GoogleIdentityService,
        { provide: OAuth2Client, useValue: oauthClient },
        { provide: GOOGLE_CLIENT_ID, useValue: CLIENT_ID },
      ],
    }).compile();

    googleIdentityService = testingModule.get(GoogleIdentityService);
  });

  it('verifies the ID token with our client ID as the audience', async () => {
    oauthClient.verifyIdToken.mockResolvedValue(ticketWith(verifiedPayload));

    await googleIdentityService.verifyIdToken(ID_TOKEN);

    expect(oauthClient.verifyIdToken).toHaveBeenCalledExactlyOnceWith({
      idToken: ID_TOKEN,
      audience: CLIENT_ID,
    });
  });

  it('returns the Google user id, the normalized email and the names from the token', async () => {
    oauthClient.verifyIdToken.mockResolvedValue(ticketWith(verifiedPayload));

    await expect(
      googleIdentityService.verifyIdToken(ID_TOKEN),
    ).resolves.toStrictEqual({
      googleUserId: GOOGLE_USER_ID,
      email: 'ana.pop@example.com',
      firstName: 'Ana',
      lastName: 'Pop',
    });
  });

  it('uses empty names when Google sends no given or family name', async () => {
    const payloadWithoutNames = {
      ...verifiedPayload,
      given_name: undefined,
      family_name: undefined,
    };
    oauthClient.verifyIdToken.mockResolvedValue(
      ticketWith(payloadWithoutNames),
    );

    await expect(
      googleIdentityService.verifyIdToken(ID_TOKEN),
    ).resolves.toStrictEqual({
      googleUserId: GOOGLE_USER_ID,
      email: 'ana.pop@example.com',
      firstName: '',
      lastName: '',
    });
  });

  it('rejects with 401 when Google rejects the token', async () => {
    oauthClient.verifyIdToken.mockRejectedValue(
      new Error('Wrong recipient, payload audience != requiredAudience'),
    );

    await expect(googleIdentityService.verifyIdToken(ID_TOKEN)).rejects.toThrow(
      GOOGLE_SIGN_IN_FAILED,
    );
  });

  it('rejects with 401 when the verified token has no payload', async () => {
    oauthClient.verifyIdToken.mockResolvedValue(ticketWith());

    await expect(googleIdentityService.verifyIdToken(ID_TOKEN)).rejects.toThrow(
      GOOGLE_SIGN_IN_FAILED,
    );
  });

  it.each([
    ['an email that is not verified', { email_verified: false }],
    ['no email verification flag', { email_verified: undefined }],
    ['no email', { email: undefined }],
  ])('rejects with 401 a token with %s', async (_problem, changes) => {
    const unverifiedPayload = { ...verifiedPayload, ...changes };
    oauthClient.verifyIdToken.mockResolvedValue(ticketWith(unverifiedPayload));

    await expect(googleIdentityService.verifyIdToken(ID_TOKEN)).rejects.toThrow(
      GOOGLE_SIGN_IN_FAILED,
    );
  });
});
