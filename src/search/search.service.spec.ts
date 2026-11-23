import { Test } from '@nestjs/testing';
import {
  DataSource,
  type ObjectLiteral,
  type SelectQueryBuilder,
} from 'typeorm';
import { FilesService } from '../files/index.js';
import { SearchService } from './search.service.js';

type MentorsQueryBuilder = SelectQueryBuilder<ObjectLiteral>;

const MIHAI_ID = '4c1e7a9b-2d5f-4b8e-9a3c-6f0d2e8b1a74';
const BIANCA_ID = '7e2b9d4a-6c1f-4a3e-8b5d-0f9c3a7e2d16';
const AVATAR_STORAGE_KEY = `${MIHAI_ID}/3a6c9e1b-5d8f-4b2a-9c7e-1d4f7a0c3e95`;
const SIGNED_PHOTO_URL =
  'https://storage.example.com/mentorly-uploads/signed-photo';
const MENTEE_ID = '9d3f6b2e-1a7c-4e5b-8f0d-3c6a9e2b7f41';
const MARKETING_DOMAIN_ID = '2b8e5c1f-7d4a-4f9e-a6b3-0e7c4d1a9f52';
const FIRST_PAGE = { page: 1, pageSize: 20 };
const BASE_CONDITIONS = [
  ['account.deleted_at IS NULL'],
  ['mentorship.published_at IS NOT NULL'],
];

const fullMentorRow = {
  mentorId: MIHAI_ID,
  firstName: 'Mihai',
  lastName: 'Popescu',
  avatarStorageKey: AVATAR_STORAGE_KEY,
  domainName: 'Marketing',
  perSessionPriceBani: 12000,
  monthlyPriceBani: 43200,
  avgOverall: '4.75',
  statsReviewCount: 8,
  hasTest: true,
  sponsorName: 'Nordwave Software',
};

const bareMentorRow = {
  mentorId: BIANCA_ID,
  firstName: 'Bianca',
  lastName: 'Pavel',
  avatarStorageKey: null,
  domainName: null,
  perSessionPriceBani: 15000,
  monthlyPriceBani: null,
  avgOverall: null,
  statsReviewCount: null,
  hasTest: false,
  sponsorName: null,
};

const createQueryBuilderMock = () => ({
  from: vi.fn<MentorsQueryBuilder['from']>().mockReturnThis(),
  innerJoin: vi.fn<MentorsQueryBuilder['innerJoin']>().mockReturnThis(),
  leftJoin: vi.fn<MentorsQueryBuilder['leftJoin']>().mockReturnThis(),
  where: vi.fn<MentorsQueryBuilder['where']>().mockReturnThis(),
  andWhere: vi.fn<MentorsQueryBuilder['andWhere']>().mockReturnThis(),
  select: vi.fn<MentorsQueryBuilder['select']>().mockReturnThis(),
  addSelect: vi.fn<MentorsQueryBuilder['addSelect']>().mockReturnThis(),
  orderBy: vi.fn<MentorsQueryBuilder['orderBy']>().mockReturnThis(),
  addOrderBy: vi.fn<MentorsQueryBuilder['addOrderBy']>().mockReturnThis(),
  offset: vi.fn<MentorsQueryBuilder['offset']>().mockReturnThis(),
  limit: vi.fn<MentorsQueryBuilder['limit']>().mockReturnThis(),
  getRawOne: vi.fn<MentorsQueryBuilder['getRawOne']>(),
  getRawMany: vi.fn<MentorsQueryBuilder['getRawMany']>(),
});

type QueryBuilderMock = ReturnType<typeof createQueryBuilderMock>;

describe('SearchService', () => {
  const dataSource = {
    createQueryBuilder: vi.fn<() => QueryBuilderMock>(),
  };
  const filesService = {
    createDownloadUrl: vi.fn<FilesService['createDownloadUrl']>(),
  };
  let countQueryBuilder: QueryBuilderMock;
  let pageQueryBuilder: QueryBuilderMock;
  let searchService: SearchService;

  const returnMentors = (
    total: string,
    mentorRows: (typeof fullMentorRow | typeof bareMentorRow)[],
  ): void => {
    countQueryBuilder.getRawOne.mockResolvedValueOnce({ total });
    pageQueryBuilder.getRawMany.mockResolvedValueOnce(mentorRows);
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    countQueryBuilder = createQueryBuilderMock();
    pageQueryBuilder = createQueryBuilderMock();
    dataSource.createQueryBuilder
      .mockReturnValueOnce(countQueryBuilder)
      .mockReturnValueOnce(pageQueryBuilder);
    const testingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: DataSource, useValue: dataSource },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    searchService = testingModule.get(SearchService);
  });

  it('counts and lists only approved mentors with a published mentorship and an account that is not deleted', async () => {
    returnMentors('0', []);

    await searchService.searchMentors({ page: 1, pageSize: 20 });

    for (const queryBuilder of [countQueryBuilder, pageQueryBuilder]) {
      expect(queryBuilder.from).toHaveBeenCalledExactlyOnceWith(
        'mentor_profiles',
        'profile',
      );
      expect(queryBuilder.innerJoin.mock.calls).toStrictEqual([
        ['users', 'account', 'account.id = profile.user_id'],
        ['mentorships', 'mentorship', 'mentorship.mentor_id = profile.user_id'],
      ]);
      expect(queryBuilder.where).toHaveBeenCalledExactlyOnceWith(
        'profile.status = :approvedStatus',
        { approvedStatus: 'APPROVED' },
      );
      expect(queryBuilder.andWhere.mock.calls).toStrictEqual([
        ['account.deleted_at IS NULL'],
        ['mentorship.published_at IS NOT NULL'],
      ]);
    }
    expect(countQueryBuilder.select).toHaveBeenCalledExactlyOnceWith(
      'COUNT(*)',
      'total',
    );
  });

  it('orders by rating with unrated mentors last, then by the newest publication, then by mentor id', async () => {
    returnMentors('0', []);

    await searchService.searchMentors({ page: 1, pageSize: 20 });

    expect(pageQueryBuilder.orderBy).toHaveBeenCalledExactlyOnceWith(
      'rating_stats.avg_overall',
      'DESC',
      'NULLS LAST',
    );
    expect(pageQueryBuilder.addOrderBy.mock.calls).toStrictEqual([
      ['mentorship.published_at', 'DESC'],
      ['profile.user_id', 'ASC'],
    ]);
  });

  it('skips the first 40 mentors for page 3 with 20 mentors per page and returns the total as a number', async () => {
    returnMentors('45', [bareMentorRow]);

    const mentorsPage = await searchService.searchMentors({
      page: 3,
      pageSize: 20,
    });

    expect(pageQueryBuilder.offset).toHaveBeenCalledExactlyOnceWith(40);
    expect(pageQueryBuilder.limit).toHaveBeenCalledExactlyOnceWith(20);
    expect(mentorsPage).toMatchObject({ page: 3, pageSize: 20, total: 45 });
  });

  it('returns a mentor card with a signed photo URL and the rating as a number', async () => {
    returnMentors('1', [fullMentorRow]);
    filesService.createDownloadUrl.mockResolvedValueOnce(SIGNED_PHOTO_URL);

    const mentorsPage = await searchService.searchMentors({
      page: 1,
      pageSize: 20,
    });

    expect(mentorsPage).toStrictEqual({
      items: [
        {
          mentorId: MIHAI_ID,
          firstName: 'Mihai',
          lastName: 'Popescu',
          photoUrl: SIGNED_PHOTO_URL,
          domainName: 'Marketing',
          perSessionPriceBani: 12000,
          monthlyPriceBani: 43200,
          rating: 4.75,
          reviewCount: 8,
          hasTest: true,
          sponsorName: 'Nordwave Software',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    expect(filesService.createDownloadUrl).toHaveBeenCalledExactlyOnceWith(
      AVATAR_STORAGE_KEY,
    );
  });

  it('returns a mentor without avatar, reviews, domain or sponsor with null photo, rating, domain and sponsor and 0 reviews', async () => {
    returnMentors('1', [bareMentorRow]);

    const mentorsPage = await searchService.searchMentors({
      page: 1,
      pageSize: 20,
    });

    expect(mentorsPage.items).toStrictEqual([
      {
        mentorId: BIANCA_ID,
        firstName: 'Bianca',
        lastName: 'Pavel',
        photoUrl: null,
        domainName: null,
        perSessionPriceBani: 15000,
        monthlyPriceBani: null,
        rating: null,
        reviewCount: 0,
        hasTest: false,
        sponsorName: null,
      },
    ]);
    expect(filesService.createDownloadUrl).not.toHaveBeenCalled();
  });

  describe('filters', () => {
    const expectConditionsOnBothQueries = (
      filterConditions: unknown[][],
    ): void => {
      for (const queryBuilder of [countQueryBuilder, pageQueryBuilder]) {
        expect(queryBuilder.andWhere.mock.calls).toStrictEqual([
          ...BASE_CONDITIONS,
          ...filterConditions,
        ]);
      }
    };

    const readFilterCondition = (): unknown => {
      const [filterCondition] =
        countQueryBuilder.andWhere.mock.calls[BASE_CONDITIONS.length];
      return filterCondition;
    };

    beforeEach(() => {
      returnMentors('0', []);
    });

    it('adds no condition when free seats and free time are false', async () => {
      await searchService.searchMentors({
        ...FIRST_PAGE,
        hasFreeSeats: false,
        hasFreeTimeThisWeek: false,
      });

      expectConditionsOnBothQueries([]);
    });

    it('counts and lists only mentors from the chosen domain', async () => {
      await searchService.searchMentors({
        ...FIRST_PAGE,
        domainId: MARKETING_DOMAIN_ID,
      });

      expectConditionsOnBothQueries([
        ['profile.domain_id = :domainId', { domainId: MARKETING_DOMAIN_ID }],
      ]);
    });

    it.each([
      [
        'a minimum and a maximum price',
        { minPriceBani: 5000, maxPriceBani: 20000 },
        { minPriceBani: 5000, maxPriceBani: 20000 },
      ],
      [
        'only a minimum price, up to the largest integer price',
        { minPriceBani: 5000 },
        { minPriceBani: 5000, maxPriceBani: 2147483647 },
      ],
      [
        'only a maximum price, from 0 bani',
        { maxPriceBani: 20000 },
        { minPriceBani: 0, maxPriceBani: 20000 },
      ],
    ])(
      'counts and lists mentors within %s',
      async (_case, priceFilter, priceRange) => {
        await searchService.searchMentors({ ...FIRST_PAGE, ...priceFilter });

        expectConditionsOnBothQueries([
          [
            expect.stringContaining('BETWEEN :minPriceBani AND :maxPriceBani'),
            priceRange,
          ],
        ]);
      },
    );

    it('matches the price range on the per-session price, the exact monthly price per session or 0 for a sponsored mentorship', async () => {
      await searchService.searchMentors({ ...FIRST_PAGE, maxPriceBani: 0 });

      const priceCondition = readFilterCondition();

      expect(priceCondition).toContain(
        'mentorship.per_session_price_bani BETWEEN :minPriceBani AND :maxPriceBani',
      );
      expect(priceCondition).toContain(
        'mentorship.monthly_price_bani::numeric / mentorship.monthly_sessions_count BETWEEN :minPriceBani AND :maxPriceBani',
      );
      expect(priceCondition).toContain(
        'mentorship.is_sponsored AND 0 BETWEEN :minPriceBani AND :maxPriceBani',
      );
    });

    it('counts and lists only mentors whose average review rating reaches the minimum, leaving out mentors without reviews', async () => {
      await searchService.searchMentors({ ...FIRST_PAGE, minRating: 4.5 });

      expectConditionsOnBothQueries([
        [
          expect.stringContaining('FROM mentor_rating_stats rated_mentor'),
          { minRating: 4.5 },
        ],
      ]);
      expect(readFilterCondition()).toContain(
        'rated_mentor.avg_overall >= :minRating',
      );
    });

    it('counts and lists only mentors without a capacity or with fewer active enrolments than their capacity', async () => {
      await searchService.searchMentors({ ...FIRST_PAGE, hasFreeSeats: true });

      expectConditionsOnBothQueries([
        [
          expect.stringContaining('profile.capacity IS NULL'),
          { activeEnrolmentStatus: 'ACTIVE' },
        ],
      ]);
      const freeSeatsCondition = readFilterCondition();
      expect(freeSeatsCondition).toContain('OR profile.capacity > (');
      expect(freeSeatsCondition).toContain(
        'active_enrolment.mentorship_id = mentorship.id',
      );
      expect(freeSeatsCondition).toContain(
        'active_enrolment.status = :activeEnrolmentStatus',
      );
    });

    it('counts and lists only mentors with a weekly availability window in the next 7 days, Bucharest time, that has not ended and has no overlapping session', async () => {
      await searchService.searchMentors({
        ...FIRST_PAGE,
        hasFreeTimeThisWeek: true,
      });

      expectConditionsOnBothQueries([
        [
          expect.stringContaining('FROM availability_slots free_slot'),
          { freeTimeDays: 7, availabilityTimeZone: 'Europe/Bucharest' },
        ],
      ]);
      const freeTimeCondition = readFilterCondition();
      expect(freeTimeCondition).toContain(
        'free_slot.day_of_week = EXTRACT(ISODOW FROM slot_day.local_date)',
      );
      expect(freeTimeCondition).toContain(
        '(slot_day.local_date + free_slot.start_time) AT TIME ZONE :availabilityTimeZone AS starts_at',
      );
      expect(freeTimeCondition).toContain('slot_window.ends_at > now()');
      expect(freeTimeCondition).toContain(
        'slot_window.starts_at < now() + make_interval(days => :freeTimeDays)',
      );
      expect(freeTimeCondition).toContain('AND NOT EXISTS (');
      expect(freeTimeCondition).toContain(
        'booked_session.mentor_id = profile.user_id',
      );
      expect(freeTimeCondition).toContain(
        'booked_session.starts_at < slot_window.ends_at',
      );
      expect(freeTimeCondition).toContain(
        'booked_session.ends_at > slot_window.starts_at',
      );
    });

    it('combines every filter on both queries and keeps the paging', async () => {
      await searchService.searchMentors({
        page: 2,
        pageSize: 10,
        domainId: MARKETING_DOMAIN_ID,
        minPriceBani: 5000,
        maxPriceBani: 20000,
        minRating: 4,
        hasFreeSeats: true,
        hasFreeTimeThisWeek: true,
      });

      expectConditionsOnBothQueries([
        ['profile.domain_id = :domainId', { domainId: MARKETING_DOMAIN_ID }],
        [
          expect.stringContaining('BETWEEN :minPriceBani AND :maxPriceBani'),
          { minPriceBani: 5000, maxPriceBani: 20000 },
        ],
        [
          expect.stringContaining('avg_overall >= :minRating'),
          { minRating: 4 },
        ],
        [
          expect.stringContaining('profile.capacity IS NULL'),
          { activeEnrolmentStatus: 'ACTIVE' },
        ],
        [
          expect.stringContaining('FROM availability_slots free_slot'),
          { freeTimeDays: 7, availabilityTimeZone: 'Europe/Bucharest' },
        ],
      ]);
      expect(pageQueryBuilder.offset).toHaveBeenCalledExactlyOnceWith(10);
      expect(pageQueryBuilder.limit).toHaveBeenCalledExactlyOnceWith(10);
    });
  });
});

describe('SearchService recommendations', () => {
  const dataSource = {
    createQueryBuilder: vi.fn<() => QueryBuilderMock>(),
  };
  const filesService = {
    createDownloadUrl: vi.fn<FilesService['createDownloadUrl']>(),
  };
  let menteeQueryBuilder: QueryBuilderMock;
  let mentorsQueryBuilder: QueryBuilderMock;
  let searchService: SearchService;

  const returnMenteeDomain = (domainId: string | null): void => {
    menteeQueryBuilder.getRawOne.mockResolvedValueOnce({ domainId });
  };

  const returnRecommendedMentors = (
    mentorRows: (typeof fullMentorRow | typeof bareMentorRow)[],
  ): void => {
    returnMenteeDomain(MARKETING_DOMAIN_ID);
    mentorsQueryBuilder.getRawMany.mockResolvedValueOnce(mentorRows);
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    menteeQueryBuilder = createQueryBuilderMock();
    mentorsQueryBuilder = createQueryBuilderMock();
    dataSource.createQueryBuilder
      .mockReturnValueOnce(menteeQueryBuilder)
      .mockReturnValueOnce(mentorsQueryBuilder);
    const testingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: DataSource, useValue: dataSource },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    searchService = testingModule.get(SearchService);
  });

  it('reads the domain of the signed-in mentee from the mentee profile', async () => {
    returnMenteeDomain(null);

    await searchService.findRecommendedMentors(MENTEE_ID);

    expect(menteeQueryBuilder.from).toHaveBeenCalledExactlyOnceWith(
      'mentee_profiles',
      'mentee_profile',
    );
    expect(menteeQueryBuilder.select).toHaveBeenCalledExactlyOnceWith(
      'mentee_profile.domain_id',
      'domainId',
    );
    expect(menteeQueryBuilder.where).toHaveBeenCalledExactlyOnceWith(
      'mentee_profile.user_id = :menteeId',
      { menteeId: MENTEE_ID },
    );
  });

  it.each([
    ['has not filled in the matching form', { domainId: null }],
    ['has no mentee profile', undefined],
  ])(
    'recommends no mentors and runs no mentor query when the mentee %s',
    async (_case, menteeDomainRow) => {
      menteeQueryBuilder.getRawOne.mockResolvedValueOnce(menteeDomainRow);

      const recommendedMentors =
        await searchService.findRecommendedMentors(MENTEE_ID);

      expect(recommendedMentors).toStrictEqual([]);
      expect(dataSource.createQueryBuilder).toHaveBeenCalledOnce();
    },
  );

  it('recommends only approved mentors with a published mentorship and an account that is not deleted from the domain of the mentee', async () => {
    returnRecommendedMentors([]);

    await searchService.findRecommendedMentors(MENTEE_ID);

    expect(mentorsQueryBuilder.from).toHaveBeenCalledExactlyOnceWith(
      'mentor_profiles',
      'profile',
    );
    expect(mentorsQueryBuilder.innerJoin.mock.calls).toStrictEqual([
      ['users', 'account', 'account.id = profile.user_id'],
      ['mentorships', 'mentorship', 'mentorship.mentor_id = profile.user_id'],
    ]);
    expect(mentorsQueryBuilder.where).toHaveBeenCalledExactlyOnceWith(
      'profile.status = :approvedStatus',
      { approvedStatus: 'APPROVED' },
    );
    expect(mentorsQueryBuilder.andWhere.mock.calls).toStrictEqual([
      ['account.deleted_at IS NULL'],
      ['mentorship.published_at IS NOT NULL'],
      [
        'profile.domain_id = :menteeDomainId',
        { menteeDomainId: MARKETING_DOMAIN_ID },
      ],
    ]);
  });

  it('orders recommendations by rating with unrated mentors last, then by the newest publication, then by mentor id, and keeps the first 3', async () => {
    returnRecommendedMentors([]);

    await searchService.findRecommendedMentors(MENTEE_ID);

    expect(mentorsQueryBuilder.orderBy).toHaveBeenCalledExactlyOnceWith(
      'rating_stats.avg_overall',
      'DESC',
      'NULLS LAST',
    );
    expect(mentorsQueryBuilder.addOrderBy.mock.calls).toStrictEqual([
      ['mentorship.published_at', 'DESC'],
      ['profile.user_id', 'ASC'],
    ]);
    expect(mentorsQueryBuilder.limit).toHaveBeenCalledExactlyOnceWith(3);
    expect(mentorsQueryBuilder.offset).not.toHaveBeenCalled();
  });

  it('returns recommended mentors as the same cards as the mentor search', async () => {
    returnRecommendedMentors([fullMentorRow, bareMentorRow]);
    filesService.createDownloadUrl.mockResolvedValueOnce(SIGNED_PHOTO_URL);

    const recommendedMentors =
      await searchService.findRecommendedMentors(MENTEE_ID);

    expect(recommendedMentors).toStrictEqual([
      {
        mentorId: MIHAI_ID,
        firstName: 'Mihai',
        lastName: 'Popescu',
        photoUrl: SIGNED_PHOTO_URL,
        domainName: 'Marketing',
        perSessionPriceBani: 12000,
        monthlyPriceBani: 43200,
        rating: 4.75,
        reviewCount: 8,
        hasTest: true,
        sponsorName: 'Nordwave Software',
      },
      {
        mentorId: BIANCA_ID,
        firstName: 'Bianca',
        lastName: 'Pavel',
        photoUrl: null,
        domainName: null,
        perSessionPriceBani: 15000,
        monthlyPriceBani: null,
        rating: null,
        reviewCount: 0,
        hasTest: false,
        sponsorName: null,
      },
    ]);
    expect(filesService.createDownloadUrl).toHaveBeenCalledExactlyOnceWith(
      AVATAR_STORAGE_KEY,
    );
  });
});
