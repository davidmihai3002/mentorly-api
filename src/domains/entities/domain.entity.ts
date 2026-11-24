import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'domains' })
export class Domain {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'slug', type: 'text', nullable: false })
  slug: string;

  @Column({ name: 'name', type: 'text', nullable: false })
  name: string;

  @Column({ name: 'position', type: 'smallint', nullable: false })
  position: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  isActive: boolean;
}
