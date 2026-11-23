import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthService } from '../auth/index.js';
import { DomainsService } from '../domains/index.js';
import { EnrolmentsService } from '../enrolments/index.js';
import { FILE_MIME_TYPE, FilesService } from '../files/index.js';
import type { StoredFile } from '../files/index.js';
import type {
  MentorApplicationDto,
  MentorApplicationResponseDto,
  MentorCapacityDto,
  MentorProfileDto,
  MentorProfileResponseDto,
} from './dto/index.js';
import {
  MENTOR_CREDENTIAL_TYPE,
  MENTOR_PROFILE_STATUS,
  MentorCredential,
  MentorProfile,
  MentorSocialLink,
} from './entities/index.js';

const ALREADY_APPLIED_MESSAGE = 'You have already applied to become a mentor.';
const FILE_NOT_UPLOADED_BY_USER_MESSAGE =
  'Every file must be one you uploaded.';
const CV_NOT_PDF_MESSAGE = 'The CV must be a PDF.';
const MENTOR_PROFILE_NOT_FOUND_MESSAGE = 'Mentor profile not found.';
const INACTIVE_DOMAIN_MESSAGE = 'domainId must be one of the active domains.';
const PHOTO_NOT_UPLOADED_BY_USER_MESSAGE =
  'The photo must be a file you uploaded.';
const PHOTO_NOT_IMAGE_MESSAGE = 'The photo must be a JPG or PNG image.';
const PHOTO_NOT_IN_BUCKET_MESSAGE = "The photo hasn't been uploaded yet.";
const PHOTO_MIME_TYPES: readonly string[] = [
  FILE_MIME_TYPE.JPEG,
  FILE_MIME_TYPE.PNG,
];
const FIRST_SOCIAL_LINK_POSITION = 1;

const toFileNotInBucketMessage = (originalName: string): string =>
  `The file ${originalName} hasn't been uploaded yet.`;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MentorProfile)
    private readonly mentorProfilesRepository: Repository<MentorProfile>,
    @InjectRepository(MentorSocialLink)
    private readonly mentorSocialLinksRepository: Repository<MentorSocialLink>,
    private readonly filesService: FilesService,
    private readonly authService: AuthService,
    private readonly domainsService: DomainsService,
    private readonly enrolmentsService: EnrolmentsService,
  ) {}

  async submitMentorApplication(
    userId: string,
    application: MentorApplicationDto,
  ): Promise<MentorApplicationResponseDto> {
    const { cvFileId, credentials } = application;
    const hasApplied = await this.mentorProfilesRepository.existsBy({ userId });
    if (hasApplied) {
      throw new ConflictException(ALREADY_APPLIED_MESSAGE);
    }

    const fileIds = [cvFileId, ...credentials.map(({ fileId }) => fileId)];
    const applicationFiles = await this.findFilesUploadedBy(userId, fileIds);
    const cvFile = applicationFiles.find(({ id }) => id === cvFileId);
    const isCvPdf = cvFile?.mimeType === FILE_MIME_TYPE.PDF;
    if (!isCvPdf) {
      throw new BadRequestException(CV_NOT_PDF_MESSAGE);
    }
    await this.assertFilesAreInBucket(applicationFiles);

    const submittedAt = new Date();
    await this.insertApplication(userId, application, submittedAt);
    return { status: MENTOR_PROFILE_STATUS.PENDING, submittedAt };
  }

  async getMentorProfile(userId: string): Promise<MentorProfileResponseDto> {
    const mentorProfile = await this.mentorProfilesRepository.findOneBy({
      userId,
    });
    if (mentorProfile === null) {
      throw new NotFoundException(MENTOR_PROFILE_NOT_FOUND_MESSAGE);
    }

    const [socialLinks, photoUrl, occupiedSeats] = await Promise.all([
      this.findSocialLinks(userId),
      this.findPhotoUrl(userId),
      this.enrolmentsService.countActiveByMentor(userId),
    ]);
    const { status, domainId, bio, highlights, capacity } = mentorProfile;
    const {
      workplaces = [],
      achievements = [],
      certifications = [],
    } = highlights;
    const highlightLists = { workplaces, achievements, certifications };
    return {
      status,
      domainId,
      bio,
      highlights: highlightLists,
      socialLinks,
      photoUrl,
      capacity,
      occupiedSeats,
    };
  }

  async saveMentorProfile(
    userId: string,
    mentorProfile: MentorProfileDto,
  ): Promise<void> {
    const { domainId } = mentorProfile;
    const hasProfile = await this.mentorProfilesRepository.existsBy({
      userId,
    });
    if (!hasProfile) {
      throw new NotFoundException(MENTOR_PROFILE_NOT_FOUND_MESSAGE);
    }
    const isDomainSet = typeof domainId === 'string';
    if (isDomainSet) {
      const isActiveDomain = await this.domainsService.isActiveDomain(domainId);
      if (!isActiveDomain) {
        throw new BadRequestException(INACTIVE_DOMAIN_MESSAGE);
      }
    }

    await this.replaceEditableProfile(userId, mentorProfile);
  }

  async setMentorPhoto(userId: string, fileId: string): Promise<void> {
    const uploadedFiles = await this.filesService.findUploadedBy(userId, [
      fileId,
    ]);
    const photoFile = uploadedFiles.at(0);
    if (photoFile === undefined) {
      throw new BadRequestException(PHOTO_NOT_UPLOADED_BY_USER_MESSAGE);
    }
    const isPhotoImage = PHOTO_MIME_TYPES.includes(photoFile.mimeType);
    if (!isPhotoImage) {
      throw new BadRequestException(PHOTO_NOT_IMAGE_MESSAGE);
    }
    const isPhotoInBucket = await this.filesService.hasUploadedObject(
      photoFile.storageKey,
    );
    if (!isPhotoInBucket) {
      throw new BadRequestException(PHOTO_NOT_IN_BUCKET_MESSAGE);
    }

    await this.authService.setAvatar(userId, fileId);
  }

  async setMentorCapacity(
    userId: string,
    mentorCapacity: MentorCapacityDto,
  ): Promise<void> {
    const capacity = mentorCapacity.capacity ?? null;
    const updateResult = await this.mentorProfilesRepository.update(
      { userId },
      { capacity },
    );
    const isProfileMissing = updateResult.affected === 0;
    if (isProfileMissing) {
      throw new NotFoundException(MENTOR_PROFILE_NOT_FOUND_MESSAGE);
    }
  }

  private async findSocialLinks(
    userId: string,
  ): Promise<MentorProfileResponseDto['socialLinks']> {
    const socialLinks = await this.mentorSocialLinksRepository.find({
      where: { mentorId: userId },
      order: { position: 'ASC' },
    });
    const socialLinkResponses = socialLinks.map(({ platform, url }) => ({
      platform,
      url,
    }));
    return socialLinkResponses;
  }

  private async findPhotoUrl(userId: string): Promise<string | null> {
    const avatarFileId = await this.authService.findAvatarFileId(userId);
    if (avatarFileId === null) {
      return null;
    }
    const avatarFiles = await this.filesService.findUploadedBy(userId, [
      avatarFileId,
    ]);
    const avatarFile = avatarFiles.at(0);
    if (avatarFile === undefined) {
      return null;
    }
    const photoUrl = await this.filesService.createDownloadUrl(
      avatarFile.storageKey,
    );
    return photoUrl;
  }

  private async replaceEditableProfile(
    userId: string,
    mentorProfile: MentorProfileDto,
  ): Promise<void> {
    const { highlights, socialLinks } = mentorProfile;
    const domainId = mentorProfile.domainId ?? null;
    const bio = mentorProfile.bio ?? null;
    const socialLinkRows = socialLinks.map(({ platform, url }, index) => ({
      mentorId: userId,
      platform,
      url,
      position: FIRST_SOCIAL_LINK_POSITION + index,
    }));
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(MentorProfile)
        .update({ userId }, { domainId, bio, highlights });
      const socialLinksRepository = manager.getRepository(MentorSocialLink);
      await socialLinksRepository.delete({ mentorId: userId });
      await socialLinksRepository.insert(socialLinkRows);
    });
  }

  private async findFilesUploadedBy(
    userId: string,
    fileIds: string[],
  ): Promise<StoredFile[]> {
    const uploadedFiles = await this.filesService.findUploadedBy(
      userId,
      fileIds,
    );
    const uploadedFileIds = new Set(uploadedFiles.map(({ id }) => id));
    const isEveryFileUploadedByUser = fileIds.every((fileId) =>
      uploadedFileIds.has(fileId),
    );
    if (!isEveryFileUploadedByUser) {
      throw new BadRequestException(FILE_NOT_UPLOADED_BY_USER_MESSAGE);
    }
    return uploadedFiles;
  }

  private async assertFilesAreInBucket(files: StoredFile[]): Promise<void> {
    const isInBucketByFile = await Promise.all(
      files.map(({ storageKey }) =>
        this.filesService.hasUploadedObject(storageKey),
      ),
    );
    const fileNotInBucket = files.find(
      (_file, index) => !isInBucketByFile[index],
    );
    if (fileNotInBucket !== undefined) {
      const message = toFileNotInBucketMessage(fileNotInBucket.originalName);
      throw new BadRequestException(message);
    }
  }

  private async insertApplication(
    userId: string,
    application: MentorApplicationDto,
    submittedAt: Date,
  ): Promise<void> {
    const { linkedinUrl, motivation, cvFileId, credentials } = application;
    const cvCredential = {
      mentorId: userId,
      type: MENTOR_CREDENTIAL_TYPE.CV,
      fileId: cvFileId,
    };
    const otherCredentials = credentials.map(({ fileId, type }) => ({
      mentorId: userId,
      type,
      fileId,
    }));
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MentorProfile).insert({
        userId,
        status: MENTOR_PROFILE_STATUS.PENDING,
        submittedAt,
        linkedinUrl,
        motivation,
      });
      await manager
        .getRepository(MentorCredential)
        .insert([cvCredential, ...otherCredentials]);
    });
  }
}
