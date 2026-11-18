import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { FAQ_CATEGORY, FaqItem } from './entities/index.js';
import { FaqService } from './faq.service.js';

const faqItemResponse = {
  id: '3d9a1f2c-7b4e-4c6a-8f1d-2e5b9c0a7d34',
  category: FAQ_CATEGORY.BECOME_MENTOR,
  question: 'How do I become a mentor?',
  answer: 'Create a **mentor** account and complete your profile.',
};

describe('FaqService', () => {
  const faqItemsRepository = { find: vi.fn<Repository<FaqItem>['find']>() };
  let faqService: FaqService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const testingModule = await Test.createTestingModule({
      providers: [
        FaqService,
        { provide: getRepositoryToken(FaqItem), useValue: faqItemsRepository },
      ],
    }).compile();

    faqService = testingModule.get(FaqService);
  });

  it('returns only the id, category, question and answer of the published items, ordered by category then position', async () => {
    const storedItem = { ...faqItemResponse, position: 1, isPublished: true };
    faqItemsRepository.find.mockResolvedValueOnce([
      Object.assign(new FaqItem(), storedItem),
    ]);

    const publishedFaq = await faqService.findPublished();

    expect(publishedFaq).toStrictEqual([faqItemResponse]);
    expect(faqItemsRepository.find).toHaveBeenCalledExactlyOnceWith({
      where: { isPublished: true },
      order: { category: 'ASC', position: 'ASC' },
    });
  });
});
