import { DataSource } from 'typeorm';
import { migrationOptions, migrationsGlob } from './typeorm.config.js';

/**
 * DataSource used by the TypeORM CLI (migration:run / migration:revert / migration:show).
 * The NestJS app uses typeOrmOptions in TypeOrmModule.forRootAsync (see typeorm.config.ts);
 * the CLI uses migrationOptions (direct, non-pooled URL) and is the only one that loads migrations.
 *
 * Schema changes are made ONLY through migrations: synchronize must stay false.
 */
export default new DataSource({ ...migrationOptions, migrations: [migrationsGlob] });
