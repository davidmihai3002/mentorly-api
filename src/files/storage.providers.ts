import { S3Client } from '@aws-sdk/client-s3';
import type { Provider } from '@nestjs/common';
import { getStorageConfig, type StorageConfig } from '../config/index.js';

export const STORAGE_CONFIG = Symbol('STORAGE_CONFIG');

const createS3Client = ({
  endpoint,
  region,
  accessKeyId,
  secretAccessKey,
}: StorageConfig): S3Client =>
  new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });

export const storageProviders: Provider[] = [
  { provide: STORAGE_CONFIG, useFactory: getStorageConfig },
  { provide: S3Client, inject: [STORAGE_CONFIG], useFactory: createS3Client },
];
