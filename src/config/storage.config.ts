import { readRequiredVariable } from './utils/index.js';

export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const getStorageConfig = (): StorageConfig => {
  const endpoint = readRequiredVariable('S3_ENDPOINT');
  const region = readRequiredVariable('S3_REGION');
  const bucket = readRequiredVariable('S3_BUCKET');
  const accessKeyId = readRequiredVariable('S3_ACCESS_KEY_ID');
  const secretAccessKey = readRequiredVariable('S3_SECRET_ACCESS_KEY');
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
};
