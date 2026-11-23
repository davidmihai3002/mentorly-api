import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { GoogleLoginDto } from './google-login.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: GoogleLoginDto,
};

const GOOGLE_ID_TOKEN = 'google-id-token-value';

const validateGoogleLogin = (body: object): Promise<unknown> =>
  createValidationPipe().transform(body, bodyMetadata);

describe('GoogleLoginDto validation', () => {
  it('accepts a Google login with an ID token', async () => {
    const validBody = { idToken: GOOGLE_ID_TOKEN };
    const validDto = Object.assign(new GoogleLoginDto(), validBody);

    await expect(validateGoogleLogin(validBody)).resolves.toStrictEqual(
      validDto,
    );
  });

  it.each([
    ['an empty ID token', { idToken: '' }],
    ['a missing ID token', {}],
    ['an unknown field', { idToken: GOOGLE_ID_TOKEN, isAdmin: true }],
  ])('rejects a Google login with %s', async (_problem, body) => {
    await expect(validateGoogleLogin(body)).rejects.toThrow(
      BadRequestException,
    );
  });
});
