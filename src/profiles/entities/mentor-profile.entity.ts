import { Column, Entity, PrimaryColumn } from 'typeorm';

export const MENTOR_PROFILE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type MentorProfileStatus =
  (typeof MENTOR_PROFILE_STATUS)[keyof typeof MENTOR_PROFILE_STATUS];

@Entity({ name: 'mentor_profiles' })
export class MentorProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'status', type: 'text', nullable: false })
  status: MentorProfileStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'linkedin_url', type: 'text', nullable: false })
  linkedinUrl: string;

  @Column({ name: 'motivation', type: 'text', nullable: false })
  motivation: string;
}
