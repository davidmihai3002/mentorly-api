# Mentorly — database (PostgreSQL + TypeORM migrations)

```
docs/
  DATABASE.md             ← this file
  DB-SCHEMA.md            ← every table, column, key, CHECK, index (generated from the migrated DB)
  mentorly-c4.drawio      ← C4 diagrams: L1 System context · L2 Containers · L3 API components & tables
src/db/
  typeorm.config.ts       ← TypeORM options shared by the Nest app (AppModule) and the CLI
  data-source.ts          ← DataSource for the TypeORM CLI
  migrations/
    1794441600000-InitDatabase.ts                         btree_gist + set_updated_at() trigger fn
    1794441601000-CreateIdentityAndProfiles.ts            domains, files, users, user_auth_providers, sponsors,
                                                          mentor_profiles, mentee_profiles, mentor_credentials,
                                                          mentor_social_links
    1794441602000-CreateMentorshipOffer.ts                mentorships, availability_slots, mentorship_questions,
                                                          study_materials, favourites
    1794441603000-CreateApplicationsAndEnrolments.ts      applications, application_answers,
                                                          application_mentee_questions, enrolments, subscriptions
    1794441604000-CreateSessions.ts                       sessions, session_reschedules, session_reminders
    1794441605000-CreatePayments.ts                       payments, payouts, payout_items, stripe_webhook_events
    1794441606000-CreateCommunication.ts                  messaging_groups, messaging_group_members,
                                                          notifications, email_outbox
    1794441607000-CreateProgressAndReviews.ts             evaluations, evaluation_scores, projects, goals,
                                                          session_ratings, reviews, mentor_rating_stats
    1794441608000-CreateSponsoredProgramContentAndAudit.ts sponsored_program_applications, faq_items,
                                                          platform_testimonials, admin_audit_log
    1794441609000-SeedReferenceData.ts                    14 domains + 19 FAQ entries (all environments)
    1794441610000-SeedDemoData.ts                         demo world – skipped when NODE_ENV=production
  scripts/run-migrations.ts                               runs pending migrations one at a time (npm run migration:run:each)
```

## Requirements

**PostgreSQL 13+** (uses `gen_random_uuid()`), extension **btree_gist** (standard contrib – available on
RDS, Cloud SQL, Supabase, Neon). The demo seed also enables **pgcrypto** (only to bcrypt the
demo passwords; not created in production). Keep `synchronize: false` – schema changes go through new migrations.

Running the migrations: see the *Database migrations* section of the [README](../README.md); connection settings: [ENVIRONMENT.md](ENVIRONMENT.md).

## Conventions

- UUID v4 PKs; `text` + `CHECK` for every status/type; money in integer **bani** (RON × 100); `timestamptz` everywhere (UTC).
- `updated_at` is maintained by the `set_updated_at()` trigger (correct even for admin scripts / psql).
- Named constraints: `uq_` unique · `ck_` check · `ex_` exclusion · `ix_` index.
- Things the DB enforces on its own: no double-booking of a mentor **or** a mentee (EXCLUDE on time ranges), max 3
  application questions and max 3 mentee questions, one PENDING application per mentee + mentorship, one live enrolment
  per mentee + mentorship, one CV per mentor, mandatory ≥ 30-char rejection reason, no `CANCELED` session status,
  publish rules for mentorships, sponsored = free, commission ≤ amount, `net = gross − commission`, a session paid out
  at most once, one review per enrolment, one live cohort group per mentor.
- Rules that need other tables or "now" stay in the app: age ≥ 16, review eligibility, availability overlaps,
  `score ≤ scale_max` on sub-scores, user role ↔ profile type.
- Commission rate: env config, snapshotted on each payment (`payments.commission_rate`).
- Monthly discount is derived, not stored: `1 − monthly_price / (N × per_session_price)`.

## Demo data (non-production only)

Dates are **relative to when the migration runs** (last week's sessions are `HELD`, next week's are `SCHEDULED`).
All passwords: `Parola123!` (Ana signs in with Google only).

| User | Role | Story |
|---|---|---|
| mihai.popescu@example.com | Mentor, Marketing | test + 3 questions, per session 120 RON or 432 RON/month for 4 (10% off); one payout |
| ioana.dumitrescu@example.com | Mentor, IT | per session 200 RON |
| elena.marin@example.com | Mentor, Data/AI | sponsored by *Nordwave Software* (fictional) |
| andrei.stan@example.com | Mentor | `PENDING`, unpublished draft |
| radu.ionescu@example.com | Mentor | `REJECTED` (LinkedIn outdated) |
| ana.georgescu@example.com | Mentee | journeys §6: free call → monthly plan, 3/4 sessions used, one rescheduled, evaluation, projects, review |
| vlad.popa@example.com | Mentee | free call → pays per session with Ioana |
| maria.tudor@example.com | Mentee | rejected by Mihai, re-applied (pending), sponsored program in review |
| cristi.enache@example.com | Mentee | sponsored beneficiary enrolled with Elena |

Sponsors and testimonials are only seeded as **demo** content (clearly marked); real ones are added by the team.

## Small additions beyond what we agreed table-by-table

- `payments.session_id` is `ON DELETE SET NULL`, and a `SESSION` payment may lose its session **only if FAILED**, so a
  failed card payment can free the slot while a paid session can never be deleted.
- Extra consistency checks: `REJECTED` mentor needs `status_reason`; `decided_at` set ⇔ application decided;
  `ACTIVE` enrolment has `started_at`, `ENDED` ⇔ `ended_at`; `HELD` ⇔ `held_at`; subscription sessions only for `PAID`;
  `highlights` / `answers` must be JSON objects; notification `entity_type` and `entity_id` set together.
