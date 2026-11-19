import { Transform } from 'class-transformer';
import { IsUUID, Matches, MaxLength } from 'class-validator';
import { trimText } from '../../common/index.js';

const MATCHING_FORM_TEXT_MAX_LENGTH = 2000;

const FILLED_WITHOUT_CONTROL_CHARACTERS_EXCEPT_TAB_AND_LINE_BREAKS =
  /^(?:\P{Cc}|[\t\n\r])+$/u;
const MATCHING_FORM_TEXT_MESSAGE =
  '$property must be non-empty text without control characters other than tabs and line breaks';

export class MatchingFormDto {
  @IsUUID()
  domainId: string;

  @Transform(trimText)
  @Matches(FILLED_WITHOUT_CONTROL_CHARACTERS_EXCEPT_TAB_AND_LINE_BREAKS, {
    message: MATCHING_FORM_TEXT_MESSAGE,
  })
  @MaxLength(MATCHING_FORM_TEXT_MAX_LENGTH)
  needs: string;

  @Transform(trimText)
  @Matches(FILLED_WITHOUT_CONTROL_CHARACTERS_EXCEPT_TAB_AND_LINE_BREAKS, {
    message: MATCHING_FORM_TEXT_MESSAGE,
  })
  @MaxLength(MATCHING_FORM_TEXT_MAX_LENGTH)
  studies: string;

  @Transform(trimText)
  @Matches(FILLED_WITHOUT_CONTROL_CHARACTERS_EXCEPT_TAB_AND_LINE_BREAKS, {
    message: MATCHING_FORM_TEXT_MESSAGE,
  })
  @MaxLength(MATCHING_FORM_TEXT_MAX_LENGTH)
  careerGoals: string;
}
