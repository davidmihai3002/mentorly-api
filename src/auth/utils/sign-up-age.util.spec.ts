import { isOldEnoughToSignUp } from './sign-up-age.util.js';

const SIGN_UP_TIME = new Date('2026-11-12T09:30:00.000Z');

describe('isOldEnoughToSignUp', () => {
  it('accepts a sign-up when the user turns 16 today', () => {
    expect(isOldEnoughToSignUp('2010-11-12', SIGN_UP_TIME)).toBe(true);
  });

  it('rejects a sign-up when the user turns 16 tomorrow', () => {
    expect(isOldEnoughToSignUp('2010-11-13', SIGN_UP_TIME)).toBe(false);
  });

  it('rejects a user born on 29 February 2012 on 28 February 2028 and accepts them on 29 February 2028', () => {
    const dayBeforeLeapDay = new Date('2028-02-28T09:30:00.000Z');
    const leapDay = new Date('2028-02-29T09:30:00.000Z');

    expect(isOldEnoughToSignUp('2012-02-29', dayBeforeLeapDay)).toBe(false);
    expect(isOldEnoughToSignUp('2012-02-29', leapDay)).toBe(true);
  });
});
