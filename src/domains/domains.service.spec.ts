import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DomainsService } from './domains.service.js';
import { Domain } from './entities/index.js';

const DOMAIN_ID = '5a8c2e1f-4b7d-4e9a-8c3f-6d1e2b4a7c90';

const domainResponse = { id: DOMAIN_ID, slug: 'marketing', name: 'Marketing' };

describe('DomainsService', () => {
  const domainsRepository = {
    find: vi.fn<Repository<Domain>['find']>(),
    existsBy: vi.fn<Repository<Domain>['existsBy']>(),
  };
  let domainsService: DomainsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const testingModule = await Test.createTestingModule({
      providers: [
        DomainsService,
        { provide: getRepositoryToken(Domain), useValue: domainsRepository },
      ],
    }).compile();

    domainsService = testingModule.get(DomainsService);
  });

  it('returns only the id, slug and name of the active domains, ordered by position then name', async () => {
    const storedDomain = { ...domainResponse, position: 2, isActive: true };
    domainsRepository.find.mockResolvedValueOnce([
      Object.assign(new Domain(), storedDomain),
    ]);

    const activeDomains = await domainsService.findActive();

    expect(activeDomains).toStrictEqual([domainResponse]);
    expect(domainsRepository.find).toHaveBeenCalledExactlyOnceWith({
      where: { isActive: true },
      order: { position: 'ASC', name: 'ASC' },
    });
  });

  it('confirms a domain that exists and is active', async () => {
    domainsRepository.existsBy.mockResolvedValueOnce(true);

    await expect(domainsService.isActiveDomain(DOMAIN_ID)).resolves.toBe(true);
    expect(domainsRepository.existsBy).toHaveBeenCalledExactlyOnceWith({
      id: DOMAIN_ID,
      isActive: true,
    });
  });

  it('rejects a domain that is inactive or unknown', async () => {
    domainsRepository.existsBy.mockResolvedValueOnce(false);

    await expect(domainsService.isActiveDomain(DOMAIN_ID)).resolves.toBe(false);
  });
});
