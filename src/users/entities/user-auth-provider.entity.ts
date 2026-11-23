import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const AUTH_PROVIDER = { GOOGLE: 'GOOGLE' } as const;

export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];

@Entity({ name: 'user_auth_providers' })
export class UserAuthProvider {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'provider', type: 'text', nullable: false })
  provider: AuthProvider;

  @Column({ name: 'provider_user_id', type: 'text', nullable: false })
  providerUserId: string;

  @Column({ name: 'provider_email', type: 'text', nullable: true })
  providerEmail: string | null;
}
