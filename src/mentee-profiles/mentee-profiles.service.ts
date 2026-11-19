import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainsService } from '../domains/index.js';
import { MenteeProfile } from '../users/index.js';
import type { MatchingFormDto, MatchingFormResponseDto } from './dto/index.js';

const MENTEE_PROFILE_NOT_FOUND_MESSAGE = 'Mentee profile not found.';
const INACTIVE_DOMAIN_MESSAGE = 'domainId must be one of the active domains.';

@Injectable()
export class MenteeProfilesService {
  constructor(
    @InjectRepository(MenteeProfile)
    private readonly menteeProfilesRepository: Repository<MenteeProfile>,
    private readonly domainsService: DomainsService,
  ) {}

  async getMatchingForm(userId: string): Promise<MatchingFormResponseDto> {
    const menteeProfile = await this.menteeProfilesRepository.findOneBy({
      userId,
    });
    if (menteeProfile === null) {
      throw new NotFoundException(MENTEE_PROFILE_NOT_FOUND_MESSAGE);
    }
    const { domainId, needs, studies, careerGoals } = menteeProfile;
    return { domainId, needs, studies, careerGoals };
  }

  async saveMatchingForm(
    userId: string,
    matchingForm: MatchingFormDto,
  ): Promise<void> {
    const { domainId, needs, studies, careerGoals } = matchingForm;
    const isActiveDomain = await this.domainsService.isActiveDomain(domainId);
    if (!isActiveDomain) {
      throw new BadRequestException(INACTIVE_DOMAIN_MESSAGE);
    }
    const updateResult = await this.menteeProfilesRepository.update(
      { userId },
      { domainId, needs, studies, careerGoals },
    );
    const isProfileMissing = updateResult.affected === 0;
    if (isProfileMissing) {
      throw new NotFoundException(MENTEE_PROFILE_NOT_FOUND_MESSAGE);
    }
  }
}
