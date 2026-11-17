import { BadRequestException, Catch, ConflictException } from '@nestjs/common';
import type { ArgumentsHost, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';
const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';

const HTTP_EXCEPTION_BY_SQL_STATE: Partial<
  Record<string, () => HttpException>
> = {
  [UNIQUE_VIOLATION]: () =>
    new ConflictException('A record with the same value already exists.'),
  [EXCLUSION_VIOLATION]: () =>
    new ConflictException('This overlaps with an existing record.'),
  [CHECK_VIOLATION]: () =>
    new BadRequestException('The data breaks a validation rule.'),
  [FOREIGN_KEY_VIOLATION]: () =>
    new BadRequestException(
      'A referenced record does not exist or is still in use.',
    ),
};

@Catch(QueryFailedError)
export class DbConstraintExceptionFilter extends BaseExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const { driverError } = exception;
    const sqlState = 'code' in driverError ? String(driverError.code) : '';
    const createHttpException = HTTP_EXCEPTION_BY_SQL_STATE[sqlState];
    const exceptionToHandle = createHttpException?.() ?? exception;
    super.catch(exceptionToHandle, host);
  }
}
