import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { MentorshipDetailsDto } from './mentorship-details.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: MentorshipDetailsDto,
};

const validBody = {
  description: 'Weekly code reviews and a backend project built together.',
  conditions: 'Two hours of practice between sessions.',
  minKnowledge: 'Basic JavaScript and Git.',
};

const validateMentorshipDetails = (body: object): Promise<unknown> =>
  createValidationPipe().transform(body, bodyMetadata);

describe('MentorshipDetailsDto validation', () => {
  it('accepts a body with all three fields', async () => {
    const validDto = Object.assign(new MentorshipDetailsDto(), validBody);

    await expect(validateMentorshipDetails(validBody)).resolves.toStrictEqual(
      validDto,
    );
  });

  it('accepts an empty body', async () => {
    const emptyDto = new MentorshipDetailsDto();

    await expect(validateMentorshipDetails({})).resolves.toStrictEqual(
      emptyDto,
    );
  });

  it.each(['description', 'conditions', 'minKnowledge'])(
    'rejects a blank %s',
    async (field) => {
      await expect(
        validateMentorshipDetails({ ...validBody, [field]: ' \r\n\t ' }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it.each(['description', 'conditions', 'minKnowledge'])(
    'rejects a control character in the %s',
    async (field) => {
      await expect(
        validateMentorshipDetails({ ...validBody, [field]: 'Git\u0000basics' }),
      ).rejects.toThrow(BadRequestException);
    },
  );
});
