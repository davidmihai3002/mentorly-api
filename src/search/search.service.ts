import { Injectable } from '@nestjs/common';
import {
  DataSource,
  type ObjectLiteral,
  type SelectQueryBuilder,
} from 'typeorm';
import { POSTGRES_INTEGER_MAX } from '../common/index.js';
import { ENROLMENT_STATUS } from '../enrolments/index.js';
import { FilesService } from '../files/index.js';
import { MENTOR_PROFILE_STATUS } from '../profiles/index.js';
import type {
  MentorSearchItemDto,
  MentorSearchQueryDto,
  MentorSearchResponseDto,
} from './dto/index.js';

const RECOMMENDED_MENTORS_LIMIT = 3;
const MIN_PRICE_BANI = 0;
const SPONSORED_PRICE_BANI = 0;
const FREE_TIME_DAYS = 7;
const AVAILABILITY_TIME_ZONE = 'Europe/Bucharest';

const PRICE_RANGE_CONDITION = `(
  mentorship.per_session_price_bani BETWEEN :minPriceBani AND :maxPriceBani
  OR mentorship.monthly_price_bani::numeric / mentorship.monthly_sessions_count BETWEEN :minPriceBani AND :maxPriceBani
  OR (mentorship.is_sponsored AND ${SPONSORED_PRICE_BANI} BETWEEN :minPriceBani AND :maxPriceBani)
)`;

const MIN_RATING_CONDITION = `EXISTS (
  SELECT 1
  FROM mentor_rating_stats rated_mentor
  WHERE rated_mentor.mentor_id = profile.user_id
    AND rated_mentor.avg_overall >= :minRating
)`;

const FREE_SEATS_CONDITION = `(
  profile.capacity IS NULL
  OR profile.capacity > (
    SELECT COUNT(*)
    FROM enrolments active_enrolment
    WHERE active_enrolment.mentorship_id = mentorship.id
      AND active_enrolment.status = :activeEnrolmentStatus
  )
)`;

const FREE_TIME_CONDITION = `EXISTS (
  SELECT 1
  FROM availability_slots free_slot
  CROSS JOIN generate_series(0, :freeTimeDays) AS day_offset(days)
  CROSS JOIN LATERAL (
    SELECT (now() AT TIME ZONE :availabilityTimeZone)::date + day_offset.days AS local_date
  ) slot_day
  CROSS JOIN LATERAL (
    SELECT
      (slot_day.local_date + free_slot.start_time) AT TIME ZONE :availabilityTimeZone AS starts_at,
      (slot_day.local_date + free_slot.end_time) AT TIME ZONE :availabilityTimeZone AS ends_at
  ) slot_window
  WHERE free_slot.mentor_id = profile.user_id
    AND free_slot.day_of_week = EXTRACT(ISODOW FROM slot_day.local_date)
    AND slot_window.ends_at > now()
    AND slot_window.starts_at < now() + make_interval(days => :freeTimeDays)
    AND NOT EXISTS (
      SELECT 1
      FROM sessions booked_session
      WHERE booked_session.mentor_id = profile.user_id
        AND booked_session.starts_at < slot_window.ends_at
        AND booked_session.ends_at > slot_window.starts_at
    )
)`;

type MentorSearchFilters = Omit<MentorSearchQueryDto, 'page' | 'pageSize'>;

type PriceFilter = Pick<MentorSearchFilters, 'minPriceBani' | 'maxPriceBani'>;

interface MentorCountRow {
  total: string;
}

interface MenteeDomainRow {
  domainId: string | null;
}

interface MentorSearchRow {
  mentorId: string;
  firstName: string;
  lastName: string;
  avatarStorageKey: string | null;
  domainName: string | null;
  perSessionPriceBani: number | null;
  monthlyPriceBani: number | null;
  avgOverall: string | null;
  statsReviewCount: number | null;
  hasTest: boolean;
  sponsorName: string | null;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly filesService: FilesService,
  ) {}

  async searchMentors(
    query: MentorSearchQueryDto,
  ): Promise<MentorSearchResponseDto> {
    const { page, pageSize, ...filters } = query;
    const [total, mentorRows] = await Promise.all([
      this.countSearchableMentors(filters),
      this.findSearchableMentorRows(page, pageSize, filters),
    ]);
    const items = await this.toMentorSearchItems(mentorRows);
    return { items, page, pageSize, total };
  }

  async findRecommendedMentors(
    menteeId: string,
  ): Promise<MentorSearchItemDto[]> {
    const menteeDomainId = await this.findMenteeDomainId(menteeId);
    if (menteeDomainId === null) {
      return [];
    }
    const mentorRows = await this.findRecommendedMentorRows(menteeDomainId);
    const recommendedMentors = await this.toMentorSearchItems(mentorRows);
    return recommendedMentors;
  }

  private async findMenteeDomainId(menteeId: string): Promise<string | null> {
    const menteeDomainRow = await this.dataSource
      .createQueryBuilder()
      .from('mentee_profiles', 'mentee_profile')
      .select('mentee_profile.domain_id', 'domainId')
      .where('mentee_profile.user_id = :menteeId', { menteeId })
      .getRawOne<MenteeDomainRow>();
    const menteeDomainId = menteeDomainRow?.domainId ?? null;
    return menteeDomainId;
  }

  private createSearchableMentorsQuery(): SelectQueryBuilder<ObjectLiteral> {
    const searchableMentorsQuery = this.dataSource
      .createQueryBuilder()
      .from('mentor_profiles', 'profile')
      .innerJoin('users', 'account', 'account.id = profile.user_id')
      .innerJoin(
        'mentorships',
        'mentorship',
        'mentorship.mentor_id = profile.user_id',
      )
      .where('profile.status = :approvedStatus', {
        approvedStatus: MENTOR_PROFILE_STATUS.APPROVED,
      })
      .andWhere('account.deleted_at IS NULL')
      .andWhere('mentorship.published_at IS NOT NULL');
    return searchableMentorsQuery;
  }

  private addSearchFilters(
    mentorsQuery: SelectQueryBuilder<ObjectLiteral>,
    filters: MentorSearchFilters,
  ): SelectQueryBuilder<ObjectLiteral> {
    const {
      domainId,
      minPriceBani,
      maxPriceBani,
      minRating,
      hasFreeSeats,
      hasFreeTimeThisWeek,
    } = filters;
    if (domainId !== undefined) {
      mentorsQuery.andWhere('profile.domain_id = :domainId', { domainId });
    }
    this.addPriceFilter(mentorsQuery, { minPriceBani, maxPriceBani });
    if (minRating !== undefined) {
      mentorsQuery.andWhere(MIN_RATING_CONDITION, { minRating });
    }
    if (hasFreeSeats === true) {
      mentorsQuery.andWhere(FREE_SEATS_CONDITION, {
        activeEnrolmentStatus: ENROLMENT_STATUS.ACTIVE,
      });
    }
    if (hasFreeTimeThisWeek === true) {
      mentorsQuery.andWhere(FREE_TIME_CONDITION, {
        freeTimeDays: FREE_TIME_DAYS,
        availabilityTimeZone: AVAILABILITY_TIME_ZONE,
      });
    }
    return mentorsQuery;
  }

  private addPriceFilter(
    mentorsQuery: SelectQueryBuilder<ObjectLiteral>,
    priceFilter: PriceFilter,
  ): void {
    const { minPriceBani, maxPriceBani } = priceFilter;
    const hasPriceFilter =
      minPriceBani !== undefined || maxPriceBani !== undefined;
    if (!hasPriceFilter) {
      return;
    }
    const priceRange = {
      minPriceBani: minPriceBani ?? MIN_PRICE_BANI,
      maxPriceBani: maxPriceBani ?? POSTGRES_INTEGER_MAX,
    };
    mentorsQuery.andWhere(PRICE_RANGE_CONDITION, priceRange);
  }

  private async countSearchableMentors(
    filters: MentorSearchFilters,
  ): Promise<number> {
    const searchableMentorsQuery = this.createSearchableMentorsQuery();
    const countRow = await this.addSearchFilters(
      searchableMentorsQuery,
      filters,
    )
      .select('COUNT(*)', 'total')
      .getRawOne<MentorCountRow>();
    const total = Number(countRow?.total ?? 0);
    return total;
  }

  private async findSearchableMentorRows(
    page: number,
    pageSize: number,
    filters: MentorSearchFilters,
  ): Promise<MentorSearchRow[]> {
    const skippedMentors = (page - 1) * pageSize;
    const mentorCardsQuery = this.createMentorCardsQuery();
    const mentorRows = await this.addSearchFilters(mentorCardsQuery, filters)
      .offset(skippedMentors)
      .limit(pageSize)
      .getRawMany<MentorSearchRow>();
    return mentorRows;
  }

  private async findRecommendedMentorRows(
    menteeDomainId: string,
  ): Promise<MentorSearchRow[]> {
    const mentorRows = await this.createMentorCardsQuery()
      .andWhere('profile.domain_id = :menteeDomainId', { menteeDomainId })
      .limit(RECOMMENDED_MENTORS_LIMIT)
      .getRawMany<MentorSearchRow>();
    return mentorRows;
  }

  private createMentorCardsQuery(): SelectQueryBuilder<ObjectLiteral> {
    const mentorCardsQuery = this.createSearchableMentorsQuery()
      .leftJoin('domains', 'domain', 'domain.id = profile.domain_id')
      .leftJoin(
        'mentor_rating_stats',
        'rating_stats',
        'rating_stats.mentor_id = profile.user_id',
      )
      .leftJoin('sponsors', 'sponsor', 'sponsor.id = profile.sponsor_id')
      .leftJoin('files', 'avatar', 'avatar.id = account.avatar_file_id')
      .select('profile.user_id', 'mentorId')
      .addSelect('account.first_name', 'firstName')
      .addSelect('account.last_name', 'lastName')
      .addSelect('avatar.storage_key', 'avatarStorageKey')
      .addSelect('domain.name', 'domainName')
      .addSelect('mentorship.per_session_price_bani', 'perSessionPriceBani')
      .addSelect('mentorship.monthly_price_bani', 'monthlyPriceBani')
      .addSelect('rating_stats.avg_overall', 'avgOverall')
      .addSelect('rating_stats.review_count', 'statsReviewCount')
      .addSelect('mentorship.has_test', 'hasTest')
      .addSelect('sponsor.name', 'sponsorName')
      .orderBy('rating_stats.avg_overall', 'DESC', 'NULLS LAST')
      .addOrderBy('mentorship.published_at', 'DESC')
      .addOrderBy('profile.user_id', 'ASC');
    return mentorCardsQuery;
  }

  private async toMentorSearchItems(
    mentorRows: MentorSearchRow[],
  ): Promise<MentorSearchItemDto[]> {
    const mentorSearchItems = await Promise.all(
      mentorRows.map((mentorRow) => this.toMentorSearchItem(mentorRow)),
    );
    return mentorSearchItems;
  }

  private async toMentorSearchItem(
    mentorRow: MentorSearchRow,
  ): Promise<MentorSearchItemDto> {
    const {
      mentorId,
      firstName,
      lastName,
      avatarStorageKey,
      domainName,
      perSessionPriceBani,
      monthlyPriceBani,
      avgOverall,
      statsReviewCount,
      hasTest,
      sponsorName,
    } = mentorRow;
    const photoUrl = await this.createPhotoUrl(avatarStorageKey);
    const rating = avgOverall === null ? null : Number(avgOverall);
    const reviewCount = statsReviewCount ?? 0;
    return {
      mentorId,
      firstName,
      lastName,
      photoUrl,
      domainName,
      perSessionPriceBani,
      monthlyPriceBani,
      rating,
      reviewCount,
      hasTest,
      sponsorName,
    };
  }

  private async createPhotoUrl(
    avatarStorageKey: string | null,
  ): Promise<string | null> {
    if (avatarStorageKey === null) {
      return null;
    }
    const photoUrl =
      await this.filesService.createDownloadUrl(avatarStorageKey);
    return photoUrl;
  }
}
