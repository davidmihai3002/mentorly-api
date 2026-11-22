import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const MENTOR_SOCIAL_PLATFORM = {
  LINKEDIN: 'LINKEDIN',
  GITHUB: 'GITHUB',
  BEHANCE: 'BEHANCE',
  DRIBBBLE: 'DRIBBBLE',
  X: 'X',
  INSTAGRAM: 'INSTAGRAM',
  WEBSITE: 'WEBSITE',
  OTHER: 'OTHER',
} as const;

export type MentorSocialPlatform =
  (typeof MENTOR_SOCIAL_PLATFORM)[keyof typeof MENTOR_SOCIAL_PLATFORM];

@Entity({ name: 'mentor_social_links' })
export class MentorSocialLink {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'mentor_id', type: 'uuid', nullable: false })
  mentorId: string;

  @Column({ name: 'platform', type: 'text', nullable: false })
  platform: MentorSocialPlatform;

  @Column({ name: 'url', type: 'text', nullable: false })
  url: string;

  @Column({ name: 'position', type: 'smallint', nullable: false })
  position: number;
}
