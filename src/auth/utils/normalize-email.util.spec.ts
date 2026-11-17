import { TransformationType, type TransformFnParams } from 'class-transformer';
import { toNormalizedEmail } from './normalize-email.util.js';

const normalizeEmailField = (value: unknown): unknown => {
  const transformParams: TransformFnParams = {
    value,
    key: 'email',
    obj: { email: value },
    type: TransformationType.PLAIN_TO_CLASS,
    options: {},
  };
  return toNormalizedEmail(transformParams);
};

describe('toNormalizedEmail', () => {
  it('trims, lowercases and NFC-normalizes the email', () => {
    const decomposedEmail = '  S\u0326tefan.Pop@Example.COM ';

    expect(normalizeEmailField(decomposedEmail)).toBe(
      '\u0219tefan.pop@example.com',
    );
  });

  it.each([
    ['a number', 42],
    ['null', null],
    ['undefined', undefined],
    ['an object', { email: 'ana.pop@example.com' }],
  ])('passes %s through unchanged', (_kind, value) => {
    expect(normalizeEmailField(value)).toBe(value);
  });
});
