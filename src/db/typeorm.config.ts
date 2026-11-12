import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

if (existsSync('.env')) process.loadEnvFile('.env');

const ext = import.meta.filename.endsWith('.ts') ? 'ts' : 'js';

export const migrationsGlob = join(
  import.meta.dirname,
  'migrations',
  `*.${ext}`,
);

export const typeOrmOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(import.meta.dirname, '..', '**', `*.entity.${ext}`)],
  migrationsTableName: 'typeorm_migrations',
  migrationsTransactionMode: 'each',
  synchronize: false,
  logging: ['error', 'migration'],
};
