import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { GoogleRegisterDto } from './google-register.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: GoogleRegisterDto,
};

const validBody = {
  idToken: 'google-id-token-value',
  role: 'MENTOR',
  birthDate: '2001-03-15',
  hasAcceptedTerms: true,
};

const validateGoogleSignUp = (changes: object): Promise<unknown> =>
  createValidationPipe().transform({ ...validBody, ...changes }, bodyMetadata);

describe('GoogleRegisterDto validation', () => {
  beforeAll(() => vi.setSystemTime(new Date('2026-11-12T12:00:00.000Z')));

  it('accepts a Google sign-up with an ID token, a role, a past birth date and accepted terms', async () => {
    const validDto = Object.assign(new GoogleRegisterDto(), validBody);

    await expect(validateGoogleSignUp({})).resolves.toStrictEqual(validDto);
  });

  it.each([
    ['a missing ID token', { idToken: undefined }],
    ['an empty ID token', { idToken: '' }],
    ['an ID token that is not a string', { idToken: 42 }],
    ['a birth date that does not exist', { birthDate: '2023-02-30' }],
    ['terms that were not accepted', { hasAcceptedTerms: false }],
  ])('rejects a Google sign-up with %s', async (_problem, changes) => {
    await expect(validateGoogleSignUp(changes)).rejects.toThrow(
      BadRequestException,
    );
  });
});
