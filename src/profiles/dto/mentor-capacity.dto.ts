import { IsInt, IsOptional, IsPositive, Max } from 'class-validator';

const POSTGRES_SMALLINT_MAX = 32767;

export class MentorCapacityDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(POSTGRES_SMALLINT_MAX)
  capacity?: number | null;
}
