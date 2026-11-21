import { Transform } from 'class-transformer';
import { IsUUID, Matches, MaxLength } from 'class-validator';
import {
  MULTILINE_TEXT_MESSAGE,
  MULTILINE_TEXT_PATTERN,
  trimText,
} from '../../common/index.js';

const MATCHING_FORM_TEXT_MAX_LENGTH = 2000;

export class MatchingFormDto {
  @IsUUID()
  domainId: string;

  @Transform(trimText)
  @Matches(MULTILINE_TEXT_PATTERN, { message: MULTILINE_TEXT_MESSAGE })
  @MaxLength(MATCHING_FORM_TEXT_MAX_LENGTH)
  needs: string;

  @Transform(trimText)
  @Matches(MULTILINE_TEXT_PATTERN, { message: MULTILINE_TEXT_MESSAGE })
  @MaxLength(MATCHING_FORM_TEXT_MAX_LENGTH)
  studies: string;

  @Transform(trimText)
  @Matches(MULTILINE_TEXT_PATTERN, { message: MULTILINE_TEXT_MESSAGE })
  @MaxLength(MATCHING_FORM_TEXT_MAX_LENGTH)
  careerGoals: string;
}
