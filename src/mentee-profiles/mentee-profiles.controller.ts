import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { MatchingFormDto, type MatchingFormResponseDto } from './dto/index.js';
import { MenteeProfilesService } from './mentee-profiles.service.js';

@Controller('mentee-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([USER_ROLE.MENTEE])
export class MenteeProfilesController {
  constructor(private readonly menteeProfilesService: MenteeProfilesService) {}

  @Get('matching-form')
  async getMatchingForm(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MatchingFormResponseDto> {
    const matchingForm = await this.menteeProfilesService.getMatchingForm(
      currentUser.id,
    );
    return matchingForm;
  }

  @Put('matching-form')
  @HttpCode(HttpStatus.NO_CONTENT)
  async saveMatchingForm(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() matchingForm: MatchingFormDto,
  ): Promise<void> {
    await this.menteeProfilesService.saveMatchingForm(
      currentUser.id,
      matchingForm,
    );
  }
}
