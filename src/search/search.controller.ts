import { Controller, Get, Query } from '@nestjs/common';
import {
  MentorSearchQueryDto,
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
}
