import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'platform_testimonials' })
export class PlatformTestimonial {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'author_name', type: 'text', nullable: false })
  authorName: string;

  @Column({ name: 'author_role', type: 'text', nullable: true })
  authorRole: string | null;

  @Column({ name: 'quote', type: 'text', nullable: false })
  quote: string;

  @Column({ name: 'rating', type: 'smallint', nullable: true })
  rating: number | null;

  @Column({ name: 'position', type: 'smallint', nullable: false })
  position: number;

  @Column({ name: 'is_published', type: 'boolean', nullable: false })
  isPublished: boolean;
}
