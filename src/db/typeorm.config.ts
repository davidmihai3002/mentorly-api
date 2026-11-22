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

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

export const typeOrmOptions: PostgresOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(import.meta.dirname, '..', '**', `*.entity.${ext}`)],
  migrationsTableName: 'typeorm_migrations',
  migrationsTransactionMode: 'each',
  synchronize: false,
  installExtensions: false,
  logging: ['error', 'migration'],
};

/**
 * Options for running migrations (TypeORM CLI + run-migrations script).
 * Uses MIGRATIONS_URL (Neon direct, non-pooled host) when set: TypeORM migrations
 * can misbehave through the PgBouncer pooler that DATABASE_URL points at.
 */
export const migrationOptions: PostgresOptions = {
  ...typeOrmOptions,
  url: process.env.MIGRATIONS_URL ?? process.env.DATABASE_URL,
};
