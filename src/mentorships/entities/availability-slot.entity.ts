import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'availability_slots' })
export class AvailabilitySlot {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'mentor_id', type: 'uuid', nullable: false })
  mentorId: string;
}
