import type {
  MentorProfileStatus,
  MentorSocialPlatform,
} from '../entities/index.js';

export interface MentorProfileResponseDto {
  status: MentorProfileStatus;
  domainId: string | null;
  bio: string | null;
  highlights: {
    workplaces: string[];
    achievements: string[];
    certifications: string[];
  };
  socialLinks: { platform: MentorSocialPlatform; url: string }[];
  photoUrl: string | null;
}
