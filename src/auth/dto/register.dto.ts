import { Transform } from 'class-transformer';
import {
  Equals,
  IsByteLength,
  IsEmail,
  IsEnum,
  IsISO8601,
  Matches,
  MinLength,
  ValidateBy,
} from 'class-validator';
import { trimText } from '../../common/index.js';
import { USER_ROLE, type UserRole } from '../../users/index.js';
import { toNormalizedEmail } from '../utils/index.js';

const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_MAX_PASSWORD_BYTES = 72;
const CONTAINS_LETTER_AND_DIGIT = /^(?=.*\p{L})(?=.*\d)/su;
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const FILLED_WITHOUT_CONTROL_CHARACTERS = /^\P{Cc}+$/u;
const NAME_MESSAGE =
  '$property must be non-empty text without control characters';

const isPastDate = (value: unknown): boolean => {
  const [today] = new Date().toISOString().split('T');
  const isBeforeToday = typeof value === 'string' && value < today;
  return isBeforeToday;
};

export class RegisterDto {
  @IsEnum(USER_ROLE)
  role: UserRole;

  @Transform(trimText)
  @Matches(FILLED_WITHOUT_CONTROL_CHARACTERS, { message: NAME_MESSAGE })
  firstName: string;

  @Transform(trimText)
  @Matches(FILLED_WITHOUT_CONTROL_CHARACTERS, { message: NAME_MESSAGE })
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

  @Matches(ISO_DATE_ONLY, { message: 'birthDate must be in YYYY-MM-DD format' })
  @IsISO8601({ strict: true }, { message: 'birthDate must be a valid date' })
  @ValidateBy(
    { name: 'isPastDate', validator: { validate: isPastDate } },
    { message: 'birthDate must be a date in the past' },
  )
  birthDate: string;

  @Equals(true)
  hasAcceptedTerms: boolean;
}
