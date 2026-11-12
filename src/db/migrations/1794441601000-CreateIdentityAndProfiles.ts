import { MigrationInterface, QueryRunner } from 'typeorm';

const updatedAtTrigger = (table: string) => `
  CREATE TRIGGER trg_${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at()
`;

/**
 * Identity, profiles and reference data:
 * domains, files, users, user_auth_providers, sponsors,
 * mentor_profiles, mentee_profiles, mentor_credentials, mentor_social_links.
 */
export class CreateIdentityAndProfiles1794441601000 implements MigrationInterface {
  name = 'CreateIdentityAndProfiles1794441601000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------- domains
    await queryRunner.query(`
      CREATE TABLE domains (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        slug        text        NOT NULL,
        name        text        NOT NULL,
        position    smallint    NOT NULL DEFAULT 0,
        is_active   boolean     NOT NULL DEFAULT true,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_domains_slug UNIQUE (slug)
      )
    `);
    await queryRunner.query(updatedAtTrigger('domains'));
    await queryRunner.query(`COMMENT ON TABLE domains IS 'Predefined fields (Marketing, IT…) used by profiles, search filters and top-3 matching.'`);

    // ------------------------------------------------------------------ files
    // FK to users is added after users exists (circular: users.avatar_file_id -> files).
    await queryRunner.query(`
      CREATE TABLE files (
        id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        uploaded_by_user_id  uuid        NULL,
        storage_key          text        NOT NULL,
        original_name        text        NOT NULL,
        mime_type            text        NOT NULL,
        size_bytes           bigint      NOT NULL,
        visibility           text        NOT NULL DEFAULT 'PRIVATE',
        created_at           timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_files_storage_key UNIQUE (storage_key),
        CONSTRAINT ck_files_size_bytes  CHECK (size_bytes > 0),
        CONSTRAINT ck_files_visibility  CHECK (visibility IN ('PUBLIC', 'PRIVATE'))
      )
    `);
    await queryRunner.query(`COMMENT ON TABLE files IS 'Upload metadata (object storage key). Immutable. Reused by CVs, certificates, avatars, study materials, deliverables, logos.'`);

    // ------------------------------------------------------------------ users
    await queryRunner.query(`
      CREATE TABLE users (
        id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        email              text        NOT NULL,
        password_hash      text        NULL,
        role               text        NOT NULL,
        first_name         text        NOT NULL,
        last_name          text        NOT NULL,
        birth_date         date        NOT NULL,
        avatar_file_id     uuid        NULL REFERENCES files (id) ON DELETE SET NULL,
        terms_accepted_at  timestamptz NOT NULL,
        email_verified_at  timestamptz NULL,
        token_version      integer     NOT NULL DEFAULT 0,
        last_login_at      timestamptz NULL,
        deleted_at         timestamptz NULL,
        created_at         timestamptz NOT NULL DEFAULT now(),
        updated_at         timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_users_role          CHECK (role IN ('MENTOR', 'MENTEE')),
        CONSTRAINT ck_users_token_version CHECK (token_version >= 0)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email))`);
    await queryRunner.query(updatedAtTrigger('users'));
    await queryRunner.query(`COMMENT ON TABLE users IS 'One account per person. role is fixed at sign-up (separate mentor / mentee accounts). Age >= 16 is validated in the app.'`);
    await queryRunner.query(`COMMENT ON COLUMN users.password_hash IS 'NULL for Google-only accounts.'`);
    await queryRunner.query(`COMMENT ON COLUMN users.token_version IS 'Embedded in JWTs and reset/confirm links; bump to invalidate them (logout, password change).'`);
    await queryRunner.query(`COMMENT ON COLUMN users.deleted_at IS 'GDPR deletion: personal data is anonymised, then this is set.'`);

    await queryRunner.query(`
      ALTER TABLE files
        ADD CONSTRAINT fk_files_uploaded_by_user
        FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id) ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX ix_files_uploaded_by_user_id ON files (uploaded_by_user_id)`);

    // ---------------------------------------------------- user_auth_providers
    await queryRunner.query(`
      CREATE TABLE user_auth_providers (
        id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        provider          text        NOT NULL,
        provider_user_id  text        NOT NULL,
        provider_email    text        NULL,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_user_auth_providers_provider CHECK (provider IN ('GOOGLE')),
        CONSTRAINT uq_user_auth_providers_provider_user UNIQUE (provider, provider_user_id),
        CONSTRAINT uq_user_auth_providers_user_provider UNIQUE (user_id, provider)
      )
    `);
    await queryRunner.query(updatedAtTrigger('user_auth_providers'));
    await queryRunner.query(`COMMENT ON TABLE user_auth_providers IS 'External logins linked to a user (Google).'`);

    // --------------------------------------------------------------- sponsors
    await queryRunner.query(`
      CREATE TABLE sponsors (
        id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        name          text        NOT NULL,
        slug          text        NOT NULL,
        logo_file_id  uuid        NULL REFERENCES files (id) ON DELETE SET NULL,
        description   text        NULL,
        website_url   text        NULL,
        position      smallint    NOT NULL DEFAULT 0,
        is_active     boolean     NOT NULL DEFAULT true,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_sponsors_slug UNIQUE (slug)
      )
    `);
    await queryRunner.query(updatedAtTrigger('sponsors'));
    await queryRunner.query(`COMMENT ON TABLE sponsors IS 'Partner companies that provide employees as free mentors. Managed by admin.'`);

    // -------------------------------------------------------- mentor_profiles
    await queryRunner.query(`
      CREATE TABLE mentor_profiles (
        user_id                uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        status                 text        NOT NULL DEFAULT 'PENDING',
        status_reason          text        NULL,
        status_changed_at      timestamptz NULL,
        submitted_at           timestamptz NULL,
        domain_id              uuid        NULL REFERENCES domains (id),
        bio                    text        NULL,
        linkedin_url           text        NOT NULL,
        motivation             text        NOT NULL,
        highlights             jsonb       NOT NULL DEFAULT '{}'::jsonb,
        capacity               smallint    NULL,
        sponsor_id             uuid        NULL REFERENCES sponsors (id) ON DELETE SET NULL,
        stripe_account_id      text        NULL,
        stripe_account_status  text        NOT NULL DEFAULT 'NOT_CONNECTED',
        created_at             timestamptz NOT NULL DEFAULT now(),
        updated_at             timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_mentor_profiles_status   CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        CONSTRAINT ck_mentor_profiles_rejected_reason
          CHECK (status <> 'REJECTED' OR status_reason IS NOT NULL),
        CONSTRAINT ck_mentor_profiles_capacity CHECK (capacity IS NULL OR capacity > 0),
        CONSTRAINT ck_mentor_profiles_highlights_object CHECK (jsonb_typeof(highlights) = 'object'),
        CONSTRAINT ck_mentor_profiles_stripe_status
          CHECK (stripe_account_status IN ('NOT_CONNECTED', 'PENDING', 'ACTIVE', 'RESTRICTED')),
        CONSTRAINT uq_mentor_profiles_stripe_account_id UNIQUE (stripe_account_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_mentor_profiles_status_domain ON mentor_profiles (status, domain_id)`);
    await queryRunner.query(`CREATE INDEX ix_mentor_profiles_sponsor_id ON mentor_profiles (sponsor_id)`);
    await queryRunner.query(updatedAtTrigger('mentor_profiles'));
    await queryRunner.query(`COMMENT ON TABLE mentor_profiles IS '1:1 with users (role MENTOR). Verification status, public profile, Stripe Connect account.'`);
    await queryRunner.query(`COMMENT ON COLUMN mentor_profiles.highlights IS '{"workplaces": [...], "achievements": [...], "certifications": [...]} – validated by DTOs.'`);
    await queryRunner.query(`COMMENT ON COLUMN mentor_profiles.capacity IS 'Informational only – never blocks applications.'`);

    // -------------------------------------------------------- mentee_profiles
    await queryRunner.query(`
      CREATE TABLE mentee_profiles (
        user_id                  uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        domain_id                uuid        NULL REFERENCES domains (id),
        needs                    text        NULL,
        studies                  text        NULL,
        career_goals             text        NULL,
        onboarding_completed_at  timestamptz NULL,
        free_call_used_at        timestamptz NULL,
        stripe_customer_id       text        NULL,
        created_at               timestamptz NOT NULL DEFAULT now(),
        updated_at               timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_mentee_profiles_stripe_customer_id UNIQUE (stripe_customer_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_mentee_profiles_domain_id ON mentee_profiles (domain_id)`);
    await queryRunner.query(updatedAtTrigger('mentee_profiles'));
    await queryRunner.query(`COMMENT ON TABLE mentee_profiles IS '1:1 with users (role MENTEE). Matching form, free-call usage, Stripe customer.'`);
    await queryRunner.query(`COMMENT ON COLUMN mentee_profiles.free_call_used_at IS 'NULL = the single free call per account is still available. Admin may reset to NULL.'`);

    // ----------------------------------------------------- mentor_credentials
    await queryRunner.query(`
      CREATE TABLE mentor_credentials (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_id   uuid        NOT NULL REFERENCES mentor_profiles (user_id) ON DELETE CASCADE,
        type        text        NOT NULL,
        file_id     uuid        NOT NULL REFERENCES files (id) ON DELETE RESTRICT,
        title       text        NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_mentor_credentials_type CHECK (type IN ('CV', 'CERTIFICATE', 'DIPLOMA')),
        CONSTRAINT uq_mentor_credentials_file_id UNIQUE (file_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_mentor_credentials_mentor_id ON mentor_credentials (mentor_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_mentor_credentials_one_cv ON mentor_credentials (mentor_id) WHERE type = 'CV'`);
    await queryRunner.query(updatedAtTrigger('mentor_credentials'));
    await queryRunner.query(`COMMENT ON TABLE mentor_credentials IS 'Documents sent with the mentor application: exactly one CV + any number of certificates / diplomas.'`);

    // ---------------------------------------------------- mentor_social_links
    await queryRunner.query(`
      CREATE TABLE mentor_social_links (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_id   uuid        NOT NULL REFERENCES mentor_profiles (user_id) ON DELETE CASCADE,
        platform    text        NOT NULL,
        url         text        NOT NULL,
        position    smallint    NOT NULL DEFAULT 0,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_mentor_social_links_platform
          CHECK (platform IN ('LINKEDIN', 'GITHUB', 'BEHANCE', 'DRIBBBLE', 'X', 'INSTAGRAM', 'WEBSITE', 'OTHER')),
        CONSTRAINT uq_mentor_social_links_mentor_url UNIQUE (mentor_id, url)
      )
    `);
    await queryRunner.query(updatedAtTrigger('mentor_social_links'));
    await queryRunner.query(`COMMENT ON TABLE mentor_social_links IS 'Public links shown on the mentor profile.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS mentor_social_links`);
    await queryRunner.query(`DROP TABLE IF EXISTS mentor_credentials`);
    await queryRunner.query(`DROP TABLE IF EXISTS mentee_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS mentor_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS sponsors`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_auth_providers`);
    await queryRunner.query(`ALTER TABLE files DROP CONSTRAINT IF EXISTS fk_files_uploaded_by_user`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS files`);
    await queryRunner.query(`DROP TABLE IF EXISTS domains`);
  }
}
