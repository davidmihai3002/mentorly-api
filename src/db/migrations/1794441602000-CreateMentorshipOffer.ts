import { MigrationInterface, QueryRunner } from 'typeorm';

const updatedAtTrigger = (table: string) => `
  CREATE TRIGGER trg_${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at()
`;

/**
 * The mentor's published offer:
 * mentorships, availability_slots, mentorship_questions, study_materials, favourites.
 */
export class CreateMentorshipOffer1794441602000 implements MigrationInterface {
  name = 'CreateMentorshipOffer1794441602000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------ mentorships
    await queryRunner.query(`
      CREATE TABLE mentorships (
        id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_id                 uuid        NOT NULL REFERENCES mentor_profiles (user_id) ON DELETE CASCADE,
        description               text        NULL,
        conditions                text        NULL,
        min_knowledge             text        NULL,
        is_sponsored              boolean     NOT NULL DEFAULT false,
        per_session_price_bani    integer     NULL,
        monthly_price_bani        integer     NULL,
        monthly_sessions_count    smallint    NULL,
        session_duration_minutes  smallint    NOT NULL DEFAULT 60,
        has_test                  boolean     NOT NULL DEFAULT false,
        published_at              timestamptz NULL,
        created_at                timestamptz NOT NULL DEFAULT now(),
        updated_at                timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_mentorships_mentor_id UNIQUE (mentor_id),
        CONSTRAINT ck_mentorships_per_session_price
          CHECK (per_session_price_bani IS NULL OR per_session_price_bani > 0),
        CONSTRAINT ck_mentorships_monthly_price
          CHECK (monthly_price_bani IS NULL OR monthly_price_bani > 0),
        CONSTRAINT ck_mentorships_monthly_sessions_count
          CHECK (monthly_sessions_count IS NULL OR monthly_sessions_count > 0),
        CONSTRAINT ck_mentorships_monthly_pair
          CHECK ((monthly_price_bani IS NULL) = (monthly_sessions_count IS NULL)),
        CONSTRAINT ck_mentorships_sponsored_is_free
          CHECK (NOT is_sponsored OR (per_session_price_bani IS NULL AND monthly_price_bani IS NULL)),
        CONSTRAINT ck_mentorships_duration
          CHECK (session_duration_minutes IN (30, 45, 60, 90)),
        CONSTRAINT ck_mentorships_publishable
          CHECK (
            published_at IS NULL
            OR (
              description IS NOT NULL
              AND (is_sponsored OR per_session_price_bani IS NOT NULL OR monthly_price_bani IS NOT NULL)
            )
          )
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_mentorships_published ON mentorships (published_at) WHERE published_at IS NOT NULL`);
    await queryRunner.query(updatedAtTrigger('mentorships'));
    await queryRunner.query(`COMMENT ON TABLE mentorships IS 'The mentor''s offer (one per mentor in MVP). Monthly discount is derived: 1 - monthly_price / (N * per_session_price).'`);
    await queryRunner.query(`COMMENT ON COLUMN mentorships.monthly_sessions_count IS 'N – sessions included per billing cycle; unused ones expire.'`);

    // ----------------------------------------------------- availability_slots
    await queryRunner.query(`
      CREATE TABLE availability_slots (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_id    uuid        NOT NULL REFERENCES mentor_profiles (user_id) ON DELETE CASCADE,
        day_of_week  smallint    NOT NULL,
        start_time   time        NOT NULL,
        end_time     time        NOT NULL,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_availability_slots_day_of_week CHECK (day_of_week BETWEEN 1 AND 7),
        CONSTRAINT ck_availability_slots_time_order  CHECK (end_time > start_time)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_availability_slots_mentor_day ON availability_slots (mentor_id, day_of_week)`);
    await queryRunner.query(updatedAtTrigger('availability_slots'));
    await queryRunner.query(`COMMENT ON TABLE availability_slots IS 'Weekly recurring windows, Europe/Bucharest local time. ISO day: 1 = Monday. Overlaps prevented in the app.'`);

    // --------------------------------------------------- mentorship_questions
    await queryRunner.query(`
      CREATE TABLE mentorship_questions (
        id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentorship_id  uuid        NOT NULL REFERENCES mentorships (id) ON DELETE CASCADE,
        kind           text        NOT NULL,
        prompt         text        NOT NULL,
        position       smallint    NOT NULL,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_mentorship_questions_kind CHECK (kind IN ('APPLICATION', 'TEST')),
        CONSTRAINT ck_mentorship_questions_position CHECK (position >= 1),
        CONSTRAINT ck_mentorship_questions_max_3_application
          CHECK (kind <> 'APPLICATION' OR position BETWEEN 1 AND 3),
        CONSTRAINT uq_mentorship_questions_position UNIQUE (mentorship_id, kind, position)
      )
    `);
    await queryRunner.query(updatedAtTrigger('mentorship_questions'));
    await queryRunner.query(`COMMENT ON TABLE mentorship_questions IS 'Mentor''s application questions (max 3, enforced by position 1-3 + unique) and free-text test questions.'`);

    // -------------------------------------------------------- study_materials
    await queryRunner.query(`
      CREATE TABLE study_materials (
        id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentorship_id  uuid        NOT NULL REFERENCES mentorships (id) ON DELETE CASCADE,
        title          text        NOT NULL,
        kind           text        NOT NULL,
        file_id        uuid        NULL REFERENCES files (id) ON DELETE RESTRICT,
        url            text        NULL,
        position       smallint    NOT NULL DEFAULT 0,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_study_materials_kind CHECK (kind IN ('FILE', 'LINK')),
        CONSTRAINT ck_study_materials_payload CHECK (
          (kind = 'FILE' AND file_id IS NOT NULL AND url IS NULL)
          OR (kind = 'LINK' AND url IS NOT NULL AND file_id IS NULL)
        )
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_study_materials_mentorship ON study_materials (mentorship_id, position)`);
    await queryRunner.query(updatedAtTrigger('study_materials'));
    await queryRunner.query(`COMMENT ON TABLE study_materials IS 'Files or links the test is based on. Visible only to logged-in mentees.'`);

    // ------------------------------------------------------------- favourites
    await queryRunner.query(`
      CREATE TABLE favourites (
        mentee_id   uuid        NOT NULL REFERENCES mentee_profiles (user_id) ON DELETE CASCADE,
        mentor_id   uuid        NOT NULL REFERENCES mentor_profiles (user_id) ON DELETE CASCADE,
        created_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_favourites PRIMARY KEY (mentee_id, mentor_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_favourites_mentor_id ON favourites (mentor_id)`);
    await queryRunner.query(`COMMENT ON TABLE favourites IS 'Mentors saved by a mentee.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS favourites`);
    await queryRunner.query(`DROP TABLE IF EXISTS study_materials`);
    await queryRunner.query(`DROP TABLE IF EXISTS mentorship_questions`);
    await queryRunner.query(`DROP TABLE IF EXISTS availability_slots`);
    await queryRunner.query(`DROP TABLE IF EXISTS mentorships`);
  }
}
