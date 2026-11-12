import { DataSource } from 'typeorm';
import { migrationsGlob, typeOrmOptions } from './typeorm.config.js';

/**
 * DataSource used by the TypeORM CLI (migration:run / migration:revert / migration:show).
 * The NestJS app uses the same options in TypeOrmModule.forRootAsync (see typeorm.config.ts);
 * only the CLI loads the migrations.
 *
 * Schema changes are made ONLY through migrations: synchronize must stay false.
 */
export default new DataSource({ ...typeOrmOptions, migrations: [migrationsGlob] });
