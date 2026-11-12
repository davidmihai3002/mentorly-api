import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { typeOrmOptions } from './db/typeorm.config.js';

@Module({
  imports: [TypeOrmModule.forRootAsync({ useFactory: () => typeOrmOptions })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
