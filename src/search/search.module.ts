import { Module } from '@nestjs/common';
import { FilesModule } from '../files/index.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [FilesModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
