import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { PlatformTestimonial } from './entities/index.js';
import { TestimonialsService } from './testimonials.service.js';

const completeTestimonialResponse = {
  id: '6f2c8a1e-4b7d-4e9a-9c3f-1a5d7e2b8c40',
  authorName: 'Andreea Popescu',
  authorRole: 'Mentee, Product Design',
  quote: 'My mentor helped me land my first design internship in three months.',
  rating: 5,
};

const testimonialResponseWithoutRoleOrRating = {
  id: '9b4e1d7a-2c6f-4a8b-b5e3-7d0c9f1a6e52',
  authorName: 'Mihai Ionescu',
  authorRole: null,
  quote: 'Clear sessions, honest feedback and a plan I could follow.',
  rating: null,
};

describe('TestimonialsService', () => {
  const testimonialsRepository = {
    find: vi.fn<Repository<PlatformTestimonial>['find']>(),
  };
  let testimonialsService: TestimonialsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const testingModule = await Test.createTestingModule({
      providers: [
        TestimonialsService,
        {
          provide: getRepositoryToken(PlatformTestimonial),
          useValue: testimonialsRepository,
        },
      ],
    }).compile();

    testimonialsService = testingModule.get(TestimonialsService);
  });

  it('returns only the id, author name, role, quote and rating of the published testimonials, ordered by position then author name, with null for a missing role or rating', async () => {
    testimonialsRepository.find.mockResolvedValueOnce([
      Object.assign(new PlatformTestimonial(), {
        ...completeTestimonialResponse,
        position: 1,
        isPublished: true,
      }),
      Object.assign(new PlatformTestimonial(), {
        ...testimonialResponseWithoutRoleOrRating,
        position: 2,
        isPublished: true,
      }),
    ]);

    const publishedTestimonials = await testimonialsService.findPublished();

    expect(publishedTestimonials).toStrictEqual([
      completeTestimonialResponse,
      testimonialResponseWithoutRoleOrRating,
    ]);
    expect(testimonialsRepository.find).toHaveBeenCalledExactlyOnceWith({
      where: { isPublished: true },
      order: { position: 'ASC', authorName: 'ASC' },
    });
  });
});
