import {
  Equals,
  IsEnum,
  IsISO8601,
  Matches,
  ValidateBy,
} from 'class-validator';
import { USER_ROLE, type UserRole } from '../../users/index.js';

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const isPastDate = (value: unknown): boolean => {
  const [today] = new Date().toISOString().split('T');
  const isBeforeToday = typeof value === 'string' && value < today;
  return isBeforeToday;
};

export class SignUpBaseDto {
  @IsEnum(USER_ROLE)
  role: UserRole;

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
