import { getMonthlyDiscountPercent } from './monthly-discount.util.js';

describe('getMonthlyDiscountPercent', () => {
  it('returns 17 for 4 sessions at 15000 bani against a monthly price of 50000 bani', () => {
    expect(getMonthlyDiscountPercent(15000, 50000, 4)).toBe(17);
  });

  it.each([
    ['the per-session price', null, 50000, 4],
    ['the monthly price', 15000, null, 4],
    ['the number of sessions per month', 15000, 50000, null],
  ])(
    'returns null when %s is missing',
    (
      _missingField,
      perSessionPriceBani,
      monthlyPriceBani,
      monthlySessionsCount,
    ) => {
      expect(
        getMonthlyDiscountPercent(
          perSessionPriceBani,
          monthlyPriceBani,
          monthlySessionsCount,
        ),
      ).toBeNull();
    },
  );

  it('returns a negative discount when the monthly price is above N times the per-session price', () => {
    expect(getMonthlyDiscountPercent(10000, 50000, 4)).toBe(-25);
  });
});
