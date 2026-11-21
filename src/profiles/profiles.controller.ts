import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  type AuthenticatedUser,
} from '../auth/index.js';
import { USER_ROLE } from '../users/index.js';
import {
  MentorApplicationDto,
  type MentorApplicationResponseDto,
} from './dto/index.js';
import { ProfilesService } from './profiles.service.js';

@Controller('mentor-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([USER_ROLE.MENTOR])
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post('application')
  async submitMentorApplication(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() application: MentorApplicationDto,
  ): Promise<MentorApplicationResponseDto> {
    const submittedApplication =
      await this.profilesService.submitMentorApplication(
        currentUser.id,
        application,
      );
    return submittedApplication;
  }
}
