import { IsInt, IsOptional, IsPositive, Max } from 'class-validator';
import { POSTGRES_SMALLINT_MAX } from '../../common/index.js';

export class MentorCapacityDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(POSTGRES_SMALLINT_MAX)
  capacity?: number | null;
}
