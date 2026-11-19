import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { MatchingFormDto } from './matching-form.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: MatchingFormDto,
};

const validBody = {
  domainId: '5a8c2e1f-4b7d-4e9a-8c3f-6d1e2b4a7c90',
  needs: 'Feedback on my CV and practice for job interviews.',
  studies: 'Second year of Computer Science at the University of Bucharest.',
  careerGoals: 'A junior backend developer role within a year.',
};

const textOf2000Characters = 'a'.repeat(2000);
const textOf2001Characters = 'a'.repeat(2001);

const validateMatchingForm = (changes: object): Promise<unknown> =>
  createValidationPipe().transform({ ...validBody, ...changes }, bodyMetadata);

describe('MatchingFormDto validation', () => {
  it('accepts a complete matching form', async () => {
    const validDto = Object.assign(new MatchingFormDto(), validBody);

    await expect(validateMatchingForm({})).resolves.toStrictEqual(validDto);
  });

  it('trims the text and keeps tabs, \\n and \\r\\n line breaks inside it', async () => {
    const multilineFields = {
      needs: ' \r\n Feedback on my CV\r\nInterview practice\n\tmock calls \n',
      careerGoals: '\tBackend developer\n\tthen tech lead  ',
    };
    const trimmedDto = Object.assign(new MatchingFormDto(), validBody, {
      needs: 'Feedback on my CV\r\nInterview practice\n\tmock calls',
      careerGoals: 'Backend developer\n\tthen tech lead',
    });

    await expect(validateMatchingForm(multilineFields)).resolves.toStrictEqual(
      trimmedDto,
    );
  });

  it.each(['needs', 'studies', 'careerGoals'])(
    'accepts %s of exactly 2000 characters',
    async (field) => {
      await expect(
        validateMatchingForm({ [field]: textOf2000Characters }),
      ).resolves.toHaveProperty(field, textOf2000Characters);
    },
  );

  it.each([
    ['an unknown field', { onboardingCompletedAt: '2026-11-19' }],
    ['a missing domainId', { domainId: undefined }],
    ['a domainId that is not a UUID', { domainId: 'marketing' }],
    ['missing needs', { needs: undefined }],
    ['blank needs', { needs: ' \r\n\t ' }],
    ['missing studies', { studies: undefined }],
    ['blank studies', { studies: '   ' }],
    ['missing career goals', { careerGoals: undefined }],
    ['blank career goals', { careerGoals: '\n\n' }],
    ['a NUL character in the needs', { needs: 'CV\u0000feedback' }],
    ['another control character in the studies', { studies: 'Year\u00072' }],
    ['needs over 2000 characters', { needs: textOf2001Characters }],
    ['studies over 2000 characters', { studies: textOf2001Characters }],
    [
      'career goals over 2000 characters',
      { careerGoals: textOf2001Characters },
    ],
  ])('rejects a matching form with %s', async (_problem, changes) => {
    await expect(validateMatchingForm(changes)).rejects.toThrow(
      BadRequestException,
    );
  });
});
