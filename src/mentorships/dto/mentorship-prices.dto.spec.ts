import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { MentorshipPricesDto } from './mentorship-prices.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: MentorshipPricesDto,
};

const validBody = {
  perSessionPriceBani: 15000,
  monthlyPriceBani: 50000,
  monthlySessionsCount: 4,
};

const validateMentorshipPrices = (body: object): Promise<unknown> =>
  createValidationPipe().transform(body, bodyMetadata);

describe('MentorshipPricesDto validation', () => {
  it('accepts a body with all three fields', async () => {
    const validDto = Object.assign(new MentorshipPricesDto(), validBody);

    await expect(validateMentorshipPrices(validBody)).resolves.toStrictEqual(
      validDto,
    );
  });

  it('accepts an empty body', async () => {
    const emptyDto = new MentorshipPricesDto();

    await expect(validateMentorshipPrices({})).resolves.toStrictEqual(emptyDto);
  });

  it('accepts 2147483647 for both prices and 32767 sessions per month', async () => {
    const columnLimitsBody = {
      perSessionPriceBani: 2147483647,
      monthlyPriceBani: 2147483647,
      monthlySessionsCount: 32767,
    };
    const columnLimitsDto = Object.assign(
      new MentorshipPricesDto(),
      columnLimitsBody,
    );

    await expect(
      validateMentorshipPrices(columnLimitsBody),
    ).resolves.toStrictEqual(columnLimitsDto);
  });

  it.each([
    ['a per-session price of 0', { perSessionPriceBani: 0 }],
    ['a monthly price of 0', { monthlyPriceBani: 0 }],
    ['0 sessions per month', { monthlySessionsCount: 0 }],
    ['a per-session price of 15000.5', { perSessionPriceBani: 15000.5 }],
    ['a monthly price of 50000.5', { monthlyPriceBani: 50000.5 }],
    ['4.5 sessions per month', { monthlySessionsCount: 4.5 }],
    ['a per-session price of 2147483648', { perSessionPriceBani: 2147483648 }],
    ['a monthly price of 2147483648', { monthlyPriceBani: 2147483648 }],
    ['32768 sessions per month', { monthlySessionsCount: 32768 }],
  ])('rejects %s', async (_problem, changes) => {
    await expect(
      validateMentorshipPrices({ ...validBody, ...changes }),
    ).rejects.toThrow(BadRequestException);
  });
});
