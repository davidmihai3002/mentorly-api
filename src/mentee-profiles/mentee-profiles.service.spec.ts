import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UpdateResult, type Repository } from 'typeorm';
import { DomainsService } from '../domains/index.js';
import { MenteeProfile } from '../users/index.js';
import type { MatchingFormDto } from './dto/index.js';
import { MenteeProfilesService } from './mentee-profiles.service.js';

const USER_ID = '0b7d9e2f-3c4a-4e5b-8f6a-7c8d9e0f1a2b';
const DOMAIN_ID = '5a8c2e1f-4b7d-4e9a-8c3f-6d1e2b4a7c90';
const MENTEE_PROFILE_NOT_FOUND = new NotFoundException(
  'Mentee profile not found.',
);
const INACTIVE_DOMAIN = new BadRequestException(
  'domainId must be one of the active domains.',
);

const matchingForm = {
  domainId: DOMAIN_ID,
  needs: 'Feedback on my CV and practice for job interviews.',
  studies: 'Second year of Computer Science at the University of Bucharest.',
  careerGoals: 'A junior backend developer role within a year.',
} satisfies MatchingFormDto;

const emptyMatchingForm = {
  domainId: null,
  needs: null,
  studies: null,
  careerGoals: null,
};

const buildUpdateResult = (affected: number): UpdateResult =>
  Object.assign(new UpdateResult(), { raw: [], affected, generatedMaps: [] });

describe('MenteeProfilesService', () => {
  const menteeProfilesRepository = {
    findOneBy: vi.fn<Repository<MenteeProfile>['findOneBy']>(),
    update: vi.fn<Repository<MenteeProfile>['update']>(),
  };
  const domainsService = {
    isActiveDomain: vi.fn<DomainsService['isActiveDomain']>(),
  };
  let menteeProfilesService: MenteeProfilesService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const testingModule = await Test.createTestingModule({
      providers: [
        MenteeProfilesService,
        {
          provide: getRepositoryToken(MenteeProfile),
          useValue: menteeProfilesRepository,
        },
        { provide: DomainsService, useValue: domainsService },
      ],
    }).compile();

    menteeProfilesService = testingModule.get(MenteeProfilesService);
  });

  describe('getMatchingForm', () => {
    it.each([
      ['filled in', matchingForm],
      ['not filled in yet, with null for every field', emptyMatchingForm],
    ])(
      'returns the matching form of the current mentee when it is %s',
      async (_formState, storedForm) => {
        menteeProfilesRepository.findOneBy.mockResolvedValueOnce(
          Object.assign(new MenteeProfile(), {
            userId: USER_ID,
            ...storedForm,
          }),
        );

        await expect(
          menteeProfilesService.getMatchingForm(USER_ID),
        ).resolves.toStrictEqual(storedForm);
        expect(
          menteeProfilesRepository.findOneBy,
        ).toHaveBeenCalledExactlyOnceWith({ userId: USER_ID });
      },
    );

    it('rejects reading the form when the mentee has no profile', async () => {
      menteeProfilesRepository.findOneBy.mockResolvedValueOnce(null);

      await expect(
        menteeProfilesService.getMatchingForm(USER_ID),
      ).rejects.toThrow(MENTEE_PROFILE_NOT_FOUND);
    });
  });

  describe('saveMatchingForm', () => {
    it('rejects a domain that is inactive or unknown and updates nothing', async () => {
      domainsService.isActiveDomain.mockResolvedValueOnce(false);

      await expect(
        menteeProfilesService.saveMatchingForm(USER_ID, matchingForm),
      ).rejects.toThrow(INACTIVE_DOMAIN);
      expect(domainsService.isActiveDomain).toHaveBeenCalledExactlyOnceWith(
        DOMAIN_ID,
      );
      expect(menteeProfilesRepository.update).not.toHaveBeenCalled();
    });

    it('updates only the four matching form columns of the current mentee', async () => {
      domainsService.isActiveDomain.mockResolvedValueOnce(true);
      menteeProfilesRepository.update.mockResolvedValueOnce(
        buildUpdateResult(1),
      );

      await expect(
        menteeProfilesService.saveMatchingForm(USER_ID, matchingForm),
      ).resolves.toBeUndefined();
      expect(menteeProfilesRepository.update).toHaveBeenCalledExactlyOnceWith(
        { userId: USER_ID },
        matchingForm,
      );
    });

    it('rejects saving when the mentee has no profile row to update', async () => {
      domainsService.isActiveDomain.mockResolvedValueOnce(true);
      menteeProfilesRepository.update.mockResolvedValueOnce(
        buildUpdateResult(0),
      );

      await expect(
        menteeProfilesService.saveMatchingForm(USER_ID, matchingForm),
      ).rejects.toThrow(MENTEE_PROFILE_NOT_FOUND);
    });
  });
});
