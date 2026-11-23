import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'mentorships' })
export class Mentorship {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'mentor_id', type: 'uuid', nullable: false })
  mentorId: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'conditions', type: 'text', nullable: true })
  conditions: string | null;

  @Column({ name: 'min_knowledge', type: 'text', nullable: true })
  minKnowledge: string | null;

  @Column({ name: 'is_sponsored', type: 'boolean', nullable: false })
  isSponsored: boolean;

  @Column({ name: 'per_session_price_bani', type: 'integer', nullable: true })
  perSessionPriceBani: number | null;

  @Column({ name: 'monthly_price_bani', type: 'integer', nullable: true })
  monthlyPriceBani: number | null;

  @Column({ name: 'monthly_sessions_count', type: 'smallint', nullable: true })
  monthlySessionsCount: number | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
