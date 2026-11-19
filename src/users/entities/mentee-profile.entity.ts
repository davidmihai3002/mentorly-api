import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'mentee_profiles' })
export class MenteeProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'domain_id', type: 'uuid', nullable: true })
  domainId: string | null;

  @Column({ name: 'needs', type: 'text', nullable: true })
  needs: string | null;

  @Column({ name: 'studies', type: 'text', nullable: true })
  studies: string | null;

  @Column({ name: 'career_goals', type: 'text', nullable: true })
  careerGoals: string | null;
}
