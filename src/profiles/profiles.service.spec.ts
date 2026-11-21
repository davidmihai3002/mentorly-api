import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { FilesService, StoredFile } from '../files/index.js';
import type { MentorApplicationDto } from './dto/index.js';
import { MentorCredential, MentorProfile } from './entities/index.js';
import { ProfilesService } from './profiles.service.js';

const USER_ID = '0b7d9e2f-3c4a-4e5b-8f6a-7c8d9e0f1a2b';
const CV_FILE_ID = '3e9a1c5b-7d2f-4a8e-b6c4-9f0e1d2c3b4a';
const CERTIFICATE_FILE_ID = '5c2d8e1a-9b4f-4c7d-8e3a-1f6b2d9c4e7a';
const DIPLOMA_FILE_ID = '8f4b6a2c-1d3e-4f5a-9b7c-2e8d0a6f4c1b';
const SUBMITTED_AT = new Date('2026-11-21T10:00:00.000Z');

const application = {
  linkedinUrl: 'https://www.linkedin.com/in/ana-pop',
  motivation:
    'I have led backend teams for six years and want to help juniors grow.',
  cvFileId: CV_FILE_ID,
  credentials: [
    { fileId: CERTIFICATE_FILE_ID, type: 'CERTIFICATE' },
    { fileId: DIPLOMA_FILE_ID, type: 'DIPLOMA' },
  ],
} satisfies MentorApplicationDto;

const buildStoredFile = (changes: Partial<StoredFile>): StoredFile =>
  Object.assign(new StoredFile(), {
    uploadedByUserId: USER_ID,
    sizeBytes: 184320,
    visibility: 'PRIVATE',
    ...changes,
  });

const cvFileFields = {
  id: CV_FILE_ID,
  storageKey: `${USER_ID}/7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d`,
  originalName: 'Ana_Pop_CV.pdf',
  mimeType: 'application/pdf',
};
const cvFile = buildStoredFile(cvFileFields);
const certificateFile = buildStoredFile({
  id: CERTIFICATE_FILE_ID,
  storageKey: `${USER_ID}/1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f`,
  originalName: 'AWS_Certificate.png',
  mimeType: 'image/png',
});
const diplomaFile = buildStoredFile({
  id: DIPLOMA_FILE_ID,
  storageKey: `${USER_ID}/9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b`,
  originalName: 'Diploma_Licenta.jpg',
  mimeType: 'image/jpeg',
});

describe('ProfilesService', () => {
  const mentorProfilesRepository = {
    existsBy: vi.fn<Repository<MentorProfile>['existsBy']>(),
  };
  const filesService = {
    findUploadedBy: vi.fn<FilesService['findUploadedBy']>(),
    hasUploadedObject: vi.fn<FilesService['hasUploadedObject']>(),
  };
  const insertMentorProfile = vi.fn<Repository<MentorProfile>['insert']>();
  const insertMentorCredentials =
    vi.fn<Repository<MentorCredential>['insert']>();
  const manager = {
    getRepository: (entity: unknown) =>
      entity === MentorProfile
        ? { insert: insertMentorProfile }
        : { insert: insertMentorCredentials },
  };
  const dataSource = {
    transaction: vi.fn(
      (work: (entityManager: typeof manager) => Promise<void>) => work(manager),
    ),
  };
  let profilesService: ProfilesService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.setSystemTime(SUBMITTED_AT);
    const testingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(MentorProfile),
          useValue: mentorProfilesRepository,
        },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    profilesService = testingModule.get(ProfilesService);
  });

  it('rejects a mentor who has already applied and writes nothing', async () => {
    mentorProfilesRepository.existsBy.mockResolvedValueOnce(true);

    await expect(
      profilesService.submitMentorApplication(USER_ID, application),
    ).rejects.toThrow(
      new ConflictException('You have already applied to become a mentor.'),
    );
    expect(mentorProfilesRepository.existsBy).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
    });
    expect(filesService.findUploadedBy).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a file the mentor did not upload and writes nothing', async () => {
    mentorProfilesRepository.existsBy.mockResolvedValueOnce(false);
    filesService.findUploadedBy.mockResolvedValueOnce([
      cvFile,
      certificateFile,
    ]);

    await expect(
      profilesService.submitMentorApplication(USER_ID, application),
    ).rejects.toThrow(
      new BadRequestException('Every file must be one you uploaded.'),
    );
    expect(filesService.findUploadedBy).toHaveBeenCalledExactlyOnceWith(
      USER_ID,
      [CV_FILE_ID, CERTIFICATE_FILE_ID, DIPLOMA_FILE_ID],
    );
    expect(filesService.hasUploadedObject).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a CV that is not a PDF and writes nothing', async () => {
    const imageCvFile = buildStoredFile({
      ...cvFileFields,
      mimeType: 'image/png',
    });
    mentorProfilesRepository.existsBy.mockResolvedValueOnce(false);
    filesService.findUploadedBy.mockResolvedValueOnce([
      imageCvFile,
      certificateFile,
      diplomaFile,
    ]);

    await expect(
      profilesService.submitMentorApplication(USER_ID, application),
    ).rejects.toThrow(new BadRequestException('The CV must be a PDF.'));
    expect(filesService.hasUploadedObject).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a file missing from the bucket, naming it, and writes nothing', async () => {
    mentorProfilesRepository.existsBy.mockResolvedValueOnce(false);
    filesService.findUploadedBy.mockResolvedValueOnce([
      cvFile,
      certificateFile,
      diplomaFile,
    ]);
    filesService.hasUploadedObject.mockImplementation((storageKey) =>
      Promise.resolve(storageKey !== certificateFile.storageKey),
    );

    await expect(
      profilesService.submitMentorApplication(USER_ID, application),
    ).rejects.toThrow(
      new BadRequestException(
        "The file AWS_Certificate.png hasn't been uploaded yet.",
      ),
    );
    expect(filesService.hasUploadedObject).toHaveBeenCalledTimes(3);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('saves a pending profile and one credential per file in one transaction', async () => {
    mentorProfilesRepository.existsBy.mockResolvedValueOnce(false);
    filesService.findUploadedBy.mockResolvedValueOnce([
      diplomaFile,
      cvFile,
      certificateFile,
    ]);
    filesService.hasUploadedObject.mockResolvedValue(true);

    await expect(
      profilesService.submitMentorApplication(USER_ID, application),
    ).resolves.toEqual({ status: 'PENDING', submittedAt: SUBMITTED_AT });
    expect(dataSource.transaction).toHaveBeenCalledOnce();
    expect(insertMentorProfile).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      status: 'PENDING',
      submittedAt: SUBMITTED_AT,
      linkedinUrl: 'https://www.linkedin.com/in/ana-pop',
      motivation:
        'I have led backend teams for six years and want to help juniors grow.',
    });
    expect(insertMentorCredentials).toHaveBeenCalledExactlyOnceWith([
      { mentorId: USER_ID, type: 'CV', fileId: CV_FILE_ID },
      { mentorId: USER_ID, type: 'CERTIFICATE', fileId: CERTIFICATE_FILE_ID },
      { mentorId: USER_ID, type: 'DIPLOMA', fileId: DIPLOMA_FILE_ID },
    ]);
  });
});
