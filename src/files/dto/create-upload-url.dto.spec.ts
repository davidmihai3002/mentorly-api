import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { CreateUploadUrlDto } from './create-upload-url.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: CreateUploadUrlDto,
};

const validBody = {
  fileName: 'Ana_Pop_CV.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 184320,
};

const validateUpload = (changes: object): Promise<unknown> =>
  createValidationPipe().transform({ ...validBody, ...changes }, bodyMetadata);

describe('CreateUploadUrlDto validation', () => {
  it('accepts an upload with a trimmed file name', async () => {
    const cleanDto = Object.assign(new CreateUploadUrlDto(), validBody);

    await expect(
      validateUpload({ fileName: '  Ana_Pop_CV.pdf ' }),
    ).resolves.toStrictEqual(cleanDto);
  });

  it('accepts a file of exactly 10485760 bytes', async () => {
    await expect(
      validateUpload({ sizeBytes: 10485760 }),
    ).resolves.toHaveProperty('sizeBytes', 10485760);
  });

  it.each([
    ['a file of 10485761 bytes', { sizeBytes: 10485761 }],
    ['an empty file', { sizeBytes: 0 }],
    ['a format other than PDF, JPEG or PNG', { mimeType: 'text/plain' }],
    ['a blank file name', { fileName: '   ' }],
    ['a control character in the file name', { fileName: 'CV\u0000.pdf' }],
  ])('rejects an upload with %s', async (_problem, changes) => {
    await expect(validateUpload(changes)).rejects.toThrow(BadRequestException);
  });
});
