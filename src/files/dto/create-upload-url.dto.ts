import { Transform } from 'class-transformer';
import { IsEnum, IsInt, Matches, Max, Min } from 'class-validator';
import {
  SINGLE_LINE_TEXT_MESSAGE,
  SINGLE_LINE_TEXT_PATTERN,
  trimText,
} from '../../common/index.js';
import { FILE_MIME_TYPE, type FileMimeType } from '../entities/index.js';

const MIN_FILE_SIZE_BYTES = 1;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class CreateUploadUrlDto {
  @Transform(trimText)
  @Matches(SINGLE_LINE_TEXT_PATTERN, { message: SINGLE_LINE_TEXT_MESSAGE })
  fileName: string;

  @IsEnum(FILE_MIME_TYPE)
  mimeType: FileMimeType;

  @IsInt()
  @Min(MIN_FILE_SIZE_BYTES)
  @Max(MAX_FILE_SIZE_BYTES)
  sizeBytes: number;
}
