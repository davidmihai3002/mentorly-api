import { Injectable } from '@nestjs/common';
import {
  DataSource,
  type ObjectLiteral,
  type SelectQueryBuilder,
} from 'typeorm';
import { FilesService } from '../files/index.js';
import { MENTOR_PROFILE_STATUS } from '../profiles/index.js';
import type {
  MentorSearchItemDto,
  MentorSearchQueryDto,
  MentorSearchResponseDto,
} from './dto/index.js';

interface MentorCountRow {
  total: string;
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
    const { page, pageSize } = query;
    const [total, mentorRows] = await Promise.all([
      this.countSearchableMentors(),
      this.findSearchableMentorRows(page, pageSize),
    ]);
    const items = await Promise.all(
      mentorRows.map((mentorRow) => this.toMentorSearchItem(mentorRow)),
    );
    return { items, page, pageSize, total };
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

  private async countSearchableMentors(): Promise<number> {
    const countRow = await this.createSearchableMentorsQuery()
      .select('COUNT(*)', 'total')
      .getRawOne<MentorCountRow>();
    const total = Number(countRow?.total ?? 0);
    return total;
  }

  private async findSearchableMentorRows(
    page: number,
    pageSize: number,
  ): Promise<MentorSearchRow[]> {
    const skippedMentors = (page - 1) * pageSize;
    const mentorRows = await this.createSearchableMentorsQuery()
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
      .addOrderBy('profile.user_id', 'ASC')
      .offset(skippedMentors)
      .limit(pageSize)
      .getRawMany<MentorSearchRow>();
    return mentorRows;
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
