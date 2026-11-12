#!/usr/bin/env -S npx tsx
/**
 * Runs the TypeORM migrations one at a time, in timestamp order: each pending migration
 * gets its own DataSource, its own transaction and its own log line, and the script stops
 * at the first failure (earlier migrations stay applied).
 *
 * Uses the same options as the app and the CLI (typeorm.config.ts, DATABASE_URL from .env).
 *
 *   npm run migration:run:each                         run every pending migration, one by one
 *   npm run migration:run:each -- --list               show applied / pending, run nothing
 *   npm run migration:run:each -- --only CreateSessions   run a single migration (name or timestamp)
 *
 * Or directly: ./src/db/scripts/run-migrations.ts [--list] [--only <name|timestamp>]
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DataSource, type MigrationInterface } from 'typeorm';
import { typeOrmOptions } from '../typeorm.config.js';

type MigrationClass = new () => MigrationInterface;
interface MigrationFile {
  file: string;
  name: string; // class name incl. timestamp, as stored in typeorm_migrations
  cls: MigrationClass;
}

const ext = import.meta.filename.endsWith('.ts') ? '.ts' : '.js';
const migrationsDir = join(import.meta.dirname, '..', 'migrations');
const table = typeOrmOptions.migrationsTableName ?? 'migrations';

function parseArgs(argv: string[]) {
  const args = { list: false, only: undefined as string | undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--only') args.only = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('Usage: run-migrations [--list] [--only <name|timestamp>]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  if (argv.includes('--only') && !args.only) throw new Error('--only needs a migration name or timestamp');
  return args;
}

async function loadMigrations(): Promise<MigrationFile[]> {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(ext) && !f.endsWith('.d.ts'))
    .sort(); // filenames start with the timestamp -> chronological order
  const result: MigrationFile[] = [];
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(migrationsDir, file)).href)) as Record<string, unknown>;
    const cls = Object.values(mod).find((v) => typeof v === 'function') as MigrationClass | undefined;
    if (!cls) throw new Error(`No migration class exported from ${file}`);
    result.push({ file, name: new cls().name ?? cls.name, cls });
  }
  return result;
}

async function appliedMigrations(): Promise<Set<string>> {
  const ds = new DataSource({ ...typeOrmOptions, logging: ['error'] });
  await ds.initialize();
  try {
    const [{ exists }] = (await ds.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [table])) as {
      exists: boolean;
    }[];
    if (!exists) return new Set();
    const rows = (await ds.query(`SELECT name FROM "${table}"`)) as { name: string }[];
    return new Set(rows.map((r) => r.name));
  } finally {
    await ds.destroy();
  }
}

async function runOne(m: MigrationFile): Promise<void> {
  // A DataSource that only knows this one migration: runMigrations() applies exactly it.
  const ds = new DataSource({ ...typeOrmOptions, migrations: [m.cls] });
  await ds.initialize();
  try {
    const ran = await ds.runMigrations({ transaction: 'each' });
    if (ran.length !== 1) throw new Error(`expected to run 1 migration, ran ${ran.length}`);
  } finally {
    await ds.destroy();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (put it in .env)');

  const all = await loadMigrations();
  const applied = await appliedMigrations();
  const pending = all.filter((m) => !applied.has(m.name));

  if (args.list) {
    for (const m of all) console.log(`${applied.has(m.name) ? '[X]' : '[ ]'} ${m.name}`);
    console.log(`\n${all.length - pending.length} applied, ${pending.length} pending`);
    return;
  }

  let toRun = pending;
  if (args.only) {
    const target = all.find((m) => m.name === args.only || m.file.startsWith(args.only!) || m.name.includes(args.only!));
    if (!target) throw new Error(`No migration matches "${args.only}"`);
    if (applied.has(target.name)) {
      console.log(`${target.name} is already applied - nothing to do.`);
      return;
    }
    const earlier = pending.filter((m) => m.file < target.file);
    if (earlier.length) {
      throw new Error(
        `Refusing to run ${target.name} out of order; pending before it:\n  ${earlier.map((m) => m.name).join('\n  ')}`,
      );
    }
    toRun = [target];
  }

  if (!toRun.length) {
    console.log('No pending migrations.');
    return;
  }

  console.log(`Running ${toRun.length} migration(s) individually (NODE_ENV=${process.env.NODE_ENV ?? 'unset'})\n`);
  for (const [i, m] of toRun.entries()) {
    const started = Date.now();
    process.stdout.write(`[${i + 1}/${toRun.length}] ${m.name} ... `);
    try {
      await runOne(m);
      console.log(`ok (${Date.now() - started} ms)`);
    } catch (err) {
      console.log('FAILED');
      console.error(err);
      console.error(`\nStopped. ${i} migration(s) applied in this run; ${m.name} was rolled back.`);
      process.exit(1);
    }
  }
  console.log('\nAll done.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
