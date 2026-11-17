import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const USER_ROLE = { MENTOR: 'MENTOR', MENTEE: 'MENTEE' } as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'email', type: 'text', nullable: false })
  email: string;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;

  @Column({ name: 'role', type: 'text', nullable: false })
  role: UserRole;

  @Column({ name: 'first_name', type: 'text', nullable: false })
  firstName: string;

  @Column({ name: 'last_name', type: 'text', nullable: false })
  lastName: string;

  @Column({ name: 'birth_date', type: 'date', nullable: false })
  birthDate: string;

  @Column({ name: 'terms_accepted_at', type: 'timestamptz', nullable: false })
  termsAcceptedAt: Date;
}
