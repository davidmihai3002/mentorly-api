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
});
