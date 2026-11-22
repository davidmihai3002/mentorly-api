import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import { MentorProfilePhotoDto } from './mentor-profile-photo.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: MentorProfilePhotoDto,
};

const validatePhoto = (body: object): Promise<unknown> =>
  createValidationPipe().transform(body, bodyMetadata);

describe('MentorProfilePhotoDto validation', () => {
  it('accepts the id of an uploaded file', async () => {
    const validBody = { fileId: '9d3f5b7a-2c4e-4a6b-8d0f-1e3a5c7b9d2f' };
    const validDto = Object.assign(new MentorProfilePhotoDto(), validBody);

    await expect(validatePhoto(validBody)).resolves.toStrictEqual(validDto);
  });

  it('rejects a fileId that is not a UUID', async () => {
    await expect(validatePhoto({ fileId: 'ana-pop.jpg' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
