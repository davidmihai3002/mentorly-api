import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FILE_MIME_TYPE, FilesService } from '../files/index.js';
import type { StoredFile } from '../files/index.js';
import type {
  MentorApplicationDto,
  MentorApplicationResponseDto,
} from './dto/index.js';
import {
  MENTOR_CREDENTIAL_TYPE,
  MENTOR_PROFILE_STATUS,
  MentorCredential,
  MentorProfile,
} from './entities/index.js';

const ALREADY_APPLIED_MESSAGE = 'You have already applied to become a mentor.';
const FILE_NOT_UPLOADED_BY_USER_MESSAGE =
  'Every file must be one you uploaded.';
const CV_NOT_PDF_MESSAGE = 'The CV must be a PDF.';

const toFileNotInBucketMessage = (originalName: string): string =>
  `The file ${originalName} hasn't been uploaded yet.`;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MentorProfile)
    private readonly mentorProfilesRepository: Repository<MentorProfile>,
    private readonly filesService: FilesService,
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
