import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const FAQ_CATEGORY = {
  PLATFORM: 'PLATFORM',
  MENTORSHIP_PROCESS: 'MENTORSHIP_PROCESS',
  BECOME_MENTOR: 'BECOME_MENTOR',
  PAYMENTS: 'PAYMENTS',
} as const;

export type FaqCategory = (typeof FAQ_CATEGORY)[keyof typeof FAQ_CATEGORY];

@Entity({ name: 'faq_items' })
export class FaqItem {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'category', type: 'text', nullable: false })
  category: FaqCategory;

  @Column({ name: 'question', type: 'text', nullable: false })
  question: string;

  @Column({ name: 'answer', type: 'text', nullable: false })
  answer: string;

  @Column({ name: 'position', type: 'smallint', nullable: false })
  position: number;

  @Column({ name: 'is_published', type: 'boolean', nullable: false })
  isPublished: boolean;
}
