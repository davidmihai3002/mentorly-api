import { Column, Entity, PrimaryColumn } from 'typeorm';

export const MENTOR_PROFILE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type MentorProfileStatus =
  (typeof MENTOR_PROFILE_STATUS)[keyof typeof MENTOR_PROFILE_STATUS];

export interface MentorProfileHighlights {
  workplaces?: string[];
  achievements?: string[];
  certifications?: string[];
}

@Entity({ name: 'mentor_profiles' })
export class MentorProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'status', type: 'text', nullable: false })
  status: MentorProfileStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'domain_id', type: 'uuid', nullable: true })
  domainId: string | null;

  @Column({ name: 'bio', type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'linkedin_url', type: 'text', nullable: false })
  linkedinUrl: string;

  @Column({ name: 'motivation', type: 'text', nullable: false })
  motivation: string;

  @Column({ name: 'highlights', type: 'jsonb', nullable: false })
  highlights: MentorProfileHighlights;

  @Column({ name: 'capacity', type: 'smallint', nullable: true })
  capacity: number | null;
}
