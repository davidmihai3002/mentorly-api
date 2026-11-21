import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import {
  MentorApplicationCredentialDto,
  MentorApplicationDto,
} from './mentor-application.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: MentorApplicationDto,
};

const certificate = {
  fileId: '5c2d8e1a-9b4f-4c7d-8e3a-1f6b2d9c4e7a',
  type: 'CERTIFICATE',
};

const validBody = {
  linkedinUrl: 'https://www.linkedin.com/in/ana-pop',
  motivation:
    'I have led backend teams for six years and want to help juniors grow.',
  cvFileId: '3e9a1c5b-7d2f-4a8e-b6c4-9f0e1d2c3b4a',
  credentials: [certificate],
};

const validateApplication = (changes: object): Promise<unknown> =>
  createValidationPipe().transform({ ...validBody, ...changes }, bodyMetadata);

describe('MentorApplicationDto validation', () => {
  it.each([
    'https://www.linkedin.com/in/ana-pop',
    'https://linkedin.com/in/ana-pop',
  ])(
    'accepts a complete application with the LinkedIn link %s',
    async (linkedinUrl) => {
      const validCredential = Object.assign(
        new MentorApplicationCredentialDto(),
        certificate,
      );
      const validDto = Object.assign(new MentorApplicationDto(), validBody, {
        linkedinUrl,
        credentials: [validCredential],
      });

      await expect(validateApplication({ linkedinUrl })).resolves.toStrictEqual(
        validDto,
      );
    },
  );

  it.each([
    ['an http link', { linkedinUrl: 'http://www.linkedin.com/in/ana-pop' }],
    ['a link to another site', { linkedinUrl: 'https://notlinkedin.com/x' }],
    [
      'a link to a look-alike domain',
      { linkedinUrl: 'https://linkedin.com.evil.com/x' },
    ],
    [
      'a link with credentials in it',
      { linkedinUrl: 'https://user@linkedin.com/x' },
    ],
    ['a blank motivation', { motivation: ' \r\n\t ' }],
    ['no certificates or diplomas', { credentials: [] }],
    [
      'an unknown credential type',
      { credentials: [{ ...certificate, type: 'PORTFOLIO' }] },
    ],
    [
      'a CV among the credentials',
      { credentials: [{ ...certificate, type: 'CV' }] },
    ],
  ])('rejects an application with %s', async (_problem, changes) => {
    await expect(validateApplication(changes)).rejects.toThrow(
      BadRequestException,
    );
  });
});
