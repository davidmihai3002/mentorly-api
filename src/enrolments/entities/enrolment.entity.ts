import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const ENROLMENT_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
} as const;

export type EnrolmentStatus =
  (typeof ENROLMENT_STATUS)[keyof typeof ENROLMENT_STATUS];

@Entity({ name: 'enrolments' })
export class Enrolment {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'mentorship_id', type: 'uuid', nullable: false })
  mentorshipId: string;

  @Column({ name: 'status', type: 'text', nullable: false })
  status: EnrolmentStatus;
}
