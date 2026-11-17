import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FaqItemResponseDto } from './dto/index.js';
import { FaqItem } from './entities/index.js';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(FaqItem)
    private readonly faqItemsRepository: Repository<FaqItem>,
  ) {}

  async findPublished(): Promise<FaqItemResponseDto[]> {
    const publishedItems = await this.faqItemsRepository.find({
      where: { isPublished: true },
      order: { category: 'ASC', position: 'ASC' },
    });
    const faqItemResponses = publishedItems.map(
      ({ id, category, question, answer }) => ({
        id,
        category,
        question,
        answer,
      }),
    );
    return faqItemResponses;
  }
}
