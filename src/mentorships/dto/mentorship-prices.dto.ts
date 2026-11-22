import { IsInt, IsOptional, Max, Min } from 'class-validator';

const MIN_PRICE_FIELD_VALUE = 1;
const POSTGRES_INTEGER_MAX = 2147483647;
const POSTGRES_SMALLINT_MAX = 32767;

export class MentorshipPricesDto {
  @IsOptional()
  @IsInt()
  @Min(MIN_PRICE_FIELD_VALUE)
  @Max(POSTGRES_INTEGER_MAX)
  perSessionPriceBani?: number | null;

  @IsOptional()
  @IsInt()
  @Min(MIN_PRICE_FIELD_VALUE)
  @Max(POSTGRES_INTEGER_MAX)
  monthlyPriceBani?: number | null;

  @IsOptional()
  @IsInt()
  @Min(MIN_PRICE_FIELD_VALUE)
  @Max(POSTGRES_SMALLINT_MAX)
  monthlySessionsCount?: number | null;
}
