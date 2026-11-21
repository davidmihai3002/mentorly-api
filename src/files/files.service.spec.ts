import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import type { StorageConfig } from '../config/index.js';
import type { CreateUploadUrlDto } from './dto/index.js';
import { StoredFile } from './entities/index.js';
import { FilesService } from './files.service.js';
import { STORAGE_CONFIG } from './storage.providers.js';

vi.mock(import('@aws-sdk/s3-request-presigner'), () => ({
  getSignedUrl: vi.fn(),
}));

const USER_ID = '0b7d9e2f-3c4a-4e5b-8f6a-7c8d9e0f1a2b';
const FILE_ID = '3e9a1c5b-7d2f-4a8e-b6c4-9f0e1d2c3b4a';
const OTHER_USER_FILE_ID = '5c2d8e1a-9b4f-4c7d-8e3a-1f6b2d9c4e7a';
const STORAGE_KEY = `${USER_ID}/7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d`;
const STORAGE_KEY_UNDER_USER = new RegExp(
  `^${USER_ID}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
);
const SIGNED_UPLOAD_URL =
  'https://storage.example.com/mentorly-uploads/signed-upload';
const SIGNED_DOWNLOAD_URL =
  'https://storage.example.com/mentorly-uploads/signed-download';

const storageConfig = {
  endpoint: 'https://storage.example.com',
  region: 'eu-central-1',
  bucket: 'mentorly-uploads',
  accessKeyId: 'unit-test-only-fake-access-key-id',
  secretAccessKey: 'unit-test-only-fake-secret-access-key',
} satisfies StorageConfig;

const upload = {
  fileName: 'Ana_Pop_CV.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 184320,
} satisfies CreateUploadUrlDto;

const buildStorageError = (httpStatusCode: number): S3ServiceException =>
  new S3ServiceException({
    name: 'StorageError',
    $fault: 'client',
    $metadata: { httpStatusCode },
  });

describe('FilesService', () => {
  const filesRepository = {
    save: vi.fn((file: Partial<StoredFile>) =>
      Promise.resolve(Object.assign(new StoredFile(), file, { id: FILE_ID })),
    ),
    findBy: vi.fn<Repository<StoredFile>['findBy']>(),
  };
  const s3Client = {
    send: vi.fn<
      (command: HeadObjectCommand) => Promise<HeadObjectCommandOutput>
    >(),
  };
  const getSignedUrlMock = vi.mocked(getSignedUrl);
  let filesService: FilesService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const testingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(StoredFile), useValue: filesRepository },
        { provide: S3Client, useValue: s3Client },
        { provide: STORAGE_CONFIG, useValue: storageConfig },
      ],
    }).compile();

    filesService = testingModule.get(FilesService);
  });

  describe('createUploadUrl', () => {
    it('saves a private file row keyed under the uploader without the file name and returns its id with the upload URL', async () => {
      getSignedUrlMock.mockResolvedValueOnce(SIGNED_UPLOAD_URL);

      await expect(
        filesService.createUploadUrl(USER_ID, upload),
      ).resolves.toStrictEqual({
        fileId: FILE_ID,
        uploadUrl: SIGNED_UPLOAD_URL,
      });
      expect(filesRepository.save).toHaveBeenCalledExactlyOnceWith({
        uploadedByUserId: USER_ID,
        storageKey: expect.stringMatching(STORAGE_KEY_UNDER_USER),
        originalName: 'Ana_Pop_CV.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 184320,
        visibility: 'PRIVATE',
      });
    });

    it('signs a 10-minute upload of the saved key that only accepts the declared content type and size', async () => {
      getSignedUrlMock.mockResolvedValueOnce(SIGNED_UPLOAD_URL);

      await filesService.createUploadUrl(USER_ID, upload);

      const [[savedFile]] = filesRepository.save.mock.calls;
      const [[, putObjectCommand]] = getSignedUrlMock.mock.calls;
      expect(getSignedUrlMock).toHaveBeenCalledExactlyOnceWith(
        s3Client,
        expect.any(PutObjectCommand),
        { expiresIn: 600, signableHeaders: new Set(['content-type']) },
      );
      expect(putObjectCommand.input).toStrictEqual({
        Bucket: 'mentorly-uploads',
        Key: savedFile.storageKey,
        ContentType: 'application/pdf',
        ContentLength: 184320,
      });
    });
  });

  describe('findUploadedBy', () => {
    it('looks up the given files only among the ones the user uploaded', async () => {
      const uploadedFiles = [
        Object.assign(new StoredFile(), {
          id: FILE_ID,
          uploadedByUserId: USER_ID,
          storageKey: STORAGE_KEY,
        }),
      ];
      filesRepository.findBy.mockResolvedValueOnce(uploadedFiles);

      await expect(
        filesService.findUploadedBy(USER_ID, [FILE_ID, OTHER_USER_FILE_ID]),
      ).resolves.toBe(uploadedFiles);
      expect(filesRepository.findBy).toHaveBeenCalledExactlyOnceWith({
        id: In([FILE_ID, OTHER_USER_FILE_ID]),
        uploadedByUserId: USER_ID,
      });
    });
  });

  describe('hasUploadedObject', () => {
    it('reports an object that is in the bucket', async () => {
      s3Client.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 },
      });

      await expect(filesService.hasUploadedObject(STORAGE_KEY)).resolves.toBe(
        true,
      );
      const [[headObjectCommand]] = s3Client.send.mock.calls;
      expect(headObjectCommand).toBeInstanceOf(HeadObjectCommand);
      expect(headObjectCommand.input).toStrictEqual({
        Bucket: 'mentorly-uploads',
        Key: STORAGE_KEY,
      });
    });

    it('reports a missing object when the bucket answers 404', async () => {
      s3Client.send.mockRejectedValueOnce(buildStorageError(404));

      await expect(filesService.hasUploadedObject(STORAGE_KEY)).resolves.toBe(
        false,
      );
    });

    it.each([
      ['a storage error other than 404', buildStorageError(403)],
      ['a network error', new Error('socket hang up')],
    ])('rethrows %s', async (_problem, storageError) => {
      s3Client.send.mockRejectedValueOnce(storageError);

      await expect(filesService.hasUploadedObject(STORAGE_KEY)).rejects.toBe(
        storageError,
      );
    });
  });

  describe('createDownloadUrl', () => {
    it('signs a one-hour download of the object in the bucket', async () => {
      getSignedUrlMock.mockResolvedValueOnce(SIGNED_DOWNLOAD_URL);

      await expect(filesService.createDownloadUrl(STORAGE_KEY)).resolves.toBe(
        SIGNED_DOWNLOAD_URL,
      );
      const [[, getObjectCommand]] = getSignedUrlMock.mock.calls;
      expect(getSignedUrlMock).toHaveBeenCalledExactlyOnceWith(
        s3Client,
        expect.any(GetObjectCommand),
        { expiresIn: 3600 },
      );
      expect(getObjectCommand.input).toStrictEqual({
        Bucket: 'mentorly-uploads',
        Key: STORAGE_KEY,
      });
    });
  });
});
