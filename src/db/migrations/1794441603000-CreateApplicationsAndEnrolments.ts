import { MigrationInterface, QueryRunner } from 'typeorm';

const updatedAtTrigger = (table: string) => `
  CREATE TRIGGER trg_${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at()
`;

/**
 * Applications and the relationship that follows:
 * applications, application_answers, application_mentee_questions, enrolments, subscriptions.
 */
export class CreateApplicationsAndEnrolments1794441603000 implements MigrationInterface {
  name = 'CreateApplicationsAndEnrolments1794441603000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ----------------------------------------------------------- applications
    await queryRunner.query(`
      CREATE TABLE applications (
        id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentee_id         uuid        NOT NULL REFERENCES mentee_profiles (user_id) ON DELETE CASCADE,
        mentorship_id     uuid        NOT NULL REFERENCES mentorships (id) ON DELETE CASCADE,
        status            text        NOT NULL DEFAULT 'PENDING',
        rejection_reason  text        NULL,
        submitted_at      timestamptz NOT NULL DEFAULT now(),
        decided_at        timestamptz NULL,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_applications_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
        CONSTRAINT ck_applications_rejection_reason CHECK (
          status <> 'REJECTED'
          OR (rejection_reason IS NOT NULL AND char_length(btrim(rejection_reason)) >= 30)
        ),
        CONSTRAINT ck_applications_decided_at CHECK ((status = 'PENDING') = (decided_at IS NULL))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_applications_one_pending
        ON applications (mentee_id, mentorship_id) WHERE status = 'PENDING'
    `);
    await queryRunner.query(`CREATE INDEX ix_applications_mentorship_status ON applications (mentorship_id, status)`);
    await queryRunner.query(`CREATE INDEX ix_applications_mentee_submitted ON applications (mentee_id, submitted_at DESC)`);
    await queryRunner.query(updatedAtTrigger('applications'));
    await queryRunner.query(`COMMENT ON TABLE applications IS 'Mentee request to join a mentorship. Re-applying after rejection creates a new row; only one PENDING per mentee + mentorship.'`);

    // ---------------------------------------------------- application_answers
    await queryRunner.query(`
      CREATE TABLE application_answers (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id  uuid        NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
        question_id     uuid        NULL REFERENCES mentorship_questions (id) ON DELETE SET NULL,
        question_kind   text        NOT NULL,
        question_text   text        NOT NULL,
        answer_text     text        NOT NULL,
        position        smallint    NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_application_answers_kind CHECK (question_kind IN ('APPLICATION', 'TEST')),
        CONSTRAINT uq_application_answers_question UNIQUE (application_id, question_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_application_answers_question_id ON application_answers (question_id)`);
    await queryRunner.query(`COMMENT ON TABLE application_answers IS 'Answers to the mentor''s application + test questions. Question kind/text are snapshots. Immutable.'`);

    // ------------------------------------------- application_mentee_questions
    await queryRunner.query(`
      CREATE TABLE application_mentee_questions (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id  uuid        NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
        position        smallint    NOT NULL,
        question_text   text        NOT NULL,
        mentor_answer   text        NULL,
        answered_at     timestamptz NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_application_mentee_questions_position CHECK (position BETWEEN 1 AND 3),
        CONSTRAINT ck_application_mentee_questions_answered
          CHECK ((mentor_answer IS NULL) = (answered_at IS NULL)),
        CONSTRAINT uq_application_mentee_questions_position UNIQUE (application_id, position)
      )
    `);
    await queryRunner.query(updatedAtTrigger('application_mentee_questions'));
    await queryRunner.query(`COMMENT ON TABLE application_mentee_questions IS 'Mentee''s own optional questions (max 3) and the mentor''s answers, given on the application page.'`);

    // ------------------------------------------------------------- enrolments
    await queryRunner.query(`
      CREATE TABLE enrolments (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentee_id       uuid        NOT NULL REFERENCES mentee_profiles (user_id),
        mentorship_id   uuid        NOT NULL REFERENCES mentorships (id),
        application_id  uuid        NOT NULL REFERENCES applications (id),
        plan            text        NOT NULL,
        status          text        NOT NULL DEFAULT 'PENDING_PAYMENT',
        started_at      timestamptz NULL,
        ended_at        timestamptz NULL,
        ended_by        text        NULL,
        end_reason      text        NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_enrolments_application_id UNIQUE (application_id),
        CONSTRAINT ck_enrolments_plan   CHECK (plan IN ('PER_SESSION', 'MONTHLY', 'SPONSORED')),
        CONSTRAINT ck_enrolments_status CHECK (status IN ('PENDING_PAYMENT', 'ACTIVE', 'ENDED')),
        CONSTRAINT ck_enrolments_started CHECK (status <> 'ACTIVE' OR started_at IS NOT NULL),
        CONSTRAINT ck_enrolments_ended   CHECK ((status = 'ENDED') = (ended_at IS NOT NULL)),
        CONSTRAINT ck_enrolments_ended_by
          CHECK (ended_by IS NULL OR ended_by IN ('MENTEE', 'MENTOR', 'SYSTEM', 'ADMIN'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_enrolments_one_live
        ON enrolments (mentee_id, mentorship_id) WHERE status <> 'ENDED'
    `);
    await queryRunner.query(`CREATE INDEX ix_enrolments_mentorship_status ON enrolments (mentorship_id, status)`);
    await queryRunner.query(`CREATE INDEX ix_enrolments_mentee_status ON enrolments (mentee_id, status)`);
    await queryRunner.query(updatedAtTrigger('enrolments'));
    await queryRunner.query(`COMMENT ON TABLE enrolments IS 'Mentee enrolled in a mentorship (per session, monthly or sponsored). Groups, sessions, progress and reviews hang off it.'`);

    // ---------------------------------------------------------- subscriptions
    await queryRunner.query(`
      CREATE TABLE subscriptions (
        id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        enrolment_id            uuid        NOT NULL REFERENCES enrolments (id) ON DELETE CASCADE,
        stripe_subscription_id  text        NOT NULL,
        status                  text        NOT NULL,
        price_bani              integer     NOT NULL,
        sessions_per_period     smallint    NOT NULL,
        current_period_start    timestamptz NOT NULL,
        current_period_end      timestamptz NOT NULL,
        cancel_at_period_end    boolean     NOT NULL DEFAULT false,
        canceled_at             timestamptz NULL,
        created_at              timestamptz NOT NULL DEFAULT now(),
        updated_at              timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_subscriptions_enrolment_id UNIQUE (enrolment_id),
        CONSTRAINT uq_subscriptions_stripe_id UNIQUE (stripe_subscription_id),
        CONSTRAINT ck_subscriptions_status
          CHECK (status IN ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'CANCELED')),
        CONSTRAINT ck_subscriptions_price CHECK (price_bani > 0),
        CONSTRAINT ck_subscriptions_sessions CHECK (sessions_per_period > 0),
        CONSTRAINT ck_subscriptions_period CHECK (current_period_end > current_period_start),
        CONSTRAINT ck_subscriptions_canceled CHECK (status <> 'CANCELED' OR canceled_at IS NOT NULL)
      )
    `);
    await queryRunner.query(updatedAtTrigger('subscriptions'));
    await queryRunner.query(`COMMENT ON TABLE subscriptions IS 'Mirror of the Stripe subscription for MONTHLY enrolments. price/N are snapshots taken at sign-up.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS subscriptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS enrolments`);
    await queryRunner.query(`DROP TABLE IF EXISTS application_mentee_questions`);
    await queryRunner.query(`DROP TABLE IF EXISTS application_answers`);
    await queryRunner.query(`DROP TABLE IF EXISTS applications`);
  }
}
