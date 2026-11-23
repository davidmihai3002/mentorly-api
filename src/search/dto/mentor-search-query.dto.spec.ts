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

const MARKETING_DOMAIN_ID = '2b8e5c1f-7d4a-4f9e-a6b3-0e7c4d1a9f52';
const DEFAULT_PAGING = { page: 1, pageSize: 20 };

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
    ['a domain id that is not a UUID', { domainId: 'marketing' }],
    ['a negative minimum price', { minPriceBani: '-1' }],
    ['a maximum price over 2147483647 bani', { maxPriceBani: '2147483648' }],
    ['a price that is not an integer', { minPriceBani: '100.5' }],
    ['a minimum rating of 0', { minRating: '0' }],
    ['a minimum rating of 5.5', { minRating: '5.5' }],
    ['a free seats filter other than true or false', { hasFreeSeats: 'yes' }],
    [
      'a free time filter other than true or false',
      { hasFreeTimeThisWeek: 'TRUE' },
    ],
  ])('rejects %s', async (_case, query) => {
    await expect(validateQuery(query)).rejects.toThrow(BadRequestException);
  });

  it.each([
    [
      'a domain',
      { domainId: MARKETING_DOMAIN_ID },
      { domainId: MARKETING_DOMAIN_ID },
    ],
    ['a minimum price of 0 bani', { minPriceBani: '0' }, { minPriceBani: 0 }],
    [
      'a maximum price of 2147483647 bani',
      { maxPriceBani: '2147483647' },
      { maxPriceBani: 2147483647 },
    ],
    ['a minimum rating of 1', { minRating: '1' }, { minRating: 1 }],
    ['a minimum rating of 4.5', { minRating: '4.5' }, { minRating: 4.5 }],
    ['a minimum rating of 5', { minRating: '5' }, { minRating: 5 }],
    ['free seats', { hasFreeSeats: 'true' }, { hasFreeSeats: true }],
    [
      'free time this week',
      { hasFreeTimeThisWeek: 'true' },
      { hasFreeTimeThisWeek: true },
    ],
    [
      'free seats and free time set to false',
      { hasFreeSeats: 'false', hasFreeTimeThisWeek: 'false' },
      { hasFreeSeats: false, hasFreeTimeThisWeek: false },
    ],
  ])('accepts %s on its own', async (_case, query, filters) => {
    const filteredQuery = toQueryDto({ ...DEFAULT_PAGING, ...filters });

    await expect(validateQuery(query)).resolves.toStrictEqual(filteredQuery);
  });

  it('accepts all filters together with paging and reads numbers and booleans from the query text', async () => {
    const filteredQuery = toQueryDto({
      page: 2,
      pageSize: 10,
      domainId: MARKETING_DOMAIN_ID,
      minPriceBani: 5000,
      maxPriceBani: 20000,
      minRating: 4,
      hasFreeSeats: true,
      hasFreeTimeThisWeek: true,
    });

    await expect(
      validateQuery({
        page: '2',
        pageSize: '10',
        domainId: MARKETING_DOMAIN_ID,
        minPriceBani: '5000',
        maxPriceBani: '20000',
        minRating: '4',
        hasFreeSeats: 'true',
        hasFreeTimeThisWeek: 'true',
      }),
    ).resolves.toStrictEqual(filteredQuery);
  });
});
