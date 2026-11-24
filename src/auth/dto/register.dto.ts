import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, Matches, MinLength } from 'class-validator';
import {
  SINGLE_LINE_TEXT_MESSAGE,
  SINGLE_LINE_TEXT_PATTERN,
  trimText,
} from '../../common/index.js';
import { toNormalizedEmail } from '../utils/index.js';
import { SignUpBaseDto } from './sign-up-base.dto.js';

const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_MAX_PASSWORD_BYTES = 72;
const CONTAINS_LETTER_AND_DIGIT = /^(?=.*\p{L})(?=.*\d)/su;

export class RegisterDto extends SignUpBaseDto {
  @Transform(trimText)
  @Matches(SINGLE_LINE_TEXT_PATTERN, { message: SINGLE_LINE_TEXT_MESSAGE })
  firstName: string;

  @Transform(trimText)
  @Matches(SINGLE_LINE_TEXT_PATTERN, { message: SINGLE_LINE_TEXT_MESSAGE })
  lastName: string;

  @Transform(toNormalizedEmail)
  @IsEmail()
  email: string;

  @MinLength(PASSWORD_MIN_LENGTH)
  @IsByteLength(0, BCRYPT_MAX_PASSWORD_BYTES, {
    message: `password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes long (letters with diacritics count as 2)`,
  })
  @Matches(CONTAINS_LETTER_AND_DIGIT, {
    message: 'password must contain a letter and a digit',
  })
  password: string;
}
