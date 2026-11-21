import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsUrl,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  MULTILINE_TEXT_MESSAGE,
  MULTILINE_TEXT_PATTERN,
  SINGLE_LINE_TEXT_MESSAGE,
  SINGLE_LINE_TEXT_PATTERN,
  trimText,
  trimTextItems,
} from '../../common/index.js';
import {
  MENTOR_SOCIAL_PLATFORM,
  type MentorSocialPlatform,
} from '../entities/index.js';

const HIGHLIGHT_ITEM_OPTIONS = {
  each: true,
  message: SINGLE_LINE_TEXT_MESSAGE,
};

export class MentorProfileHighlightsDto {
  @IsArray()
  @Transform(trimTextItems)
  @Matches(SINGLE_LINE_TEXT_PATTERN, HIGHLIGHT_ITEM_OPTIONS)
  workplaces: string[];

  @IsArray()
  @Transform(trimTextItems)
  @Matches(SINGLE_LINE_TEXT_PATTERN, HIGHLIGHT_ITEM_OPTIONS)
  achievements: string[];

  @IsArray()
  @Transform(trimTextItems)
  @Matches(SINGLE_LINE_TEXT_PATTERN, HIGHLIGHT_ITEM_OPTIONS)
  certifications: string[];
}

export class MentorSocialLinkDto {
  @IsEnum(MENTOR_SOCIAL_PLATFORM)
  platform: MentorSocialPlatform;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url: string;
}

export class MentorProfileDto {
  @IsOptional()
  @IsUUID()
  domainId?: string | null;

  @IsOptional()
  @Transform(trimText)
  @Matches(MULTILINE_TEXT_PATTERN, { message: MULTILINE_TEXT_MESSAGE })
  bio?: string | null;

  @IsObject()
  @ValidateNested()
  @Type(() => MentorProfileHighlightsDto)
  highlights: MentorProfileHighlightsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentorSocialLinkDto)
  socialLinks: MentorSocialLinkDto[];
}
