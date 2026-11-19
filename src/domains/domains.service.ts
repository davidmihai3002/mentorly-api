import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { DomainResponseDto } from './dto/index.js';
import { Domain } from './entities/index.js';

@Injectable()
export class DomainsService {
  constructor(
    @InjectRepository(Domain)
    private readonly domainsRepository: Repository<Domain>,
  ) {}

  async findActive(): Promise<DomainResponseDto[]> {
    const activeDomains = await this.domainsRepository.find({
      where: { isActive: true },
      order: { position: 'ASC', name: 'ASC' },
    });
    const domainResponses = activeDomains.map(({ id, name }) => ({ id, name }));
    return domainResponses;
  }

  async isActiveDomain(domainId: string): Promise<boolean> {
    const isActive = await this.domainsRepository.existsBy({
      id: domainId,
      isActive: true,
    });
    return isActive;
  }
}
