import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { SelectQueryBuilder } from 'typeorm';
import { EnrolmentsService } from './enrolments.service.js';
import { Enrolment } from './entities/index.js';

const MENTOR_ID = '0b7d9e2f-3c4a-4e5b-8f6a-7c8d9e0f1a2b';

type EnrolmentQueryBuilder = SelectQueryBuilder<Enrolment>;

describe('EnrolmentsService', () => {
  const queryBuilder = {
    innerJoin: vi.fn<EnrolmentQueryBuilder['innerJoin']>(),
    where: vi.fn<EnrolmentQueryBuilder['where']>(),
    andWhere: vi.fn<EnrolmentQueryBuilder['andWhere']>(),
    getCount: vi.fn<EnrolmentQueryBuilder['getCount']>(),
  };
  const enrolmentsRepository = {
    createQueryBuilder: vi.fn((_alias: string) => queryBuilder),
  };
  let enrolmentsService: EnrolmentsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    queryBuilder.innerJoin.mockReturnThis();
    queryBuilder.where.mockReturnThis();
    queryBuilder.andWhere.mockReturnThis();
    const testingModule = await Test.createTestingModule({
      providers: [
        EnrolmentsService,
        {
          provide: getRepositoryToken(Enrolment),
          useValue: enrolmentsRepository,
        },
      ],
    }).compile();

    enrolmentsService = testingModule.get(EnrolmentsService);
  });

  it('counts only the ACTIVE enrolments in the mentorship of the mentor', async () => {
    queryBuilder.getCount.mockResolvedValueOnce(3);

    await expect(
      enrolmentsService.countActiveByMentor(MENTOR_ID),
    ).resolves.toBe(3);
    expect(
      enrolmentsRepository.createQueryBuilder,
    ).toHaveBeenCalledExactlyOnceWith('enrolment');
    expect(queryBuilder.innerJoin).toHaveBeenCalledExactlyOnceWith(
      'mentorships',
      'mentorship',
      'mentorship.id = enrolment.mentorship_id',
    );
    expect(queryBuilder.where).toHaveBeenCalledExactlyOnceWith(
      'enrolment.status = :status',
      { status: 'ACTIVE' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledExactlyOnceWith(
      'mentorship.mentor_id = :mentorId',
      { mentorId: MENTOR_ID },
    );
    expect(queryBuilder.getCount).toHaveBeenCalledOnce();
  });
});
