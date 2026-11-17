import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'mentee_profiles' })
export class MenteeProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;
}
