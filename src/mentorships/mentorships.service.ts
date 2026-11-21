import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  MentorshipDetailsDto,
  MentorshipResponseDto,
} from './dto/index.js';
import { AvailabilitySlot, Mentorship } from './entities/index.js';

const MENTORSHIP_NOT_FOUND_MESSAGE = 'Mentorship not found.';
const MENTORSHIP_NOT_PUBLISHABLE_MESSAGE =
  'To publish, add a description, at least one price or a sponsorship, and at least one availability slot.';

@Injectable()
export class MentorshipsService {
  constructor(
    @InjectRepository(Mentorship)
    private readonly mentorshipsRepository: Repository<Mentorship>,
    @InjectRepository(AvailabilitySlot)
    private readonly availabilitySlotsRepository: Repository<AvailabilitySlot>,
  ) {}

  async getMentorship(mentorId: string): Promise<MentorshipResponseDto> {
    const mentorship = await this.findMentorship(mentorId);
    const { description, conditions, minKnowledge, publishedAt } = mentorship;
    return { description, conditions, minKnowledge, publishedAt };
  }

  async saveMentorshipDetails(
    mentorId: string,
    mentorshipDetails: MentorshipDetailsDto,
  ): Promise<void> {
    const {
      description = null,
      conditions = null,
      minKnowledge = null,
    } = mentorshipDetails;
    await this.mentorshipsRepository.upsert(
      { mentorId, description, conditions, minKnowledge },
      { conflictPaths: ['mentorId'] },
    );
  }

  async publishMentorship(mentorId: string): Promise<void> {
    const [mentorship, hasAvailabilitySlot] = await Promise.all([
      this.findMentorship(mentorId),
      this.availabilitySlotsRepository.existsBy({ mentorId }),
    ]);
    const hasDescription = mentorship.description !== null;
    const hasPrice =
      mentorship.perSessionPriceBani !== null ||
      mentorship.monthlyPriceBani !== null;
    const hasPriceOrSponsorship = hasPrice || mentorship.isSponsored;
    const isPublishable =
      hasDescription && hasPriceOrSponsorship && hasAvailabilitySlot;
    if (!isPublishable) {
      throw new BadRequestException(MENTORSHIP_NOT_PUBLISHABLE_MESSAGE);
    }
    const publishedAt = new Date();
    await this.mentorshipsRepository.update({ mentorId }, { publishedAt });
  }

  async unpublishMentorship(mentorId: string): Promise<void> {
    const updateResult = await this.mentorshipsRepository.update(
      { mentorId },
      { publishedAt: null },
    );
    const isMentorshipMissing = updateResult.affected === 0;
    if (isMentorshipMissing) {
      throw new NotFoundException(MENTORSHIP_NOT_FOUND_MESSAGE);
    }
  }

  private async findMentorship(mentorId: string): Promise<Mentorship> {
    const mentorship = await this.mentorshipsRepository.findOneBy({
      mentorId,
    });
    if (mentorship === null) {
      throw new NotFoundException(MENTORSHIP_NOT_FOUND_MESSAGE);
    }
    return mentorship;
  }
}
