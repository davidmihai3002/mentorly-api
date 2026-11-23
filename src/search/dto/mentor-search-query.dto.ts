import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { POSTGRES_INTEGER_MAX, parseBooleanText } from '../../common/index.js';

const FIRST_PAGE = 1;
const MIN_PAGE_SIZE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MIN_PRICE_FILTER_BANI = 0;
const MIN_REVIEW_RATING = 1;
const MAX_REVIEW_RATING = 5;

export class MentorSearchQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(FIRST_PAGE)
  page: number = FIRST_PAGE;

  @Type(() => Number)
  @IsInt()
  @Min(MIN_PAGE_SIZE)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsUUID()
  domainId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_PRICE_FILTER_BANI)
  @Max(POSTGRES_INTEGER_MAX)
  minPriceBani?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_PRICE_FILTER_BANI)
  @Max(POSTGRES_INTEGER_MAX)
  maxPriceBani?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_REVIEW_RATING)
  @Max(MAX_REVIEW_RATING)
  minRating?: number;

  @IsOptional()
  @Transform(parseBooleanText)
  @IsBoolean()
  hasFreeSeats?: boolean;

  @IsOptional()
  @Transform(parseBooleanText)
  @IsBoolean()
  hasFreeTimeThisWeek?: boolean;
}
