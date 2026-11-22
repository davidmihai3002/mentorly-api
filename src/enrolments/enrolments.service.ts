import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ENROLMENT_STATUS, Enrolment } from './entities/index.js';

@Injectable()
export class EnrolmentsService {
  constructor(
    @InjectRepository(Enrolment)
    private readonly enrolmentsRepository: Repository<Enrolment>,
  ) {}

  async countActiveByMentor(mentorId: string): Promise<number> {
    const activeEnrolmentsCount = await this.enrolmentsRepository
      .createQueryBuilder('enrolment')
      .innerJoin(
        'mentorships',
        'mentorship',
        'mentorship.id = enrolment.mentorship_id',
      )
      .where('enrolment.status = :status', {
        status: ENROLMENT_STATUS.ACTIVE,
      })
      .andWhere('mentorship.mentor_id = :mentorId', { mentorId })
      .getCount();
    return activeEnrolmentsCount;
  }
}
