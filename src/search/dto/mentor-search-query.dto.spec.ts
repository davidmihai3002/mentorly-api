import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { MentorSearchQueryDto } from './mentor-search-query.dto.js';

const queryMetadata: ArgumentMetadata = {
  type: 'query',
  metatype: MentorSearchQueryDto,
};

const validateQuery = (query: object): Promise<unknown> =>
  createValidationPipe().transform(query, queryMetadata);

const toQueryDto = (paging: object): MentorSearchQueryDto =>
  Object.assign(new MentorSearchQueryDto(), paging);

describe('MentorSearchQueryDto validation', () => {
  it('defaults to page 1 with 20 mentors per page', async () => {
    const defaultPaging = toQueryDto({ page: 1, pageSize: 20 });

    await expect(validateQuery({})).resolves.toStrictEqual(defaultPaging);
  });

  it('accepts a page size of 50 and reads both values as numbers', async () => {
    const largestPage = toQueryDto({ page: 3, pageSize: 50 });

    await expect(
      validateQuery({ page: '3', pageSize: '50' }),
    ).resolves.toStrictEqual(largestPage);
  });

  it.each([
    ['page 0', { page: '0' }],
    ['a page size of 0', { pageSize: '0' }],
    ['a page size of 51', { pageSize: '51' }],
    ['a page that is not an integer', { page: '1.5' }],
  ])('rejects %s', async (_case, query) => {
    await expect(validateQuery(query)).rejects.toThrow(BadRequestException);
  });
});
