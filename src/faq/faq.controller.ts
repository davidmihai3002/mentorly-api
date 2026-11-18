import { Controller, Get } from '@nestjs/common';
import type { FaqItemResponseDto } from './dto/index.js';
import { FaqService } from './faq.service.js';

@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  async findPublished(): Promise<FaqItemResponseDto[]> {
    const publishedFaq = await this.faqService.findPublished();
    return publishedFaq;
  }
}
