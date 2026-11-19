import { Controller, Get } from '@nestjs/common';
import { DomainsService } from './domains.service.js';
import type { DomainResponseDto } from './dto/index.js';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  async findActive(): Promise<DomainResponseDto[]> {
    const activeDomains = await this.domainsService.findActive();
    return activeDomains;
  }
}
