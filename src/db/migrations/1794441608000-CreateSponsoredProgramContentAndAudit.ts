import { MigrationInterface, QueryRunner } from 'typeorm';

const updatedAtTrigger = (table: string) => `
  CREATE TRIGGER trg_${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at()
`;

/**
 * sponsored_program_applications, faq_items, platform_testimonials, admin_audit_log.
 */
export class CreateSponsoredProgramContentAndAudit1794441608000 implements MigrationInterface {
  name = 'CreateSponsoredProgramContentAndAudit1794441608000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------ sponsored_program_applications
    await queryRunner.query(`
      CREATE TABLE sponsored_program_applications (
        id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentee_id      uuid        NOT NULL REFERENCES mentee_profiles (user_id) ON DELETE CASCADE,
        answers        jsonb       NOT NULL DEFAULT '{}'::jsonb,
        status         text        NOT NULL DEFAULT 'IN_REVIEW',
        decided_at     timestamptz NULL,
        decision_note  text        NULL,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_sponsored_program_applications_status
          CHECK (status IN ('IN_REVIEW', 'SELECTED', 'NOT_SELECTED')),
        CONSTRAINT ck_sponsored_program_applications_decided
          CHECK ((status = 'IN_REVIEW') = (decided_at IS NULL)),
        CONSTRAINT ck_sponsored_program_applications_answers CHECK (jsonb_typeof(answers) = 'object')
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_sponsored_program_applications_one_open
        ON sponsored_program_applications (mentee_id) WHERE status = 'IN_REVIEW'
    `);
    await queryRunner.query(`CREATE INDEX ix_sponsored_program_applications_status ON sponsored_program_applications (status, created_at)`);
    await queryRunner.query(updatedAtTrigger('sponsored_program_applications'));
    await queryRunner.query(`COMMENT ON TABLE sponsored_program_applications IS 'Applications to the free sponsored program; admin selects manually. A mentee with a SELECTED row is a beneficiary.'`);

    // -------------------------------------------------------------- faq_items
    await queryRunner.query(`
      CREATE TABLE faq_items (
        id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        category      text        NOT NULL,
        question      text        NOT NULL,
        answer        text        NOT NULL,
        position      smallint    NOT NULL DEFAULT 0,
        is_published  boolean     NOT NULL DEFAULT true,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_faq_items_category
          CHECK (category IN ('PLATFORM', 'MENTORSHIP_PROCESS', 'BECOME_MENTOR', 'PAYMENTS'))
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_faq_items_category_position ON faq_items (category, position)`);
    await queryRunner.query(updatedAtTrigger('faq_items'));
    await queryRunner.query(`COMMENT ON TABLE faq_items IS 'Public FAQ, editable without a deploy. Answers are markdown.'`);

    // -------------------------------------------------- platform_testimonials
    await queryRunner.query(`
      CREATE TABLE platform_testimonials (
        id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        author_name    text        NOT NULL,
        author_role    text        NULL,
        photo_file_id  uuid        NULL REFERENCES files (id) ON DELETE SET NULL,
        quote          text        NOT NULL,
        rating         smallint    NULL,
        position       smallint    NOT NULL DEFAULT 0,
        is_published   boolean     NOT NULL DEFAULT true,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_platform_testimonials_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
      )
    `);
    await queryRunner.query(updatedAtTrigger('platform_testimonials'));
    await queryRunner.query(`COMMENT ON TABLE platform_testimonials IS 'Landing-page testimonials about Mentorly, curated by the team.'`);

    // -------------------------------------------------------- admin_audit_log
    await queryRunner.query(`
      CREATE TABLE admin_audit_log (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        actor        text        NOT NULL,
        action       text        NOT NULL,
        entity_type  text        NOT NULL,
        entity_id    text        NOT NULL,
        before       jsonb       NULL,
        after        jsonb       NULL,
        note         text        NULL,
        created_at   timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_admin_audit_log_entity ON admin_audit_log (entity_type, entity_id)`);
    await queryRunner.query(`CREATE INDEX ix_admin_audit_log_created ON admin_audit_log (created_at DESC)`);
    await queryRunner.query(`COMMENT ON TABLE admin_audit_log IS 'Append-only log of manual admin operations (no admin UI in MVP). actor = admin email/name.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_audit_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS platform_testimonials`);
    await queryRunner.query(`DROP TABLE IF EXISTS faq_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS sponsored_program_applications`);
  }
}
