import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { ValueTransformer } from 'typeorm';

export const FILE_VISIBILITY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;

export type FileVisibility =
  (typeof FILE_VISIBILITY)[keyof typeof FILE_VISIBILITY];

export const FILE_MIME_TYPE = {
  PDF: 'application/pdf',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
} as const;

export type FileMimeType = (typeof FILE_MIME_TYPE)[keyof typeof FILE_MIME_TYPE];

const bigintToNumber: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number(value),
};

@Entity({ name: 'files' })
export class StoredFile {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid', nullable: true })
  uploadedByUserId: string | null;

  @Column({ name: 'storage_key', type: 'text', nullable: false })
  storageKey: string;

  @Column({ name: 'original_name', type: 'text', nullable: false })
  originalName: string;

  @Column({ name: 'mime_type', type: 'text', nullable: false })
  mimeType: string;

  @Column({
    name: 'size_bytes',
    type: 'bigint',
    nullable: false,
    transformer: bigintToNumber,
  })
  sizeBytes: number;

  @Column({ name: 'visibility', type: 'text', nullable: false })
  visibility: FileVisibility;
}
