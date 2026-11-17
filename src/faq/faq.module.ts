import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqItem } from './entities/index.js';
import { FaqController } from './faq.controller.js';
import { FaqService } from './faq.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([FaqItem])],
  controllers: [FaqController],
  providers: [FaqService],
})
export class FaqModule {}
