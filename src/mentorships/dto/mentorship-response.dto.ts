export interface MentorshipResponseDto {
  description: string | null;
  conditions: string | null;
  minKnowledge: string | null;
  perSessionPriceBani: number | null;
  monthlyPriceBani: number | null;
  monthlySessionsCount: number | null;
  monthlyDiscountPercent: number | null;
  publishedAt: Date | null;
}
