import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InsertResult, UpdateResult, type Repository } from 'typeorm';
import type { MentorshipDetailsDto } from './dto/index.js';
import { AvailabilitySlot, Mentorship } from './entities/index.js';
import { MentorshipsService } from './mentorships.service.js';

const MENTOR_ID = '3f6a1c9e-2b4d-4e8f-9a7c-5d1e0b2c4a68';
const MENTORSHIP_ID = '8c2e4a6f-1d3b-4f5a-9e7c-0b2d4f6a8c1e';
const PUBLISHED_AT = new Date('2026-11-21T10:00:00.000Z');
const MENTORSHIP_NOT_FOUND = new NotFoundException('Mentorship not found.');
const MENTORSHIP_NOT_PUBLISHABLE = new BadRequestException(
  'To publish, add a description, at least one price or a sponsorship, and at least one availability slot.',
);

const mentorshipDetails = {
  description: 'Weekly code reviews and a backend project built together.',
  conditions: 'Two hours of practice between sessions.',
  minKnowledge: 'Basic JavaScript and Git.',
} satisfies MentorshipDetailsDto;

const buildMentorship = (changes: Partial<Mentorship> = {}): Mentorship =>
  Object.assign(new Mentorship(), {
    id: MENTORSHIP_ID,
    mentorId: MENTOR_ID,
    ...mentorshipDetails,
    isSponsored: false,
    perSessionPriceBani: 15000,
    monthlyPriceBani: null,
    publishedAt: null,
    ...changes,
  });

const buildUpdateResult = (affected: number): UpdateResult =>
  Object.assign(new UpdateResult(), { raw: [], affected, generatedMaps: [] });

describe('MentorshipsService', () => {
  const mentorshipsRepository = {
    findOneBy: vi.fn<Repository<Mentorship>['findOneBy']>(),
    upsert: vi.fn<Repository<Mentorship>['upsert']>(),
    update: vi.fn<Repository<Mentorship>['update']>(),
  };
  const availabilitySlotsRepository = {
    existsBy: vi.fn<Repository<AvailabilitySlot>['existsBy']>(),
  };
  let mentorshipsService: MentorshipsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const testingModule = await Test.createTestingModule({
      providers: [
        MentorshipsService,
        {
          provide: getRepositoryToken(Mentorship),
          useValue: mentorshipsRepository,
        },
        {
          provide: getRepositoryToken(AvailabilitySlot),
          useValue: availabilitySlotsRepository,
        },
      ],
    }).compile();

    mentorshipsService = testingModule.get(MentorshipsService);
  });

  describe('getMentorship', () => {
    it('returns the description, conditions, minimum knowledge and publish date of the current mentor', async () => {
      mentorshipsRepository.findOneBy.mockResolvedValueOnce(
        buildMentorship({ publishedAt: PUBLISHED_AT }),
      );

      await expect(
        mentorshipsService.getMentorship(MENTOR_ID),
      ).resolves.toStrictEqual({
        ...mentorshipDetails,
        publishedAt: PUBLISHED_AT,
      });
      expect(mentorshipsRepository.findOneBy).toHaveBeenCalledExactlyOnceWith({
        mentorId: MENTOR_ID,
      });
    });

    it('rejects reading when the mentor has no mentorship yet', async () => {
      mentorshipsRepository.findOneBy.mockResolvedValueOnce(null);

      await expect(mentorshipsService.getMentorship(MENTOR_ID)).rejects.toThrow(
        MENTORSHIP_NOT_FOUND,
      );
    });
  });

  describe('saveMentorshipDetails', () => {
    it('creates or updates the mentorship of the current mentor with one upsert on mentor_id', async () => {
      mentorshipsRepository.upsert.mockResolvedValueOnce(new InsertResult());

      await expect(
        mentorshipsService.saveMentorshipDetails(MENTOR_ID, mentorshipDetails),
      ).resolves.toBeUndefined();
      expect(mentorshipsRepository.upsert).toHaveBeenCalledExactlyOnceWith(
        { mentorId: MENTOR_ID, ...mentorshipDetails },
        { conflictPaths: ['mentorId'] },
      );
    });

    it('saves null for every field missing from the body', async () => {
      mentorshipsRepository.upsert.mockResolvedValueOnce(new InsertResult());

      await mentorshipsService.saveMentorshipDetails(MENTOR_ID, {
        description: mentorshipDetails.description,
      });

      expect(mentorshipsRepository.upsert).toHaveBeenCalledExactlyOnceWith(
        {
          mentorId: MENTOR_ID,
          description: mentorshipDetails.description,
          conditions: null,
          minKnowledge: null,
        },
        { conflictPaths: ['mentorId'] },
      );
    });
  });

  describe('publishMentorship', () => {
    it('rejects publishing when the mentor has no mentorship yet and writes nothing', async () => {
      mentorshipsRepository.findOneBy.mockResolvedValueOnce(null);
      availabilitySlotsRepository.existsBy.mockResolvedValueOnce(true);

      await expect(
        mentorshipsService.publishMentorship(MENTOR_ID),
      ).rejects.toThrow(MENTORSHIP_NOT_FOUND);
      expect(mentorshipsRepository.update).not.toHaveBeenCalled();
    });

    it.each([
      ['without a description', { description: null }, true],
      [
        'without a price or a sponsorship',
        { perSessionPriceBani: null, monthlyPriceBani: null },
        true,
      ],
      ['without an availability slot', {}, false],
    ])(
      'rejects publishing a mentorship %s and writes nothing',
      async (_problem, changes, hasAvailabilitySlot) => {
        mentorshipsRepository.findOneBy.mockResolvedValueOnce(
          buildMentorship(changes),
        );
        availabilitySlotsRepository.existsBy.mockResolvedValueOnce(
          hasAvailabilitySlot,
        );

        await expect(
          mentorshipsService.publishMentorship(MENTOR_ID),
        ).rejects.toThrow(MENTORSHIP_NOT_PUBLISHABLE);
        expect(mentorshipsRepository.update).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['a complete mentorship', {}],
      [
        'a sponsored mentorship without prices',
        { isSponsored: true, perSessionPriceBani: null },
      ],
      [
        'a mentorship with only a monthly price',
        { perSessionPriceBani: null, monthlyPriceBani: 60000 },
      ],
    ])('publishes %s now', async (_mentorshipKind, changes) => {
      vi.setSystemTime(PUBLISHED_AT);
      mentorshipsRepository.findOneBy.mockResolvedValueOnce(
        buildMentorship(changes),
      );
      availabilitySlotsRepository.existsBy.mockResolvedValueOnce(true);
      mentorshipsRepository.update.mockResolvedValueOnce(buildUpdateResult(1));

      await expect(
        mentorshipsService.publishMentorship(MENTOR_ID),
      ).resolves.toBeUndefined();
      expect(
        availabilitySlotsRepository.existsBy,
      ).toHaveBeenCalledExactlyOnceWith({ mentorId: MENTOR_ID });
      expect(mentorshipsRepository.update).toHaveBeenCalledExactlyOnceWith(
        { mentorId: MENTOR_ID },
        { publishedAt: PUBLISHED_AT },
      );
    });
  });

  describe('unpublishMentorship', () => {
    it('rejects unpublishing when the mentor has no mentorship yet', async () => {
      mentorshipsRepository.update.mockResolvedValueOnce(buildUpdateResult(0));

      await expect(
        mentorshipsService.unpublishMentorship(MENTOR_ID),
      ).rejects.toThrow(MENTORSHIP_NOT_FOUND);
    });

    it('clears published_at of the mentorship of the current mentor', async () => {
      mentorshipsRepository.update.mockResolvedValueOnce(buildUpdateResult(1));

      await expect(
        mentorshipsService.unpublishMentorship(MENTOR_ID),
      ).resolves.toBeUndefined();
      expect(mentorshipsRepository.update).toHaveBeenCalledExactlyOnceWith(
        { mentorId: MENTOR_ID },
        { publishedAt: null },
      );
    });
  });
});
