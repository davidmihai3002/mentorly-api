import { IsUUID } from 'class-validator';

export class MentorProfilePhotoDto {
  @IsUUID()
  fileId: string;
}
