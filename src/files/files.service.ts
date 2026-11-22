import { randomUUID } from 'node:crypto';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { StorageConfig } from '../config/index.js';
import type { CreateUploadUrlDto, UploadUrlResponseDto } from './dto/index.js';
import { FILE_VISIBILITY, StoredFile } from './entities/index.js';
import { STORAGE_CONFIG } from './storage.providers.js';

const UPLOAD_URL_EXPIRES_IN_SECONDS = 600;
const DOWNLOAD_URL_EXPIRES_IN_SECONDS = 3600;

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(StoredFile)
    private readonly filesRepository: Repository<StoredFile>,
    private readonly s3Client: S3Client,
    @Inject(STORAGE_CONFIG)
    private readonly storageConfig: StorageConfig,
  ) {}

  async createUploadUrl(
    userId: string,
    upload: CreateUploadUrlDto,
  ): Promise<UploadUrlResponseDto> {
    const { fileName, mimeType, sizeBytes } = upload;
    const storageKey = `${userId}/${randomUUID()}`;
    const putObjectCommand = new PutObjectCommand({
      Bucket: this.storageConfig.bucket,
      Key: storageKey,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });
    const [storedFile, uploadUrl] = await Promise.all([
      this.filesRepository.save({
        uploadedByUserId: userId,
        storageKey,
        originalName: fileName,
        mimeType,
        sizeBytes,
        visibility: FILE_VISIBILITY.PRIVATE,
      }),
      getSignedUrl(this.s3Client, putObjectCommand, {
        expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
        signableHeaders: new Set(['content-type']),
      }),
    ]);
    const { id: fileId } = storedFile;
    return { fileId, uploadUrl };
  }

  async findUploadedBy(
    userId: string,
    fileIds: string[],
  ): Promise<StoredFile[]> {
    const uploadedFiles = await this.filesRepository.findBy({
      id: In(fileIds),
      uploadedByUserId: userId,
    });
    return uploadedFiles;
  }

  async hasUploadedObject(storageKey: string): Promise<boolean> {
    const headObjectCommand = new HeadObjectCommand({
      Bucket: this.storageConfig.bucket,
      Key: storageKey,
    });
    try {
      await this.s3Client.send(headObjectCommand);
      return true;
    } catch (error) {
      const isMissingObject =
        error instanceof S3ServiceException &&
        error.$metadata.httpStatusCode === HttpStatus.NOT_FOUND;
      if (isMissingObject) {
        return false;
      }
      throw error;
    }
  }

  async createDownloadUrl(storageKey: string): Promise<string> {
    const getObjectCommand = new GetObjectCommand({
      Bucket: this.storageConfig.bucket,
      Key: storageKey,
    });
    const downloadUrl = await getSignedUrl(this.s3Client, getObjectCommand, {
      expiresIn: DOWNLOAD_URL_EXPIRES_IN_SECONDS,
    });
    return downloadUrl;
  }
}
