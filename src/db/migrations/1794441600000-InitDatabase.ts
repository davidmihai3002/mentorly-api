import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extensions + shared helpers used by every later migration.
 *
 * - gen_random_uuid() is built into PostgreSQL 13+, no extension needed.
 * - btree_gist lets EXCLUDE constraints mix "=" on uuid with "&&" on time ranges
 *   (used by `sessions` to make double-booking impossible).
 * - set_updated_at() keeps `updated_at` correct no matter who writes the row
 *   (NestJS, admin scripts, psql).
 */
export class InitDatabase1794441600000 implements MigrationInterface {
  name = 'InitDatabase1794441600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END;
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at()`);
    // btree_gist is intentionally left installed: other schemas may rely on it.
  }
}
