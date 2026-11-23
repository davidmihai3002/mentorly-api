import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  type AuthenticatedUser,
} from '../auth/index.js';
import { USER_ROLE } from '../users/index.js';
import {
  MentorSearchQueryDto,
  type MentorSearchItemDto,
  type MentorSearchResponseDto,
} from './dto/index.js';
import { SearchService } from './search.service.js';

@Controller('mentors')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async searchMentors(
    @Query() query: MentorSearchQueryDto,
  ): Promise<MentorSearchResponseDto> {
    const mentorsPage = await this.searchService.searchMentors(query);
    return mentorsPage;
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles([USER_ROLE.MENTEE])
  async findRecommendedMentors(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MentorSearchItemDto[]> {
    const recommendedMentors = await this.searchService.findRecommendedMentors(
      currentUser.id,
    );
    return recommendedMentors;
  }
}
