import { MigrationInterface, QueryRunner } from 'typeorm';

const updatedAtTrigger = (table: string) => `
  CREATE TRIGGER trg_${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at()
`;

// Keep in sync with the NotificationType enum in the NestJS code.
const NOTIFICATION_TYPES = [
  'MENTOR_APPROVED',
  'MENTOR_REJECTED',
  'APPLICATION_RECEIVED',
  'APPLICATION_QUESTIONS_ANSWERED',
  'APPLICATION_ACCEPTED',
  'APPLICATION_REJECTED',
  'FREE_CALL_SCHEDULED',
  'ENROLMENT_CONFIRMED',
  'SESSION_SCHEDULED',
  'SESSION_REMINDER',
  'SESSION_RESCHEDULED',
  'EVALUATION_CREATED',
  'PROJECT_ASSIGNED',
  'PROJECT_SUBMITTED',
  'PROJECT_FEEDBACK',
  'PAYOUT_SENT',
  'SUBSCRIPTION_RENEWED',
  'PAYMENT_FAILED',
  'RATING_REQUESTED',
  'REVIEW_REQUESTED',
  'SPONSORED_PROGRAM_DECIDED',
] as const;

/**
 * No in-app chat: external messaging groups (provider-agnostic) + platform notifications.
 * messaging_groups, messaging_group_members, notifications, email_outbox.
 */
export class CreateCommunication1794441606000 implements MigrationInterface {
  name = 'CreateCommunication1794441606000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------- messaging_groups
    await queryRunner.query(`
      CREATE TABLE messaging_groups (
        id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        provider      text        NOT NULL,
        type          text        NOT NULL,
        enrolment_id  uuid        NULL REFERENCES enrolments (id) ON DELETE CASCADE,
        mentor_id     uuid        NULL REFERENCES mentor_profiles (user_id) ON DELETE CASCADE,
        external_id   text        NULL,
        invite_url    text        NULL,
        sync_status   text        NOT NULL DEFAULT 'PENDING',
        archived_at   timestamptz NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_messaging_groups_enrolment_id UNIQUE (enrolment_id),
        CONSTRAINT uq_messaging_groups_external UNIQUE (provider, external_id),
        CONSTRAINT ck_messaging_groups_type CHECK (type IN ('PRIVATE', 'COHORT')),
        CONSTRAINT ck_messaging_groups_sync_status CHECK (sync_status IN ('PENDING', 'OK', 'FAILED')),
        CONSTRAINT ck_messaging_groups_owner CHECK (
          (type = 'PRIVATE' AND enrolment_id IS NOT NULL AND mentor_id IS NULL)
          OR (type = 'COHORT' AND mentor_id IS NOT NULL AND enrolment_id IS NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_messaging_groups_one_live_cohort
        ON messaging_groups (mentor_id) WHERE type = 'COHORT' AND archived_at IS NULL
    `);
    await queryRunner.query(updatedAtTrigger('messaging_groups'));
    await queryRunner.query(`COMMENT ON TABLE messaging_groups IS 'External groups created through the messaging provider API: PRIVATE (per enrolment) and COHORT (per mentor). Provider not decided yet.'`);

    // ------------------------------------------------ messaging_group_members
    await queryRunner.query(`
      CREATE TABLE messaging_group_members (
        id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id    uuid        NOT NULL REFERENCES messaging_groups (id) ON DELETE CASCADE,
        user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        role        text        NOT NULL DEFAULT 'MEMBER',
        invited_at  timestamptz NOT NULL DEFAULT now(),
        joined_at   timestamptz NULL,
        removed_at  timestamptz NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_messaging_group_members_role CHECK (role IN ('OWNER', 'MEMBER'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_messaging_group_members_active
        ON messaging_group_members (group_id, user_id) WHERE removed_at IS NULL
    `);
    await queryRunner.query(`CREATE INDEX ix_messaging_group_members_user_id ON messaging_group_members (user_id)`);
    await queryRunner.query(updatedAtTrigger('messaging_group_members'));
    await queryRunner.query(`COMMENT ON TABLE messaging_group_members IS 'Group membership history (cohort membership changes as mentorships start and end).'`);

    // ---------------------------------------------------------- notifications
    const types = NOTIFICATION_TYPES.map((t) => `'${t}'`).join(', ');
    await queryRunner.query(`
      CREATE TABLE notifications (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        type         text        NOT NULL,
        title        text        NOT NULL,
        body         text        NULL,
        link_path    text        NULL,
        entity_type  text        NULL,
        entity_id    uuid        NULL,
        data         jsonb       NOT NULL DEFAULT '{}'::jsonb,
        read_at      timestamptz NULL,
        created_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_notifications_type CHECK (type IN (${types})),
        CONSTRAINT ck_notifications_entity CHECK ((entity_type IS NULL) = (entity_id IS NULL))
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_notifications_user_created ON notifications (user_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX ix_notifications_user_unread ON notifications (user_id) WHERE read_at IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE notifications IS 'In-app notification bell. Every transactional email event also creates one.'`);

    // ----------------------------------------------------------- email_outbox
    await queryRunner.query(`
      CREATE TABLE email_outbox (
        id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id              uuid        NULL REFERENCES users (id) ON DELETE SET NULL,
        notification_id      uuid        NULL REFERENCES notifications (id) ON DELETE SET NULL,
        to_email             text        NOT NULL,
        template             text        NOT NULL,
        payload              jsonb       NOT NULL DEFAULT '{}'::jsonb,
        status               text        NOT NULL DEFAULT 'PENDING',
        attempts             smallint    NOT NULL DEFAULT 0,
        last_error           text        NULL,
        send_after           timestamptz NOT NULL DEFAULT now(),
        sent_at              timestamptz NULL,
        provider_message_id  text        NULL,
        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_email_outbox_status CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
        CONSTRAINT ck_email_outbox_attempts CHECK (attempts >= 0),
        CONSTRAINT ck_email_outbox_sent CHECK (status <> 'SENT' OR sent_at IS NOT NULL)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_email_outbox_pending ON email_outbox (send_after) WHERE status = 'PENDING'`);
    await queryRunner.query(`CREATE INDEX ix_email_outbox_user_id ON email_outbox (user_id)`);
    await queryRunner.query(updatedAtTrigger('email_outbox'));
    await queryRunner.query(`COMMENT ON TABLE email_outbox IS 'Transactional email queue + log (Romanian templates), with retry bookkeeping.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS email_outbox`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS messaging_group_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS messaging_groups`);
  }
}
