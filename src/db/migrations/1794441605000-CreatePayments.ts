import { MigrationInterface, QueryRunner } from 'typeorm';

const updatedAtTrigger = (table: string) => `
  CREATE TRIGGER trg_${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at()
`;

/**
 * Money: payments (in), payouts + payout_items (out, twice a month), stripe_webhook_events.
 * All amounts are integer bani (RON x 100). Commission rate comes from an env variable and is
 * snapshotted on every payment.
 */
export class CreatePayments1794441605000 implements MigrationInterface {
  name = 'CreatePayments1794441605000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --------------------------------------------------------------- payments
    await queryRunner.query(`
      CREATE TABLE payments (
        id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        mentee_id                 uuid          NOT NULL REFERENCES mentee_profiles (user_id),
        mentor_id                 uuid          NOT NULL REFERENCES mentor_profiles (user_id),
        enrolment_id              uuid          NOT NULL REFERENCES enrolments (id),
        kind                      text          NOT NULL,
        session_id                uuid          NULL REFERENCES sessions (id) ON DELETE SET NULL,
        subscription_id           uuid          NULL REFERENCES subscriptions (id),
        period_start              timestamptz   NULL,
        period_end                timestamptz   NULL,
        amount_bani               integer       NOT NULL,
        commission_rate           numeric(5,4)  NOT NULL,
        commission_bani           integer       NOT NULL,
        refunded_bani             integer       NOT NULL DEFAULT 0,
        currency                  char(3)       NOT NULL DEFAULT 'RON',
        status                    text          NOT NULL DEFAULT 'PENDING',
        stripe_payment_intent_id  text          NULL,
        stripe_invoice_id         text          NULL,
        paid_at                   timestamptz   NULL,
        refunded_at               timestamptz   NULL,
        created_at                timestamptz   NOT NULL DEFAULT now(),
        updated_at                timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT uq_payments_session_id UNIQUE (session_id),
        CONSTRAINT uq_payments_stripe_payment_intent_id UNIQUE (stripe_payment_intent_id),
        CONSTRAINT uq_payments_stripe_invoice_id UNIQUE (stripe_invoice_id),
        CONSTRAINT ck_payments_kind CHECK (kind IN ('SESSION', 'SUBSCRIPTION_INVOICE')),
        CONSTRAINT ck_payments_status
          CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
        CONSTRAINT ck_payments_currency CHECK (currency = 'RON'),
        CONSTRAINT ck_payments_amount CHECK (amount_bani > 0),
        CONSTRAINT ck_payments_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 1),
        CONSTRAINT ck_payments_commission CHECK (commission_bani >= 0 AND commission_bani <= amount_bani),
        CONSTRAINT ck_payments_refunded CHECK (refunded_bani >= 0 AND refunded_bani <= amount_bani),
        CONSTRAINT ck_payments_paid_at
          CHECK (status IN ('PENDING', 'FAILED') OR paid_at IS NOT NULL),
        -- A SESSION payment keeps its session, except a FAILED one whose session was
        -- deleted to free the slot (FK is ON DELETE SET NULL for exactly that case).
        CONSTRAINT ck_payments_kind_refs CHECK (
          (kind = 'SESSION'
            AND subscription_id IS NULL AND period_start IS NULL AND period_end IS NULL
            AND (session_id IS NOT NULL OR status = 'FAILED'))
          OR
          (kind = 'SUBSCRIPTION_INVOICE'
            AND session_id IS NULL AND subscription_id IS NOT NULL
            AND period_start IS NOT NULL AND period_end IS NOT NULL AND period_end > period_start)
        )
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_payments_mentor_status ON payments (mentor_id, status)`);
    await queryRunner.query(`CREATE INDEX ix_payments_mentee_created ON payments (mentee_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX ix_payments_enrolment_id ON payments (enrolment_id)`);
    await queryRunner.query(`CREATE INDEX ix_payments_subscription_id ON payments (subscription_id)`);
    await queryRunner.query(updatedAtTrigger('payments'));
    await queryRunner.query(`COMMENT ON TABLE payments IS 'Money in: per-session charges and monthly invoices. "Held" (escrow) = SUCCEEDED and not yet in a payout_item.'`);
    await queryRunner.query(`COMMENT ON COLUMN payments.commission_rate IS 'Snapshot of the platform commission (env config) when the payment was made, e.g. 0.1500.'`);

    // ---------------------------------------------------------------- payouts
    await queryRunner.query(`
      CREATE TABLE payouts (
        id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_id           uuid        NOT NULL REFERENCES mentor_profiles (user_id),
        period_start        date        NOT NULL,
        period_end          date        NOT NULL,
        gross_bani          integer     NOT NULL,
        commission_bani     integer     NOT NULL,
        net_bani            integer     NOT NULL,
        status              text        NOT NULL DEFAULT 'PENDING',
        stripe_transfer_id  text        NULL,
        paid_at             timestamptz NULL,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_payouts_mentor_period UNIQUE (mentor_id, period_start),
        CONSTRAINT uq_payouts_stripe_transfer_id UNIQUE (stripe_transfer_id),
        CONSTRAINT ck_payouts_period CHECK (period_end >= period_start),
        CONSTRAINT ck_payouts_amounts CHECK (gross_bani >= 0 AND commission_bani >= 0 AND net_bani >= 0),
        CONSTRAINT ck_payouts_net CHECK (net_bani = gross_bani - commission_bani),
        CONSTRAINT ck_payouts_status CHECK (status IN ('PENDING', 'PAID', 'FAILED')),
        CONSTRAINT ck_payouts_paid CHECK (status <> 'PAID' OR paid_at IS NOT NULL)
      )
    `);
    await queryRunner.query(updatedAtTrigger('payouts'));
    await queryRunner.query(`COMMENT ON TABLE payouts IS 'Twice-a-month Stripe Connect transfer to a mentor for sessions held in the period, minus commission.'`);

    // ----------------------------------------------------------- payout_items
    await queryRunner.query(`
      CREATE TABLE payout_items (
        id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        payout_id        uuid        NOT NULL REFERENCES payouts (id) ON DELETE CASCADE,
        session_id       uuid        NOT NULL REFERENCES sessions (id),
        payment_id       uuid        NOT NULL REFERENCES payments (id),
        gross_bani       integer     NOT NULL,
        commission_bani  integer     NOT NULL,
        net_bani         integer     NOT NULL,
        created_at       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_payout_items_session_id UNIQUE (session_id),
        CONSTRAINT ck_payout_items_amounts CHECK (gross_bani >= 0 AND commission_bani >= 0 AND net_bani >= 0),
        CONSTRAINT ck_payout_items_net CHECK (net_bani = gross_bani - commission_bani)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_payout_items_payout_id ON payout_items (payout_id)`);
    await queryRunner.query(`CREATE INDEX ix_payout_items_payment_id ON payout_items (payment_id)`);
    await queryRunner.query(`COMMENT ON TABLE payout_items IS 'One row per held session included in a payout. Subscription sessions are valued at invoice / N. Free and sponsored sessions never appear.'`);

    // -------------------------------------------------- stripe_webhook_events
    await queryRunner.query(`
      CREATE TABLE stripe_webhook_events (
        id            text        PRIMARY KEY,
        type          text        NOT NULL,
        payload       jsonb       NOT NULL,
        received_at   timestamptz NOT NULL DEFAULT now(),
        processed_at  timestamptz NULL,
        error         text        NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_stripe_webhook_events_unprocessed ON stripe_webhook_events (received_at) WHERE processed_at IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE stripe_webhook_events IS 'Idempotency log: PK is the Stripe event id (evt_...), so each event is handled once.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS stripe_webhook_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS payout_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS payouts`);
    await queryRunner.query(`DROP TABLE IF EXISTS payments`);
  }
}
