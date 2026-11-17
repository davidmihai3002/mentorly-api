import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';
import { DbConstraintExceptionFilter } from './db-constraint-exception.filter.js';

const buildQueryFailedError = (code: string): QueryFailedError => {
  const driverError = Object.assign(new Error('constraint violated'), { code });
  return new QueryFailedError('INSERT INTO users', [], driverError);
};

describe('DbConstraintExceptionFilter', () => {
  const host = {} as ArgumentsHost;
  const filter = new DbConstraintExceptionFilter();

  afterEach(() => vi.restoreAllMocks());

  it.each([
    { violation: 'unique', sqlState: '23505', error: ConflictException },
    { violation: 'exclusion', sqlState: '23P01', error: ConflictException },
    { violation: 'check', sqlState: '23514', error: BadRequestException },
    { violation: 'foreign key', sqlState: '23503', error: BadRequestException },
    { violation: 'non-constraint', sqlState: '42P01', error: QueryFailedError },
  ])('forwards $violation errors as $error.name', ({ sqlState, error }) => {
    const defaultCatch = vi
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
    const queryFailedError = buildQueryFailedError(sqlState);

    filter.catch(queryFailedError, host);

    expect(defaultCatch).toHaveBeenCalledWith(expect.any(error), host);
  });
});
