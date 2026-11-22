import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  type AuthenticatedUser,
} from '../auth/index.js';
import { USER_ROLE } from '../users/index.js';
import {
  MentorshipDetailsDto,
  type MentorshipResponseDto,
} from './dto/index.js';
import { MentorshipsService } from './mentorships.service.js';

@Controller('mentorship')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([USER_ROLE.MENTOR])
export class MentorshipsController {
  constructor(private readonly mentorshipsService: MentorshipsService) {}

  @Get()
  async getMentorship(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MentorshipResponseDto> {
    const mentorship = await this.mentorshipsService.getMentorship(
      currentUser.id,
    );
    return mentorship;
  }

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  async saveMentorshipDetails(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() mentorshipDetails: MentorshipDetailsDto,
  ): Promise<void> {
    await this.mentorshipsService.saveMentorshipDetails(
      currentUser.id,
      mentorshipDetails,
    );
  }

  @Post('publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  async publishMentorship(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.mentorshipsService.publishMentorship(currentUser.id);
  }

  @Post('unpublish')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unpublishMentorship(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.mentorshipsService.unpublishMentorship(currentUser.id);
  }
}
