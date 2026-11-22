const PERCENT_SCALE = 100;
const FULL_PRICE_RATIO = 1;

export const getMonthlyDiscountPercent = (
  perSessionPriceBani: number | null,
  monthlyPriceBani: number | null,
  monthlySessionsCount: number | null,
): number | null => {
  const hasAllPriceFields =
    perSessionPriceBani !== null &&
    monthlyPriceBani !== null &&
    monthlySessionsCount !== null;
  if (!hasAllPriceFields) {
    return null;
  }
  const sessionsTotalPriceBani = monthlySessionsCount * perSessionPriceBani;
  const monthlyPriceRatio = monthlyPriceBani / sessionsTotalPriceBani;
  const discountRatio = FULL_PRICE_RATIO - monthlyPriceRatio;
  const discountPercent = Math.round(discountRatio * PERCENT_SCALE);
  return discountPercent;
};
