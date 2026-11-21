import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsUrl,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  MULTILINE_TEXT_MESSAGE,
  MULTILINE_TEXT_PATTERN,
  trimText,
} from '../../common/index.js';
import { MENTOR_CREDENTIAL_TYPE } from '../entities/index.js';

const MIN_CREDENTIALS = 1;
const LINKEDIN_HOSTS = ['linkedin.com', /^[a-z0-9-]+\.linkedin\.com$/];
const APPLICATION_CREDENTIAL_TYPES = [
  MENTOR_CREDENTIAL_TYPE.CERTIFICATE,
  MENTOR_CREDENTIAL_TYPE.DIPLOMA,
] as const;

type ApplicationCredentialType = (typeof APPLICATION_CREDENTIAL_TYPES)[number];

export class MentorApplicationCredentialDto {
  @IsUUID()
  fileId: string;

  @IsIn(APPLICATION_CREDENTIAL_TYPES)
  type: ApplicationCredentialType;
}

export class MentorApplicationDto {
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    disallow_auth: true,
    host_whitelist: LINKEDIN_HOSTS,
  })
  linkedinUrl: string;

  @Transform(trimText)
  @Matches(MULTILINE_TEXT_PATTERN, { message: MULTILINE_TEXT_MESSAGE })
  motivation: string;

  @IsUUID()
  cvFileId: string;

  @IsArray()
  @ArrayMinSize(MIN_CREDENTIALS)
  @ValidateNested({ each: true })
  @Type(() => MentorApplicationCredentialDto)
  credentials: MentorApplicationCredentialDto[];
}
