import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const MENTOR_CREDENTIAL_TYPE = {
  CV: 'CV',
  CERTIFICATE: 'CERTIFICATE',
  DIPLOMA: 'DIPLOMA',
} as const;

export type MentorCredentialType =
  (typeof MENTOR_CREDENTIAL_TYPE)[keyof typeof MENTOR_CREDENTIAL_TYPE];

@Entity({ name: 'mentor_credentials' })
export class MentorCredential {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'mentor_id', type: 'uuid', nullable: false })
  mentorId: string;

  @Column({ name: 'type', type: 'text', nullable: false })
  type: MentorCredentialType;

  @Column({ name: 'file_id', type: 'uuid', nullable: false })
  fileId: string;
}
