import { MigrationInterface, QueryRunner } from 'typeorm';

const updatedAtTrigger = (table: string) => `
  CREATE TRIGGER trg_${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at()
`;

/**
 * Scheduling: sessions, session_reschedules, session_reminders.
 * Sessions can never be cancelled – only rescheduled – so there is no CANCELED status.
 */
export class CreateSessions1794441604000 implements MigrationInterface {
  name = 'CreateSessions1794441604000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --------------------------------------------------------------- sessions
    await queryRunner.query(`
      CREATE TABLE sessions (
        id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        type                     text        NOT NULL,
        status                   text        NOT NULL DEFAULT 'SCHEDULED',
        mentor_id                uuid        NOT NULL REFERENCES mentor_profiles (user_id),
        mentee_id                uuid        NOT NULL REFERENCES mentee_profiles (user_id),
        enrolment_id             uuid        NULL REFERENCES enrolments (id),
        application_id           uuid        NULL REFERENCES applications (id),
        starts_at                timestamptz NOT NULL,
        ends_at                  timestamptz NOT NULL,
        subscription_id          uuid        NULL REFERENCES subscriptions (id),
        billing_period_start     timestamptz NULL,
        meet_url                 text        NULL,
        google_event_id          text        NULL,
        meet_sync_status         text        NOT NULL DEFAULT 'PENDING',
        held_at                  timestamptz NULL,
        payout_excluded_at       timestamptz NULL,
        payout_exclusion_reason  text        NULL,
        created_at               timestamptz NOT NULL DEFAULT now(),
        updated_at               timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_sessions_google_event_id UNIQUE (google_event_id),
        CONSTRAINT ck_sessions_type   CHECK (type IN ('FREE_CALL', 'PAID', 'SPONSORED')),
        CONSTRAINT ck_sessions_status CHECK (status IN ('SCHEDULED', 'HELD')),
        CONSTRAINT ck_sessions_meet_sync_status CHECK (meet_sync_status IN ('PENDING', 'OK', 'FAILED')),
        CONSTRAINT ck_sessions_time_order CHECK (ends_at > starts_at),
        CONSTRAINT ck_sessions_link CHECK (
          (type = 'FREE_CALL' AND application_id IS NOT NULL AND enrolment_id IS NULL)
          OR (type <> 'FREE_CALL' AND enrolment_id IS NOT NULL AND application_id IS NULL)
        ),
        CONSTRAINT ck_sessions_subscription_pair
          CHECK ((subscription_id IS NULL) = (billing_period_start IS NULL)),
        CONSTRAINT ck_sessions_subscription_only_paid
          CHECK (subscription_id IS NULL OR type = 'PAID'),
        CONSTRAINT ck_sessions_held CHECK ((status = 'HELD') = (held_at IS NOT NULL)),
        CONSTRAINT ck_sessions_payout_exclusion
          CHECK (payout_excluded_at IS NULL OR payout_exclusion_reason IS NOT NULL),
        CONSTRAINT ex_sessions_mentor_no_overlap
          EXCLUDE USING gist (mentor_id WITH =, tstzrange(starts_at, ends_at) WITH &&),
        CONSTRAINT ex_sessions_mentee_no_overlap
          EXCLUDE USING gist (mentee_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_sessions_status_ends_at ON sessions (status, ends_at)`);
    await queryRunner.query(`CREATE INDEX ix_sessions_mentor_starts ON sessions (mentor_id, starts_at)`);
    await queryRunner.query(`CREATE INDEX ix_sessions_mentee_starts ON sessions (mentee_id, starts_at)`);
    await queryRunner.query(`CREATE INDEX ix_sessions_enrolment_starts ON sessions (enrolment_id, starts_at)`);
    await queryRunner.query(`CREATE INDEX ix_sessions_application_id ON sessions (application_id)`);
    await queryRunner.query(`CREATE INDEX ix_sessions_subscription_period ON sessions (subscription_id, billing_period_start)`);
    await queryRunner.query(updatedAtTrigger('sessions'));
    await queryRunner.query(`COMMENT ON TABLE sessions IS 'Every call: FREE_CALL (linked to application), PAID or SPONSORED (linked to enrolment). No cancellation. EXCLUDE constraints prevent double-booking of mentor and mentee.'`);
    await queryRunner.query(`COMMENT ON COLUMN sessions.billing_period_start IS 'Monthly plans: the billing cycle this session consumes (kept even when rescheduled).'`);
    await queryRunner.query(`COMMENT ON COLUMN sessions.held_at IS 'Set by the job once ends_at has passed (a non-cancelled session is considered held).'`);

    // ---------------------------------------------------- session_reschedules
    await queryRunner.query(`
      CREATE TABLE session_reschedules (
        id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id              uuid        NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        rescheduled_by_user_id  uuid        NULL REFERENCES users (id) ON DELETE SET NULL,
        old_starts_at           timestamptz NOT NULL,
        old_ends_at             timestamptz NOT NULL,
        new_starts_at           timestamptz NOT NULL,
        new_ends_at             timestamptz NOT NULL,
        reason                  text        NULL,
        created_at              timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_session_reschedules_old_order CHECK (old_ends_at > old_starts_at),
        CONSTRAINT ck_session_reschedules_new_order CHECK (new_ends_at > new_starts_at)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_session_reschedules_session ON session_reschedules (session_id, created_at)`);
    await queryRunner.query(`COMMENT ON TABLE session_reschedules IS 'Append-only history of reschedules (either party, any time).'`);

    // ------------------------------------------------------ session_reminders
    await queryRunner.query(`
      CREATE TABLE session_reminders (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id      uuid        NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        offset_minutes  integer     NOT NULL,
        send_at         timestamptz NOT NULL,
        sent_at         timestamptz NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_session_reminders_offset CHECK (offset_minutes > 0),
        CONSTRAINT uq_session_reminders UNIQUE (session_id, user_id, offset_minutes)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_session_reminders_due ON session_reminders (send_at) WHERE sent_at IS NULL`);
    await queryRunner.query(updatedAtTrigger('session_reminders'));
    await queryRunner.query(`COMMENT ON TABLE session_reminders IS 'Reminder per recipient per offset (default 24h and 1h). Unsent rows are recreated on reschedule.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS session_reminders`);
    await queryRunner.query(`DROP TABLE IF EXISTS session_reschedules`);
    await queryRunner.query(`DROP TABLE IF EXISTS sessions`);
  }
}
