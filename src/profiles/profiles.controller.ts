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
  MentorApplicationDto,
  MentorCapacityDto,
  MentorProfileDto,
  MentorProfilePhotoDto,
  type MentorApplicationResponseDto,
  type MentorProfileResponseDto,
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

  @Get()
  async getMentorProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MentorProfileResponseDto> {
    const mentorProfile = await this.profilesService.getMentorProfile(
      currentUser.id,
    );
    return mentorProfile;
  }

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  async saveMentorProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() mentorProfile: MentorProfileDto,
  ): Promise<void> {
    await this.profilesService.saveMentorProfile(currentUser.id, mentorProfile);
  }

  @Put('photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setMentorPhoto(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() photo: MentorProfilePhotoDto,
  ): Promise<void> {
    await this.profilesService.setMentorPhoto(currentUser.id, photo.fileId);
  }

  @Put('capacity')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setMentorCapacity(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() mentorCapacity: MentorCapacityDto,
  ): Promise<void> {
    await this.profilesService.setMentorCapacity(
      currentUser.id,
      mentorCapacity,
    );
  }
}
