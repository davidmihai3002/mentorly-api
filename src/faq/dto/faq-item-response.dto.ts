import type { FaqCategory } from '../entities/index.js';

export interface FaqItemResponseDto {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
}
