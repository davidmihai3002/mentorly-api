import { Controller, Get } from '@nestjs/common';
import type { PlatformTestimonialResponseDto } from './dto/index.js';
import { TestimonialsService } from './testimonials.service.js';

@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  async findPublished(): Promise<PlatformTestimonialResponseDto[]> {
    const publishedTestimonials =
      await this.testimonialsService.findPublished();
    return publishedTestimonials;
  }
}
