import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

const FIRST_PAGE = 1;
const MIN_PAGE_SIZE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

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
}
