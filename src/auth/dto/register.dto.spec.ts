import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { RegisterDto } from './register.dto.js';

const bodyMetadata: ArgumentMetadata = { type: 'body', metatype: RegisterDto };

const validBody = {
  role: 'MENTEE',
  firstName: 'Ana',
  lastName: 'Pop',
  email: 'ștefan@x.ro',
  password: 'parola123',
  birthDate: '2001-03-15',
  hasAcceptedTerms: true,
};

const validateSignUp = (changes: object): Promise<unknown> =>
  createValidationPipe().transform({ ...validBody, ...changes }, bodyMetadata);

describe('RegisterDto validation', () => {
  beforeAll(() => vi.setSystemTime(new Date('2026-11-12T12:00:00.000Z')));

  it('accepts a sign-up with a trimmed first name and a normalized email', async () => {
    const messyFields = { firstName: ' Ana ', email: ' Ștefan@X.RO ' };
    const cleanDto = Object.assign(new RegisterDto(), validBody);

    await expect(validateSignUp(messyFields)).resolves.toStrictEqual(cleanDto);
  });

  it.each([
    ['exactly 8 characters', 'parola12'],
    ['exactly 72 characters', `${'a'.repeat(71)}1`],
    ['only letters with diacritics', 'ășțîâ123'],
  ])('accepts a password with %s', async (_rule, password) => {
    await expect(validateSignUp({ password })).resolves.toBeDefined();
  });

  it.each([
    ['an unknown field', { isAdmin: true }],
    ['an unknown role', { role: 'ADMIN' }],
    ['a missing first name', { firstName: undefined }],
    ['a blank first name', { firstName: '   ' }],
    ['a blank last name', { lastName: '   ' }],
    ['a control character in a name', { firstName: 'An\u0000a' }],
    ['an invalid email', { email: 'ana.pop.example.com' }],
    ['a password shorter than 8 characters', { password: 'parol12' }],
    ['a password over 72 characters', { password: `${'a'.repeat(72)}1` }],
    ['a password over 72 bytes', { password: `${'ă'.repeat(40)}1` }],
    ['a password without a digit', { password: 'parolafara' }],
    ['a password without a letter', { password: '12345678' }],
    ['a birth date of today', { birthDate: '2026-11-12' }],
    ['a birth date in the future', { birthDate: '2026-11-13' }],
    ['a birth date that does not exist', { birthDate: '2023-02-30' }],
    ['a birth date with a time', { birthDate: '2001-03-15T10:00:00Z' }],
    ['terms that were not accepted', { hasAcceptedTerms: false }],
    ['a missing terms acceptance', { hasAcceptedTerms: undefined }],
  ])('rejects a sign-up with %s', async (_problem, changes) => {
    await expect(validateSignUp(changes)).rejects.toThrow(BadRequestException);
  });
});
