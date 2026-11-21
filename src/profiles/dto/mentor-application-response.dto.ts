import type { MentorProfileStatus } from '../entities/index.js';

export interface MentorApplicationResponseDto {
  status: MentorProfileStatus;
  submittedAt: Date;
}
