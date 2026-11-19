import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PlatformTestimonialResponseDto } from './dto/index.js';
import { PlatformTestimonial } from './entities/index.js';

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectRepository(PlatformTestimonial)
    private readonly testimonialsRepository: Repository<PlatformTestimonial>,
  ) {}

  async findPublished(): Promise<PlatformTestimonialResponseDto[]> {
    const publishedTestimonials = await this.testimonialsRepository.find({
      where: { isPublished: true },
      order: { position: 'ASC', authorName: 'ASC' },
    });
    const testimonialResponses = publishedTestimonials.map(
      ({ id, authorName, authorRole, quote, rating }) => ({
        id,
        authorName,
        authorRole,
        quote,
        rating,
      }),
    );
    return testimonialResponses;
  }
}
