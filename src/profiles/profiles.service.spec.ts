import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { AuthService } from '../auth/index.js';
import { DomainsService } from '../domains/index.js';
import { FilesService, StoredFile } from '../files/index.js';
import type { MentorApplicationDto, MentorProfileDto } from './dto/index.js';
import {
  MentorCredential,
  MentorProfile,
  MentorSocialLink,
} from './entities/index.js';
import { ProfilesService } from './profiles.service.js';

const USER_ID = '0b7d9e2f-3c4a-4e5b-8f6a-7c8d9e0f1a2b';
const CV_FILE_ID = '3e9a1c5b-7d2f-4a8e-b6c4-9f0e1d2c3b4a';
const CERTIFICATE_FILE_ID = '5c2d8e1a-9b4f-4c7d-8e3a-1f6b2d9c4e7a';
const DIPLOMA_FILE_ID = '8f4b6a2c-1d3e-4f5a-9b7c-2e8d0a6f4c1b';
const SUBMITTED_AT = new Date('2026-11-21T10:00:00.000Z');
const DOMAIN_ID = '5a8c2e1f-4b7d-4e9a-8c3f-6d1e2b4a7c90';
const PHOTO_FILE_ID = '9d3f5b7a-2c4e-4a6b-8d0f-1e3a5c7b9d2f';
const PHOTO_STORAGE_KEY = `${USER_ID}/2b4d6f8a-1c3e-4a5b-9d7f-0e2c4a6b8d1f`;
const SIGNED_PHOTO_URL =
  'https://storage.example.com/mentorly-uploads/signed-photo';
const MENTOR_PROFILE_NOT_FOUND = new NotFoundException(
  'Mentor profile not found.',
);

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
const photoFile = buildStoredFile({
  id: PHOTO_FILE_ID,
  storageKey: PHOTO_STORAGE_KEY,
  originalName: 'Ana_Pop.jpg',
  mimeType: 'image/jpeg',
});

const mentorProfileUpdate = {
  domainId: DOMAIN_ID,
  bio: 'Backend engineer with eight years in fintech.',
  highlights: {
    workplaces: ['Senior backend engineer at Nordwave Software'],
    achievements: ['Led the move of the billing platform to event sourcing'],
    certifications: [],
  },
  socialLinks: [
    { platform: 'LINKEDIN', url: 'https://www.linkedin.com/in/ana-pop' },
    { platform: 'GITHUB', url: 'https://github.com/ana-pop' },
  ],
} satisfies MentorProfileDto;

const buildMentorProfile = (changes: Partial<MentorProfile>): MentorProfile =>
  Object.assign(new MentorProfile(), {
    userId: USER_ID,
    status: 'APPROVED',
    submittedAt: SUBMITTED_AT,
    domainId: DOMAIN_ID,
    bio: 'Backend engineer with eight years in fintech.',
    linkedinUrl: 'https://www.linkedin.com/in/ana-pop',
    motivation:
      'I have led backend teams for six years and want to help juniors grow.',
    highlights: {},
    ...changes,
  });

const buildSocialLink = (
  changes: Partial<MentorSocialLink>,
): MentorSocialLink =>
  Object.assign(new MentorSocialLink(), { mentorId: USER_ID, ...changes });

describe('ProfilesService', () => {
  const mentorProfilesRepository = {
    existsBy: vi.fn<Repository<MentorProfile>['existsBy']>(),
    findOneBy: vi.fn<Repository<MentorProfile>['findOneBy']>(),
  };
  const mentorSocialLinksRepository = {
    find: vi.fn<Repository<MentorSocialLink>['find']>(),
  };
  const filesService = {
    findUploadedBy: vi.fn<FilesService['findUploadedBy']>(),
    hasUploadedObject: vi.fn<FilesService['hasUploadedObject']>(),
    createDownloadUrl: vi.fn<FilesService['createDownloadUrl']>(),
  };
  const authService = {
    findAvatarFileId: vi.fn<AuthService['findAvatarFileId']>(),
    setAvatar: vi.fn<AuthService['setAvatar']>(),
  };
  const domainsService = {
    isActiveDomain: vi.fn<DomainsService['isActiveDomain']>(),
  };
  const insertMentorProfile = vi.fn<Repository<MentorProfile>['insert']>();
  const updateMentorProfile = vi.fn<Repository<MentorProfile>['update']>();
  const insertMentorCredentials =
    vi.fn<Repository<MentorCredential>['insert']>();
  const deleteMentorSocialLinks =
    vi.fn<Repository<MentorSocialLink>['delete']>();
  const insertMentorSocialLinks =
    vi.fn<Repository<MentorSocialLink>['insert']>();
  const transactionRepositories = new Map<unknown, object>([
    [
      MentorProfile,
      { insert: insertMentorProfile, update: updateMentorProfile },
    ],
    [MentorCredential, { insert: insertMentorCredentials }],
    [
      MentorSocialLink,
      { delete: deleteMentorSocialLinks, insert: insertMentorSocialLinks },
    ],
  ]);
  const manager = {
    getRepository: (entity: unknown) => transactionRepositories.get(entity),
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
        {
          provide: getRepositoryToken(MentorSocialLink),
          useValue: mentorSocialLinksRepository,
        },
        { provide: FilesService, useValue: filesService },
        { provide: AuthService, useValue: authService },
        { provide: DomainsService, useValue: domainsService },
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

  describe('getMentorProfile', () => {
    it('rejects a mentor without a profile with 404', async () => {
      mentorProfilesRepository.findOneBy.mockResolvedValueOnce(null);

      await expect(profilesService.getMentorProfile(USER_ID)).rejects.toThrow(
        MENTOR_PROFILE_NOT_FOUND,
      );
      expect(
        mentorProfilesRepository.findOneBy,
      ).toHaveBeenCalledExactlyOnceWith({ userId: USER_ID });
      expect(mentorSocialLinksRepository.find).not.toHaveBeenCalled();
    });

    it('returns empty lists for missing highlight lists and the social links in position order', async () => {
      mentorProfilesRepository.findOneBy.mockResolvedValueOnce(
        buildMentorProfile({
          highlights: {
            workplaces: ['Senior backend engineer at Nordwave Software'],
          },
        }),
      );
      mentorSocialLinksRepository.find.mockResolvedValueOnce([
        buildSocialLink({
          id: '4c6e8a0b-2d4f-4b6c-8e0a-3f5b7d9c1e2a',
          platform: 'GITHUB',
          url: 'https://github.com/ana-pop',
          position: 1,
        }),
        buildSocialLink({
          id: '7e9a1c3d-5f7b-4d9e-a1c3-6b8d0f2a4c5e',
          platform: 'WEBSITE',
          url: 'https://ana-pop.dev',
          position: 2,
        }),
      ]);
      authService.findAvatarFileId.mockResolvedValueOnce(null);

      await expect(
        profilesService.getMentorProfile(USER_ID),
      ).resolves.toStrictEqual({
        status: 'APPROVED',
        domainId: DOMAIN_ID,
        bio: 'Backend engineer with eight years in fintech.',
        highlights: {
          workplaces: ['Senior backend engineer at Nordwave Software'],
          achievements: [],
          certifications: [],
        },
        socialLinks: [
          { platform: 'GITHUB', url: 'https://github.com/ana-pop' },
          { platform: 'WEBSITE', url: 'https://ana-pop.dev' },
        ],
        photoUrl: null,
      });
      expect(mentorSocialLinksRepository.find).toHaveBeenCalledExactlyOnceWith({
        where: { mentorId: USER_ID },
        order: { position: 'ASC' },
      });
    });

    it('returns a signed URL of the avatar file as the photo URL', async () => {
      mentorProfilesRepository.findOneBy.mockResolvedValueOnce(
        buildMentorProfile({}),
      );
      mentorSocialLinksRepository.find.mockResolvedValueOnce([]);
      authService.findAvatarFileId.mockResolvedValueOnce(PHOTO_FILE_ID);
      filesService.findUploadedBy.mockResolvedValueOnce([photoFile]);
      filesService.createDownloadUrl.mockResolvedValueOnce(SIGNED_PHOTO_URL);

      const mentorProfile = await profilesService.getMentorProfile(USER_ID);

      expect(mentorProfile.photoUrl).toBe(SIGNED_PHOTO_URL);
      expect(filesService.findUploadedBy).toHaveBeenCalledExactlyOnceWith(
        USER_ID,
        [PHOTO_FILE_ID],
      );
      expect(filesService.createDownloadUrl).toHaveBeenCalledExactlyOnceWith(
        PHOTO_STORAGE_KEY,
      );
    });
  });

  describe('saveMentorProfile', () => {
    it('rejects a mentor without a profile with 404 and writes nothing', async () => {
      mentorProfilesRepository.existsBy.mockResolvedValueOnce(false);

      await expect(
        profilesService.saveMentorProfile(USER_ID, mentorProfileUpdate),
      ).rejects.toThrow(MENTOR_PROFILE_NOT_FOUND);
      expect(mentorProfilesRepository.existsBy).toHaveBeenCalledExactlyOnceWith(
        {
          userId: USER_ID,
        },
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a domain that is not active and writes nothing', async () => {
      mentorProfilesRepository.existsBy.mockResolvedValueOnce(true);
      domainsService.isActiveDomain.mockResolvedValueOnce(false);

      await expect(
        profilesService.saveMentorProfile(USER_ID, mentorProfileUpdate),
      ).rejects.toThrow(
        new BadRequestException('domainId must be one of the active domains.'),
      );
      expect(domainsService.isActiveDomain).toHaveBeenCalledExactlyOnceWith(
        DOMAIN_ID,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('updates the profile and replaces the social links with their positions in one transaction', async () => {
      mentorProfilesRepository.existsBy.mockResolvedValueOnce(true);
      domainsService.isActiveDomain.mockResolvedValueOnce(true);

      await profilesService.saveMentorProfile(USER_ID, mentorProfileUpdate);

      expect(dataSource.transaction).toHaveBeenCalledOnce();
      expect(updateMentorProfile).toHaveBeenCalledExactlyOnceWith(
        { userId: USER_ID },
        {
          domainId: DOMAIN_ID,
          bio: 'Backend engineer with eight years in fintech.',
          highlights: {
            workplaces: ['Senior backend engineer at Nordwave Software'],
            achievements: [
              'Led the move of the billing platform to event sourcing',
            ],
            certifications: [],
          },
        },
      );
      expect(deleteMentorSocialLinks).toHaveBeenCalledExactlyOnceWith({
        mentorId: USER_ID,
      });
      expect(insertMentorSocialLinks).toHaveBeenCalledExactlyOnceWith([
        {
          mentorId: USER_ID,
          platform: 'LINKEDIN',
          url: 'https://www.linkedin.com/in/ana-pop',
          position: 1,
        },
        {
          mentorId: USER_ID,
          platform: 'GITHUB',
          url: 'https://github.com/ana-pop',
          position: 2,
        },
      ]);
      const [deleteOrder] = deleteMentorSocialLinks.mock.invocationCallOrder;
      const [insertOrder] = insertMentorSocialLinks.mock.invocationCallOrder;
      expect(deleteOrder).toBeLessThan(insertOrder);
    });

    it('skips the domain check and clears the domain and bio when they are left out', async () => {
      const { highlights, socialLinks } = mentorProfileUpdate;
      mentorProfilesRepository.existsBy.mockResolvedValueOnce(true);

      await profilesService.saveMentorProfile(USER_ID, {
        highlights,
        socialLinks,
      });

      expect(domainsService.isActiveDomain).not.toHaveBeenCalled();
      expect(updateMentorProfile).toHaveBeenCalledExactlyOnceWith(
        { userId: USER_ID },
        { domainId: null, bio: null, highlights },
      );
    });
  });

  describe('setMentorPhoto', () => {
    it('rejects a file the mentor did not upload and writes nothing', async () => {
      filesService.findUploadedBy.mockResolvedValueOnce([]);

      await expect(
        profilesService.setMentorPhoto(USER_ID, PHOTO_FILE_ID),
      ).rejects.toThrow(
        new BadRequestException('The photo must be a file you uploaded.'),
      );
      expect(filesService.findUploadedBy).toHaveBeenCalledExactlyOnceWith(
        USER_ID,
        [PHOTO_FILE_ID],
      );
      expect(filesService.hasUploadedObject).not.toHaveBeenCalled();
      expect(authService.setAvatar).not.toHaveBeenCalled();
    });

    it('rejects a file that is not a JPG or PNG image and writes nothing', async () => {
      const pdfFile = buildStoredFile({
        id: PHOTO_FILE_ID,
        storageKey: PHOTO_STORAGE_KEY,
        originalName: 'Ana_Pop.pdf',
        mimeType: 'application/pdf',
      });
      filesService.findUploadedBy.mockResolvedValueOnce([pdfFile]);

      await expect(
        profilesService.setMentorPhoto(USER_ID, PHOTO_FILE_ID),
      ).rejects.toThrow(
        new BadRequestException('The photo must be a JPG or PNG image.'),
      );
      expect(filesService.hasUploadedObject).not.toHaveBeenCalled();
      expect(authService.setAvatar).not.toHaveBeenCalled();
    });

    it('rejects a photo missing from the bucket and writes nothing', async () => {
      filesService.findUploadedBy.mockResolvedValueOnce([photoFile]);
      filesService.hasUploadedObject.mockResolvedValueOnce(false);

      await expect(
        profilesService.setMentorPhoto(USER_ID, PHOTO_FILE_ID),
      ).rejects.toThrow(
        new BadRequestException("The photo hasn't been uploaded yet."),
      );
      expect(filesService.hasUploadedObject).toHaveBeenCalledExactlyOnceWith(
        PHOTO_STORAGE_KEY,
      );
      expect(authService.setAvatar).not.toHaveBeenCalled();
    });

    it.each(['image/jpeg', 'image/png'])(
      'sets an uploaded %s file as the avatar',
      async (mimeType) => {
        const imageFile = buildStoredFile({
          id: PHOTO_FILE_ID,
          storageKey: PHOTO_STORAGE_KEY,
          originalName: 'Ana_Pop',
          mimeType,
        });
        filesService.findUploadedBy.mockResolvedValueOnce([imageFile]);
        filesService.hasUploadedObject.mockResolvedValueOnce(true);

        await profilesService.setMentorPhoto(USER_ID, PHOTO_FILE_ID);

        expect(authService.setAvatar).toHaveBeenCalledExactlyOnceWith(
          USER_ID,
          PHOTO_FILE_ID,
        );
      },
    );
  });
});
