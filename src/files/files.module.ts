import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/index.js';
import { StoredFile } from './entities/index.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';
import { storageProviders } from './storage.providers.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([StoredFile])],
  controllers: [FilesController],
  providers: [FilesService, ...storageProviders],
  exports: [FilesService],
})
export class FilesModule {}
