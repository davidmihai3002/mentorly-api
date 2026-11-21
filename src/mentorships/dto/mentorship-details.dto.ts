import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';
import {
  MULTILINE_TEXT_MESSAGE,
  MULTILINE_TEXT_PATTERN,
  trimText,
} from '../../common/index.js';

export class MentorshipDetailsDto {
  @IsOptional()
  @Transform(trimText)
  @Matches(MULTILINE_TEXT_PATTERN, { message: MULTILINE_TEXT_MESSAGE })
  description?: string | null;

  @IsOptional()
  @Transform(trimText)
  @Matches(MULTILINE_TEXT_PATTERN, { message: MULTILINE_TEXT_MESSAGE })
  conditions?: string | null;

  @IsOptional()
  @Transform(trimText)
  @Matches(MULTILINE_TEXT_PATTERN, { message: MULTILINE_TEXT_MESSAGE })
  minKnowledge?: string | null;
}
