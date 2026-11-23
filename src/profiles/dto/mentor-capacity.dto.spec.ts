import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { MentorCapacityDto } from './mentor-capacity.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: MentorCapacityDto,
};

const validateCapacity = (body: object): Promise<unknown> =>
  createValidationPipe().transform(body, bodyMetadata);

describe('MentorCapacityDto validation', () => {
  it.each([
    ['the largest smallint capacity', { capacity: 32767 }],
    ['a null capacity', { capacity: null }],
    ['an empty body', {}],
  ])('accepts %s', async (_case, validBody) => {
    const validDto = Object.assign(new MentorCapacityDto(), validBody);

    await expect(validateCapacity(validBody)).resolves.toStrictEqual(validDto);
  });

  it.each([
    ['a capacity of 0', { capacity: 0 }],
    ['a capacity that is not an integer', { capacity: 2.5 }],
    ['a capacity above the smallint limit', { capacity: 32768 }],
  ])('rejects %s', async (_problem, invalidBody) => {
    await expect(validateCapacity(invalidBody)).rejects.toThrow(
      BadRequestException,
    );
  });
});
