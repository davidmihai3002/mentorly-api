import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/index.js';
import {
  DbConstraintExceptionFilter,
  createValidationPipe,
} from './common/index.js';
import { typeOrmOptions } from './db/typeorm.config.js';
import { DomainsModule } from './domains/index.js';
import { FaqModule } from './faq/index.js';
import { MenteeProfilesModule } from './mentee-profiles/index.js';
import { TestimonialsModule } from './testimonials/index.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...typeOrmOptions,
        entities: [],
        autoLoadEntities: true,
      }),
    }),
    AuthModule,
    FaqModule,
    DomainsModule,
    MenteeProfilesModule,
    TestimonialsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: DbConstraintExceptionFilter },
  ],
})
export class AppModule {}
