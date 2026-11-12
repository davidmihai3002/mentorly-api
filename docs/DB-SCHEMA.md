# Mentorly — Database schema (PostgreSQL)

> Reference of the schema created by the migrations in `src/db/migrations/`. The migrations are the source of truth; update this file in the same PR whenever a migration changes the schema.

**Conventions:** UUID v4 primary keys (`gen_random_uuid()`), statuses as `text` + `CHECK`, money as integer **bani** (RON × 100), all timestamps `timestamptz` (UTC), `updated_at` maintained by the `set_updated_at()` trigger, `snake_case` plural table names. Named constraints use the prefixes `uq_`, `ck_`, `ex_`, `ix_`; inline PKs/FKs keep PostgreSQL's default names (`<table>_pkey`, `<table>_<column>_fkey`). Allowed status values are listed in the Notes column.

**41 tables.**

## Contents

- **Identity & profiles:** [`users`](#users), [`user_auth_providers`](#user_auth_providers), [`mentor_profiles`](#mentor_profiles), [`mentee_profiles`](#mentee_profiles), [`files`](#files), [`mentor_credentials`](#mentor_credentials), [`domains`](#domains), [`mentor_social_links`](#mentor_social_links), [`sponsors`](#sponsors)
- **Mentorship offer:** [`mentorships`](#mentorships), [`availability_slots`](#availability_slots), [`mentorship_questions`](#mentorship_questions), [`study_materials`](#study_materials), [`favourites`](#favourites)
- **Applications & enrolments:** [`applications`](#applications), [`application_answers`](#application_answers), [`application_mentee_questions`](#application_mentee_questions), [`enrolments`](#enrolments), [`subscriptions`](#subscriptions)
- **Scheduling:** [`sessions`](#sessions), [`session_reschedules`](#session_reschedules), [`session_reminders`](#session_reminders)
- **Payments:** [`payments`](#payments), [`payouts`](#payouts), [`payout_items`](#payout_items), [`stripe_webhook_events`](#stripe_webhook_events)
- **Communication & notifications:** [`messaging_groups`](#messaging_groups), [`messaging_group_members`](#messaging_group_members), [`notifications`](#notifications), [`email_outbox`](#email_outbox)
- **Progress:** [`evaluations`](#evaluations), [`evaluation_scores`](#evaluation_scores), [`projects`](#projects), [`goals`](#goals)
- **Ratings & reviews:** [`session_ratings`](#session_ratings), [`reviews`](#reviews), [`mentor_rating_stats`](#mentor_rating_stats)
- **Sponsored program, content & ops:** [`sponsored_program_applications`](#sponsored_program_applications), [`faq_items`](#faq_items), [`platform_testimonials`](#platform_testimonials), [`admin_audit_log`](#admin_audit_log)

## Identity & profiles

### `users`

One account per person. role is fixed at sign-up (separate mentor / mentee accounts). Age >= 16 is validated in the app.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `email` | text |  |  |  |  |
| `password_hash` | text | yes |  |  | NULL for Google-only accounts. |
| `role` | text |  |  |  | `MENTOR` · `MENTEE` |
| `first_name` | text |  |  |  |  |
| `last_name` | text |  |  |  |  |
| `birth_date` | date |  |  |  |  |
| `avatar_file_id` | uuid | yes |  | FK → `files(id) ON DELETE SET NULL` |  |
| `terms_accepted_at` | timestamptz |  |  |  |  |
| `email_verified_at` | timestamptz | yes |  |  |  |
| `token_version` | integer |  | `0` |  | Embedded in JWTs and reset/confirm links; bump to invalidate them (logout, password change). |
| `last_login_at` | timestamptz | yes |  |  |  |
| `deleted_at` | timestamptz | yes |  |  | GDPR deletion: personal data is anonymised, then this is set. |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_users_role` — CHECK `CHECK ((role = ANY (ARRAY['MENTOR'::text, 'MENTEE'::text])))`
- `ck_users_token_version` — CHECK `CHECK ((token_version >= 0))`
- `uq_users_email_lower` — `btree (lower(email))` (unique)

</details>

### `user_auth_providers`

External logins linked to a user (Google).

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `user_id` | uuid |  |  | FK → `users(id) ON DELETE CASCADE` |  |
| `provider` | text |  |  |  |  |
| `provider_user_id` | text |  |  |  |  |
| `provider_email` | text | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_user_auth_providers_provider` — CHECK `CHECK ((provider = 'GOOGLE'::text))`
- `uq_user_auth_providers_provider_user` — UNIQUE `UNIQUE (provider, provider_user_id)`
- `uq_user_auth_providers_user_provider` — UNIQUE `UNIQUE (user_id, provider)`

</details>

### `mentor_profiles`

1:1 with users (role MENTOR). Verification status, public profile, Stripe Connect account.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `user_id` | uuid |  |  | **PK** FK → `users(id) ON DELETE CASCADE` |  |
| `status` | text |  | `'PENDING'` |  | `PENDING` · `APPROVED` · `REJECTED` |
| `status_reason` | text | yes |  |  |  |
| `status_changed_at` | timestamptz | yes |  |  |  |
| `submitted_at` | timestamptz | yes |  |  |  |
| `domain_id` | uuid | yes |  | FK → `domains(id)` |  |
| `bio` | text | yes |  |  |  |
| `linkedin_url` | text |  |  |  |  |
| `motivation` | text |  |  |  |  |
| `highlights` | jsonb |  | `'{}'::jsonb` |  | {"workplaces": [...], "achievements": [...], "certifications": [...]} – validated by DTOs. |
| `capacity` | smallint | yes |  |  | Informational only – never blocks applications. |
| `sponsor_id` | uuid | yes |  | FK → `sponsors(id) ON DELETE SET NULL` |  |
| `stripe_account_id` | text | yes |  | UNIQUE |  |
| `stripe_account_status` | text |  | `'NOT_CONNECTED'` |  | `NOT_CONNECTED` · `PENDING` · `ACTIVE` · `RESTRICTED` |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_mentor_profiles_capacity` — CHECK `CHECK (((capacity IS NULL) OR (capacity > 0)))`
- `ck_mentor_profiles_highlights_object` — CHECK `CHECK ((jsonb_typeof(highlights) = 'object'::text))`
- `ck_mentor_profiles_rejected_reason` — CHECK `CHECK (((status <> 'REJECTED'::text) OR (status_reason IS NOT NULL)))`
- `ck_mentor_profiles_status` — CHECK `CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text])))`
- `ck_mentor_profiles_stripe_status` — CHECK `CHECK ((stripe_account_status = ANY (ARRAY['NOT_CONNECTED'::text, 'PENDING'::text, 'ACTIVE'::text, 'RESTRICTED'::text])))`
- `uq_mentor_profiles_stripe_account_id` — UNIQUE `UNIQUE (stripe_account_id)`
- `ix_mentor_profiles_sponsor_id` — `btree (sponsor_id)`
- `ix_mentor_profiles_status_domain` — `btree (status, domain_id)`

</details>

### `mentee_profiles`

1:1 with users (role MENTEE). Matching form, free-call usage, Stripe customer.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `user_id` | uuid |  |  | **PK** FK → `users(id) ON DELETE CASCADE` |  |
| `domain_id` | uuid | yes |  | FK → `domains(id)` |  |
| `needs` | text | yes |  |  |  |
| `studies` | text | yes |  |  |  |
| `career_goals` | text | yes |  |  |  |
| `onboarding_completed_at` | timestamptz | yes |  |  |  |
| `free_call_used_at` | timestamptz | yes |  |  | NULL = the single free call per account is still available. Admin may reset to NULL. |
| `stripe_customer_id` | text | yes |  | UNIQUE |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `uq_mentee_profiles_stripe_customer_id` — UNIQUE `UNIQUE (stripe_customer_id)`
- `ix_mentee_profiles_domain_id` — `btree (domain_id)`

</details>

### `files`

Upload metadata (object storage key). Immutable. Reused by CVs, certificates, avatars, study materials, deliverables, logos.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `uploaded_by_user_id` | uuid | yes |  | FK → `users(id) ON DELETE SET NULL` |  |
| `storage_key` | text |  |  | UNIQUE |  |
| `original_name` | text |  |  |  |  |
| `mime_type` | text |  |  |  |  |
| `size_bytes` | bigint |  |  |  |  |
| `visibility` | text |  | `'PRIVATE'` |  | `PUBLIC` · `PRIVATE` |
| `created_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_files_size_bytes` — CHECK `CHECK ((size_bytes > 0))`
- `ck_files_visibility` — CHECK `CHECK ((visibility = ANY (ARRAY['PUBLIC'::text, 'PRIVATE'::text])))`
- `uq_files_storage_key` — UNIQUE `UNIQUE (storage_key)`
- `ix_files_uploaded_by_user_id` — `btree (uploaded_by_user_id)`

</details>

### `mentor_credentials`

Documents sent with the mentor application: exactly one CV + any number of certificates / diplomas.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentor_id` | uuid |  |  | FK → `mentor_profiles(user_id) ON DELETE CASCADE` |  |
| `type` | text |  |  |  | `CV` · `CERTIFICATE` · `DIPLOMA` |
| `file_id` | uuid |  |  | FK → `files(id) ON DELETE RESTRICT` UNIQUE |  |
| `title` | text | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_mentor_credentials_type` — CHECK `CHECK ((type = ANY (ARRAY['CV'::text, 'CERTIFICATE'::text, 'DIPLOMA'::text])))`
- `uq_mentor_credentials_file_id` — UNIQUE `UNIQUE (file_id)`
- `ix_mentor_credentials_mentor_id` — `btree (mentor_id)`
- `uq_mentor_credentials_one_cv` — `btree (mentor_id) WHERE (type = 'CV'::text)` (unique)

</details>

### `domains`

Predefined fields (Marketing, IT…) used by profiles, search filters and top-3 matching.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `slug` | text |  |  | UNIQUE |  |
| `name` | text |  |  |  |  |
| `position` | smallint |  | `0` |  |  |
| `is_active` | boolean |  | `true` |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `uq_domains_slug` — UNIQUE `UNIQUE (slug)`

</details>

### `mentor_social_links`

Public links shown on the mentor profile.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentor_id` | uuid |  |  | FK → `mentor_profiles(user_id) ON DELETE CASCADE` |  |
| `platform` | text |  |  |  | `LINKEDIN` · `GITHUB` · `BEHANCE` · `DRIBBBLE` · `X` · `INSTAGRAM` · `WEBSITE` · `OTHER` |
| `url` | text |  |  |  |  |
| `position` | smallint |  | `0` |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_mentor_social_links_platform` — CHECK `CHECK ((platform = ANY (ARRAY['LINKEDIN'::text, 'GITHUB'::text, 'BEHANCE'::text, 'DRIBBBLE'::text, 'X'::text, 'INSTAGRAM'::text, 'WEBSITE'::text, 'OTHER'::text])))`
- `uq_mentor_social_links_mentor_url` — UNIQUE `UNIQUE (mentor_id, url)`

</details>

### `sponsors`

Partner companies that provide employees as free mentors. Managed by admin.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `name` | text |  |  |  |  |
| `slug` | text |  |  | UNIQUE |  |
| `logo_file_id` | uuid | yes |  | FK → `files(id) ON DELETE SET NULL` |  |
| `description` | text | yes |  |  |  |
| `website_url` | text | yes |  |  |  |
| `position` | smallint |  | `0` |  |  |
| `is_active` | boolean |  | `true` |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `uq_sponsors_slug` — UNIQUE `UNIQUE (slug)`

</details>

## Mentorship offer

### `mentorships`

The mentor's offer (one per mentor in MVP). Monthly discount is derived: 1 - monthly_price / (N * per_session_price).

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentor_id` | uuid |  |  | FK → `mentor_profiles(user_id) ON DELETE CASCADE` UNIQUE |  |
| `description` | text | yes |  |  |  |
| `conditions` | text | yes |  |  |  |
| `min_knowledge` | text | yes |  |  |  |
| `is_sponsored` | boolean |  | `false` |  |  |
| `per_session_price_bani` | integer | yes |  |  |  |
| `monthly_price_bani` | integer | yes |  |  |  |
| `monthly_sessions_count` | smallint | yes |  |  | N – sessions included per billing cycle; unused ones expire. |
| `session_duration_minutes` | smallint |  | `60` |  |  |
| `has_test` | boolean |  | `false` |  |  |
| `published_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_mentorships_duration` — CHECK `CHECK ((session_duration_minutes = ANY (ARRAY[30, 45, 60, 90])))`
- `ck_mentorships_monthly_pair` — CHECK `CHECK (((monthly_price_bani IS NULL) = (monthly_sessions_count IS NULL)))`
- `ck_mentorships_monthly_price` — CHECK `CHECK (((monthly_price_bani IS NULL) OR (monthly_price_bani > 0)))`
- `ck_mentorships_monthly_sessions_count` — CHECK `CHECK (((monthly_sessions_count IS NULL) OR (monthly_sessions_count > 0)))`
- `ck_mentorships_per_session_price` — CHECK `CHECK (((per_session_price_bani IS NULL) OR (per_session_price_bani > 0)))`
- `ck_mentorships_publishable` — CHECK `CHECK (((published_at IS NULL) OR ((description IS NOT NULL) AND (is_sponsored OR (per_session_price_bani IS NOT NULL) OR (monthly_price_bani IS NOT NULL)))))`
- `ck_mentorships_sponsored_is_free` — CHECK `CHECK (((NOT is_sponsored) OR ((per_session_price_bani IS NULL) AND (monthly_price_bani IS NULL))))`
- `uq_mentorships_mentor_id` — UNIQUE `UNIQUE (mentor_id)`
- `ix_mentorships_published` — `btree (published_at) WHERE (published_at IS NOT NULL)`

</details>

### `availability_slots`

Weekly recurring windows, Europe/Bucharest local time. ISO day: 1 = Monday. Overlaps prevented in the app.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentor_id` | uuid |  |  | FK → `mentor_profiles(user_id) ON DELETE CASCADE` |  |
| `day_of_week` | smallint |  |  |  |  |
| `start_time` | time |  |  |  |  |
| `end_time` | time |  |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_availability_slots_day_of_week` — CHECK `CHECK (((day_of_week >= 1) AND (day_of_week <= 7)))`
- `ck_availability_slots_time_order` — CHECK `CHECK ((end_time > start_time))`
- `ix_availability_slots_mentor_day` — `btree (mentor_id, day_of_week)`

</details>

### `mentorship_questions`

Mentor's application questions (max 3, enforced by position 1-3 + unique) and free-text test questions.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentorship_id` | uuid |  |  | FK → `mentorships(id) ON DELETE CASCADE` |  |
| `kind` | text |  |  |  | `APPLICATION` · `TEST` |
| `prompt` | text |  |  |  |  |
| `position` | smallint |  |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_mentorship_questions_kind` — CHECK `CHECK ((kind = ANY (ARRAY['APPLICATION'::text, 'TEST'::text])))`
- `ck_mentorship_questions_max_3_application` — CHECK `CHECK (((kind <> 'APPLICATION'::text) OR (("position" >= 1) AND ("position" <= 3))))`
- `ck_mentorship_questions_position` — CHECK `CHECK (("position" >= 1))`
- `uq_mentorship_questions_position` — UNIQUE `UNIQUE (mentorship_id, kind, "position")`

</details>

### `study_materials`

Files or links the test is based on. Visible only to logged-in mentees.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentorship_id` | uuid |  |  | FK → `mentorships(id) ON DELETE CASCADE` |  |
| `title` | text |  |  |  |  |
| `kind` | text |  |  |  | `FILE` · `LINK` |
| `file_id` | uuid | yes |  | FK → `files(id) ON DELETE RESTRICT` |  |
| `url` | text | yes |  |  |  |
| `position` | smallint |  | `0` |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_study_materials_kind` — CHECK `CHECK ((kind = ANY (ARRAY['FILE'::text, 'LINK'::text])))`
- `ck_study_materials_payload` — CHECK `CHECK ((((kind = 'FILE'::text) AND (file_id IS NOT NULL) AND (url IS NULL)) OR ((kind = 'LINK'::text) AND (url IS NOT NULL) AND (file_id IS NULL))))`
- `ix_study_materials_mentorship` — `btree (mentorship_id, "position")`

</details>

### `favourites`

Mentors saved by a mentee.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `mentee_id` | uuid |  |  | **PK** FK → `mentee_profiles(user_id) ON DELETE CASCADE` |  |
| `mentor_id` | uuid |  |  | **PK** FK → `mentor_profiles(user_id) ON DELETE CASCADE` |  |
| `created_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `pk_favourites` — PK `PRIMARY KEY (mentee_id, mentor_id)`
- `ix_favourites_mentor_id` — `btree (mentor_id)`

</details>

## Applications & enrolments

### `applications`

Mentee request to join a mentorship. Re-applying after rejection creates a new row; only one PENDING per mentee + mentorship.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentee_id` | uuid |  |  | FK → `mentee_profiles(user_id) ON DELETE CASCADE` |  |
| `mentorship_id` | uuid |  |  | FK → `mentorships(id) ON DELETE CASCADE` |  |
| `status` | text |  | `'PENDING'` |  | `PENDING` · `ACCEPTED` · `REJECTED` |
| `rejection_reason` | text | yes |  |  |  |
| `submitted_at` | timestamptz |  | `now()` |  |  |
| `decided_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_applications_decided_at` — CHECK `CHECK (((status = 'PENDING'::text) = (decided_at IS NULL)))`
- `ck_applications_rejection_reason` — CHECK `CHECK (((status <> 'REJECTED'::text) OR ((rejection_reason IS NOT NULL) AND (char_length(btrim(rejection_reason)) >= 30))))`
- `ck_applications_status` — CHECK `CHECK ((status = ANY (ARRAY['PENDING'::text, 'ACCEPTED'::text, 'REJECTED'::text])))`
- `ix_applications_mentee_submitted` — `btree (mentee_id, submitted_at DESC)`
- `ix_applications_mentorship_status` — `btree (mentorship_id, status)`
- `uq_applications_one_pending` — `btree (mentee_id, mentorship_id) WHERE (status = 'PENDING'::text)` (unique)

</details>

### `application_answers`

Answers to the mentor's application + test questions. Question kind/text are snapshots. Immutable.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `application_id` | uuid |  |  | FK → `applications(id) ON DELETE CASCADE` |  |
| `question_id` | uuid | yes |  | FK → `mentorship_questions(id) ON DELETE SET NULL` |  |
| `question_kind` | text |  |  |  | `APPLICATION` · `TEST` |
| `question_text` | text |  |  |  |  |
| `answer_text` | text |  |  |  |  |
| `position` | smallint |  |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_application_answers_kind` — CHECK `CHECK ((question_kind = ANY (ARRAY['APPLICATION'::text, 'TEST'::text])))`
- `uq_application_answers_question` — UNIQUE `UNIQUE (application_id, question_id)`
- `ix_application_answers_question_id` — `btree (question_id)`

</details>

### `application_mentee_questions`

Mentee's own optional questions (max 3) and the mentor's answers, given on the application page.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `application_id` | uuid |  |  | FK → `applications(id) ON DELETE CASCADE` |  |
| `position` | smallint |  |  |  |  |
| `question_text` | text |  |  |  |  |
| `mentor_answer` | text | yes |  |  |  |
| `answered_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_application_mentee_questions_answered` — CHECK `CHECK (((mentor_answer IS NULL) = (answered_at IS NULL)))`
- `ck_application_mentee_questions_position` — CHECK `CHECK ((("position" >= 1) AND ("position" <= 3)))`
- `uq_application_mentee_questions_position` — UNIQUE `UNIQUE (application_id, "position")`

</details>

### `enrolments`

Mentee enrolled in a mentorship (per session, monthly or sponsored). Groups, sessions, progress and reviews hang off it.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentee_id` | uuid |  |  | FK → `mentee_profiles(user_id)` |  |
| `mentorship_id` | uuid |  |  | FK → `mentorships(id)` |  |
| `application_id` | uuid |  |  | FK → `applications(id)` UNIQUE |  |
| `plan` | text |  |  |  | `PER_SESSION` · `MONTHLY` · `SPONSORED` |
| `status` | text |  | `'PENDING_PAYMENT'` |  | `PENDING_PAYMENT` · `ACTIVE` · `ENDED` |
| `started_at` | timestamptz | yes |  |  |  |
| `ended_at` | timestamptz | yes |  |  |  |
| `ended_by` | text | yes |  |  |  |
| `end_reason` | text | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_enrolments_ended` — CHECK `CHECK (((status = 'ENDED'::text) = (ended_at IS NOT NULL)))`
- `ck_enrolments_ended_by` — CHECK `CHECK (((ended_by IS NULL) OR (ended_by = ANY (ARRAY['MENTEE'::text, 'MENTOR'::text, 'SYSTEM'::text, 'ADMIN'::text]))))`
- `ck_enrolments_plan` — CHECK `CHECK ((plan = ANY (ARRAY['PER_SESSION'::text, 'MONTHLY'::text, 'SPONSORED'::text])))`
- `ck_enrolments_started` — CHECK `CHECK (((status <> 'ACTIVE'::text) OR (started_at IS NOT NULL)))`
- `ck_enrolments_status` — CHECK `CHECK ((status = ANY (ARRAY['PENDING_PAYMENT'::text, 'ACTIVE'::text, 'ENDED'::text])))`
- `uq_enrolments_application_id` — UNIQUE `UNIQUE (application_id)`
- `ix_enrolments_mentee_status` — `btree (mentee_id, status)`
- `ix_enrolments_mentorship_status` — `btree (mentorship_id, status)`
- `uq_enrolments_one_live` — `btree (mentee_id, mentorship_id) WHERE (status <> 'ENDED'::text)` (unique)

</details>

### `subscriptions`

Mirror of the Stripe subscription for MONTHLY enrolments. price/N are snapshots taken at sign-up.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `enrolment_id` | uuid |  |  | FK → `enrolments(id) ON DELETE CASCADE` UNIQUE |  |
| `stripe_subscription_id` | text |  |  | UNIQUE |  |
| `status` | text |  |  |  | `INCOMPLETE` · `ACTIVE` · `PAST_DUE` · `CANCELED` |
| `price_bani` | integer |  |  |  |  |
| `sessions_per_period` | smallint |  |  |  |  |
| `current_period_start` | timestamptz |  |  |  |  |
| `current_period_end` | timestamptz |  |  |  |  |
| `cancel_at_period_end` | boolean |  | `false` |  |  |
| `canceled_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_subscriptions_canceled` — CHECK `CHECK (((status <> 'CANCELED'::text) OR (canceled_at IS NOT NULL)))`
- `ck_subscriptions_period` — CHECK `CHECK ((current_period_end > current_period_start))`
- `ck_subscriptions_price` — CHECK `CHECK ((price_bani > 0))`
- `ck_subscriptions_sessions` — CHECK `CHECK ((sessions_per_period > 0))`
- `ck_subscriptions_status` — CHECK `CHECK ((status = ANY (ARRAY['INCOMPLETE'::text, 'ACTIVE'::text, 'PAST_DUE'::text, 'CANCELED'::text])))`
- `uq_subscriptions_enrolment_id` — UNIQUE `UNIQUE (enrolment_id)`
- `uq_subscriptions_stripe_id` — UNIQUE `UNIQUE (stripe_subscription_id)`

</details>

## Scheduling

### `sessions`

Every call: FREE_CALL (linked to application), PAID or SPONSORED (linked to enrolment). No cancellation. EXCLUDE constraints prevent double-booking of mentor and mentee.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `type` | text |  |  |  | `FREE_CALL` · `PAID` · `SPONSORED` |
| `status` | text |  | `'SCHEDULED'` |  | `SCHEDULED` · `HELD` |
| `mentor_id` | uuid |  |  | FK → `mentor_profiles(user_id)` |  |
| `mentee_id` | uuid |  |  | FK → `mentee_profiles(user_id)` |  |
| `enrolment_id` | uuid | yes |  | FK → `enrolments(id)` |  |
| `application_id` | uuid | yes |  | FK → `applications(id)` |  |
| `starts_at` | timestamptz |  |  |  |  |
| `ends_at` | timestamptz |  |  |  |  |
| `subscription_id` | uuid | yes |  | FK → `subscriptions(id)` |  |
| `billing_period_start` | timestamptz | yes |  |  | Monthly plans: the billing cycle this session consumes (kept even when rescheduled). |
| `meet_url` | text | yes |  |  |  |
| `google_event_id` | text | yes |  | UNIQUE |  |
| `meet_sync_status` | text |  | `'PENDING'` |  | `PENDING` · `OK` · `FAILED` |
| `held_at` | timestamptz | yes |  |  | Set by the job once ends_at has passed (a non-cancelled session is considered held). |
| `payout_excluded_at` | timestamptz | yes |  |  |  |
| `payout_exclusion_reason` | text | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_sessions_held` — CHECK `CHECK (((status = 'HELD'::text) = (held_at IS NOT NULL)))`
- `ck_sessions_link` — CHECK `CHECK ((((type = 'FREE_CALL'::text) AND (application_id IS NOT NULL) AND (enrolment_id IS NULL)) OR ((type <> 'FREE_CALL'::text) AND (enrolment_id IS NOT NULL) AND (application_id IS NULL))))`
- `ck_sessions_meet_sync_status` — CHECK `CHECK ((meet_sync_status = ANY (ARRAY['PENDING'::text, 'OK'::text, 'FAILED'::text])))`
- `ck_sessions_payout_exclusion` — CHECK `CHECK (((payout_excluded_at IS NULL) OR (payout_exclusion_reason IS NOT NULL)))`
- `ck_sessions_status` — CHECK `CHECK ((status = ANY (ARRAY['SCHEDULED'::text, 'HELD'::text])))`
- `ck_sessions_subscription_only_paid` — CHECK `CHECK (((subscription_id IS NULL) OR (type = 'PAID'::text)))`
- `ck_sessions_subscription_pair` — CHECK `CHECK (((subscription_id IS NULL) = (billing_period_start IS NULL)))`
- `ck_sessions_time_order` — CHECK `CHECK ((ends_at > starts_at))`
- `ck_sessions_type` — CHECK `CHECK ((type = ANY (ARRAY['FREE_CALL'::text, 'PAID'::text, 'SPONSORED'::text])))`
- `uq_sessions_google_event_id` — UNIQUE `UNIQUE (google_event_id)`
- `ex_sessions_mentee_no_overlap` — EXCLUDE `EXCLUDE USING gist (mentee_id WITH =, tstzrange(starts_at, ends_at) WITH &&)`
- `ex_sessions_mentor_no_overlap` — EXCLUDE `EXCLUDE USING gist (mentor_id WITH =, tstzrange(starts_at, ends_at) WITH &&)`
- `ix_sessions_application_id` — `btree (application_id)`
- `ix_sessions_enrolment_starts` — `btree (enrolment_id, starts_at)`
- `ix_sessions_mentee_starts` — `btree (mentee_id, starts_at)`
- `ix_sessions_mentor_starts` — `btree (mentor_id, starts_at)`
- `ix_sessions_status_ends_at` — `btree (status, ends_at)`
- `ix_sessions_subscription_period` — `btree (subscription_id, billing_period_start)`

</details>

### `session_reschedules`

Append-only history of reschedules (either party, any time).

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `session_id` | uuid |  |  | FK → `sessions(id) ON DELETE CASCADE` |  |
| `rescheduled_by_user_id` | uuid | yes |  | FK → `users(id) ON DELETE SET NULL` |  |
| `old_starts_at` | timestamptz |  |  |  |  |
| `old_ends_at` | timestamptz |  |  |  |  |
| `new_starts_at` | timestamptz |  |  |  |  |
| `new_ends_at` | timestamptz |  |  |  |  |
| `reason` | text | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_session_reschedules_new_order` — CHECK `CHECK ((new_ends_at > new_starts_at))`
- `ck_session_reschedules_old_order` — CHECK `CHECK ((old_ends_at > old_starts_at))`
- `ix_session_reschedules_session` — `btree (session_id, created_at)`

</details>

### `session_reminders`

Reminder per recipient per offset (default 24h and 1h). Unsent rows are recreated on reschedule.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `session_id` | uuid |  |  | FK → `sessions(id) ON DELETE CASCADE` |  |
| `user_id` | uuid |  |  | FK → `users(id) ON DELETE CASCADE` |  |
| `offset_minutes` | integer |  |  |  |  |
| `send_at` | timestamptz |  |  |  |  |
| `sent_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_session_reminders_offset` — CHECK `CHECK ((offset_minutes > 0))`
- `uq_session_reminders` — UNIQUE `UNIQUE (session_id, user_id, offset_minutes)`
- `ix_session_reminders_due` — `btree (send_at) WHERE (sent_at IS NULL)`

</details>

## Payments

### `payments`

Money in: per-session charges and monthly invoices. "Held" (escrow) = SUCCEEDED and not yet in a payout_item.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentee_id` | uuid |  |  | FK → `mentee_profiles(user_id)` |  |
| `mentor_id` | uuid |  |  | FK → `mentor_profiles(user_id)` |  |
| `enrolment_id` | uuid |  |  | FK → `enrolments(id)` |  |
| `kind` | text |  |  |  | `SESSION` · `SUBSCRIPTION_INVOICE` |
| `session_id` | uuid | yes |  | FK → `sessions(id) ON DELETE SET NULL` UNIQUE |  |
| `subscription_id` | uuid | yes |  | FK → `subscriptions(id)` |  |
| `period_start` | timestamptz | yes |  |  |  |
| `period_end` | timestamptz | yes |  |  |  |
| `amount_bani` | integer |  |  |  |  |
| `commission_rate` | numeric(5,4) |  |  |  | Snapshot of the platform commission (env config) when the payment was made, e.g. 0.1500. |
| `commission_bani` | integer |  |  |  |  |
| `refunded_bani` | integer |  | `0` |  |  |
| `currency` | char(3) |  | `'RON'::bpchar` |  |  |
| `status` | text |  | `'PENDING'` |  | `PENDING` · `SUCCEEDED` · `FAILED` · `REFUNDED` · `PARTIALLY_REFUNDED` |
| `stripe_payment_intent_id` | text | yes |  | UNIQUE |  |
| `stripe_invoice_id` | text | yes |  | UNIQUE |  |
| `paid_at` | timestamptz | yes |  |  |  |
| `refunded_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_payments_amount` — CHECK `CHECK ((amount_bani > 0))`
- `ck_payments_commission` — CHECK `CHECK (((commission_bani >= 0) AND (commission_bani <= amount_bani)))`
- `ck_payments_commission_rate` — CHECK `CHECK (((commission_rate >= (0)::numeric) AND (commission_rate <= (1)::numeric)))`
- `ck_payments_currency` — CHECK `CHECK ((currency = 'RON'::bpchar))`
- `ck_payments_kind` — CHECK `CHECK ((kind = ANY (ARRAY['SESSION'::text, 'SUBSCRIPTION_INVOICE'::text])))`
- `ck_payments_kind_refs` — CHECK `CHECK ((((kind = 'SESSION'::text) AND (subscription_id IS NULL) AND (period_start IS NULL) AND (period_end IS NULL) AND ((session_id IS NOT NULL) OR (status = 'FAILED'::text))) OR ((kind = 'SUBSCRIPTION_INVOICE'::text) AND (session_id IS NULL) AND (subscription_id IS NOT NULL) AND (period_start IS NOT NULL) AND (period_end IS NOT NULL) AND (period_end > period_start))))`
- `ck_payments_paid_at` — CHECK `CHECK (((status = ANY (ARRAY['PENDING'::text, 'FAILED'::text])) OR (paid_at IS NOT NULL)))`
- `ck_payments_refunded` — CHECK `CHECK (((refunded_bani >= 0) AND (refunded_bani <= amount_bani)))`
- `ck_payments_status` — CHECK `CHECK ((status = ANY (ARRAY['PENDING'::text, 'SUCCEEDED'::text, 'FAILED'::text, 'REFUNDED'::text, 'PARTIALLY_REFUNDED'::text])))`
- `uq_payments_session_id` — UNIQUE `UNIQUE (session_id)`
- `uq_payments_stripe_invoice_id` — UNIQUE `UNIQUE (stripe_invoice_id)`
- `uq_payments_stripe_payment_intent_id` — UNIQUE `UNIQUE (stripe_payment_intent_id)`
- `ix_payments_enrolment_id` — `btree (enrolment_id)`
- `ix_payments_mentee_created` — `btree (mentee_id, created_at DESC)`
- `ix_payments_mentor_status` — `btree (mentor_id, status)`
- `ix_payments_subscription_id` — `btree (subscription_id)`

</details>

### `payouts`

Twice-a-month Stripe Connect transfer to a mentor for sessions held in the period, minus commission.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentor_id` | uuid |  |  | FK → `mentor_profiles(user_id)` |  |
| `period_start` | date |  |  |  |  |
| `period_end` | date |  |  |  |  |
| `gross_bani` | integer |  |  |  |  |
| `commission_bani` | integer |  |  |  |  |
| `net_bani` | integer |  |  |  |  |
| `status` | text |  | `'PENDING'` |  | `PENDING` · `PAID` · `FAILED` |
| `stripe_transfer_id` | text | yes |  | UNIQUE |  |
| `paid_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_payouts_amounts` — CHECK `CHECK (((gross_bani >= 0) AND (commission_bani >= 0) AND (net_bani >= 0)))`
- `ck_payouts_net` — CHECK `CHECK ((net_bani = (gross_bani - commission_bani)))`
- `ck_payouts_paid` — CHECK `CHECK (((status <> 'PAID'::text) OR (paid_at IS NOT NULL)))`
- `ck_payouts_period` — CHECK `CHECK ((period_end >= period_start))`
- `ck_payouts_status` — CHECK `CHECK ((status = ANY (ARRAY['PENDING'::text, 'PAID'::text, 'FAILED'::text])))`
- `uq_payouts_mentor_period` — UNIQUE `UNIQUE (mentor_id, period_start)`
- `uq_payouts_stripe_transfer_id` — UNIQUE `UNIQUE (stripe_transfer_id)`

</details>

### `payout_items`

One row per held session included in a payout. Subscription sessions are valued at invoice / N. Free and sponsored sessions never appear.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `payout_id` | uuid |  |  | FK → `payouts(id) ON DELETE CASCADE` |  |
| `session_id` | uuid |  |  | FK → `sessions(id)` UNIQUE |  |
| `payment_id` | uuid |  |  | FK → `payments(id)` |  |
| `gross_bani` | integer |  |  |  |  |
| `commission_bani` | integer |  |  |  |  |
| `net_bani` | integer |  |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_payout_items_amounts` — CHECK `CHECK (((gross_bani >= 0) AND (commission_bani >= 0) AND (net_bani >= 0)))`
- `ck_payout_items_net` — CHECK `CHECK ((net_bani = (gross_bani - commission_bani)))`
- `uq_payout_items_session_id` — UNIQUE `UNIQUE (session_id)`
- `ix_payout_items_payment_id` — `btree (payment_id)`
- `ix_payout_items_payout_id` — `btree (payout_id)`

</details>

### `stripe_webhook_events`

Idempotency log: PK is the Stripe event id (evt_...), so each event is handled once.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | text |  |  | **PK** |  |
| `type` | text |  |  |  |  |
| `payload` | jsonb |  |  |  |  |
| `received_at` | timestamptz |  | `now()` |  |  |
| `processed_at` | timestamptz | yes |  |  |  |
| `error` | text | yes |  |  |  |

<details><summary>Constraints & indexes</summary>

- `ix_stripe_webhook_events_unprocessed` — `btree (received_at) WHERE (processed_at IS NULL)`

</details>

## Communication & notifications

### `messaging_groups`

External groups created through the messaging provider API: PRIVATE (per enrolment) and COHORT (per mentor). Provider not decided yet.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `provider` | text |  |  |  |  |
| `type` | text |  |  |  | `PRIVATE` · `COHORT` |
| `enrolment_id` | uuid | yes |  | FK → `enrolments(id) ON DELETE CASCADE` UNIQUE |  |
| `mentor_id` | uuid | yes |  | FK → `mentor_profiles(user_id) ON DELETE CASCADE` |  |
| `external_id` | text | yes |  |  |  |
| `invite_url` | text | yes |  |  |  |
| `sync_status` | text |  | `'PENDING'` |  | `PENDING` · `OK` · `FAILED` |
| `archived_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_messaging_groups_owner` — CHECK `CHECK ((((type = 'PRIVATE'::text) AND (enrolment_id IS NOT NULL) AND (mentor_id IS NULL)) OR ((type = 'COHORT'::text) AND (mentor_id IS NOT NULL) AND (enrolment_id IS NULL))))`
- `ck_messaging_groups_sync_status` — CHECK `CHECK ((sync_status = ANY (ARRAY['PENDING'::text, 'OK'::text, 'FAILED'::text])))`
- `ck_messaging_groups_type` — CHECK `CHECK ((type = ANY (ARRAY['PRIVATE'::text, 'COHORT'::text])))`
- `uq_messaging_groups_enrolment_id` — UNIQUE `UNIQUE (enrolment_id)`
- `uq_messaging_groups_external` — UNIQUE `UNIQUE (provider, external_id)`
- `uq_messaging_groups_one_live_cohort` — `btree (mentor_id) WHERE ((type = 'COHORT'::text) AND (archived_at IS NULL))` (unique)

</details>

### `messaging_group_members`

Group membership history (cohort membership changes as mentorships start and end).

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `group_id` | uuid |  |  | FK → `messaging_groups(id) ON DELETE CASCADE` |  |
| `user_id` | uuid |  |  | FK → `users(id) ON DELETE CASCADE` |  |
| `role` | text |  | `'MEMBER'` |  | `OWNER` · `MEMBER` |
| `invited_at` | timestamptz |  | `now()` |  |  |
| `joined_at` | timestamptz | yes |  |  |  |
| `removed_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_messaging_group_members_role` — CHECK `CHECK ((role = ANY (ARRAY['OWNER'::text, 'MEMBER'::text])))`
- `ix_messaging_group_members_user_id` — `btree (user_id)`
- `uq_messaging_group_members_active` — `btree (group_id, user_id) WHERE (removed_at IS NULL)` (unique)

</details>

### `notifications`

In-app notification bell. Every transactional email event also creates one.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `user_id` | uuid |  |  | FK → `users(id) ON DELETE CASCADE` |  |
| `type` | text |  |  |  | `MENTOR_APPROVED` · `MENTOR_REJECTED` · `APPLICATION_RECEIVED` · `APPLICATION_QUESTIONS_ANSWERED` · `APPLICATION_ACCEPTED` · `APPLICATION_REJECTED` · `FREE_CALL_SCHEDULED` · `ENROLMENT_CONFIRMED` · `SESSION_SCHEDULED` · `SESSION_REMINDER` · `SESSION_RESCHEDULED` · `EVALUATION_CREATED` · `PROJECT_ASSIGNED` · `PROJECT_SUBMITTED` · `PROJECT_FEEDBACK` · `PAYOUT_SENT` · `SUBSCRIPTION_RENEWED` · `PAYMENT_FAILED` · `RATING_REQUESTED` · `REVIEW_REQUESTED` · `SPONSORED_PROGRAM_DECIDED` |
| `title` | text |  |  |  |  |
| `body` | text | yes |  |  |  |
| `link_path` | text | yes |  |  |  |
| `entity_type` | text | yes |  |  |  |
| `entity_id` | uuid | yes |  |  |  |
| `data` | jsonb |  | `'{}'::jsonb` |  |  |
| `read_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_notifications_entity` — CHECK `CHECK (((entity_type IS NULL) = (entity_id IS NULL)))`
- `ck_notifications_type` — CHECK `CHECK ((type = ANY (ARRAY['MENTOR_APPROVED'::text, 'MENTOR_REJECTED'::text, 'APPLICATION_RECEIVED'::text, 'APPLICATION_QUESTIONS_ANSWERED'::text, 'APPLICATION_ACCEPTED'::text, 'APPLICATION_REJECTED'::text, 'FREE_CALL_SCHEDULED'::text, 'ENROLMENT_CONFIRMED'::text, 'SESSION_SCHEDULED'::text, 'SESSION_REMINDER'::text, 'SESSION_RESCHEDULED'::text, 'EVALUATION_CREATED'::text, 'PROJECT_ASSIGNED'::text, 'PROJECT_SUBMITTED'::text, 'PROJECT_FEEDBACK'::text, 'PAYOUT_SENT'::text, 'SUBSCRIPTION_RENEWED'::text, 'PAYMENT_FAILED'::text, 'RATING_REQUESTED'::text, 'REVIEW_REQUESTED'::text, 'SPONSORED_PROGRAM_DECIDED'::text])))`
- `ix_notifications_user_created` — `btree (user_id, created_at DESC)`
- `ix_notifications_user_unread` — `btree (user_id) WHERE (read_at IS NULL)`

</details>

### `email_outbox`

Transactional email queue + log (Romanian templates), with retry bookkeeping.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `user_id` | uuid | yes |  | FK → `users(id) ON DELETE SET NULL` |  |
| `notification_id` | uuid | yes |  | FK → `notifications(id) ON DELETE SET NULL` |  |
| `to_email` | text |  |  |  |  |
| `template` | text |  |  |  |  |
| `payload` | jsonb |  | `'{}'::jsonb` |  |  |
| `status` | text |  | `'PENDING'` |  | `PENDING` · `SENT` · `FAILED` |
| `attempts` | smallint |  | `0` |  |  |
| `last_error` | text | yes |  |  |  |
| `send_after` | timestamptz |  | `now()` |  |  |
| `sent_at` | timestamptz | yes |  |  |  |
| `provider_message_id` | text | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_email_outbox_attempts` — CHECK `CHECK ((attempts >= 0))`
- `ck_email_outbox_sent` — CHECK `CHECK (((status <> 'SENT'::text) OR (sent_at IS NOT NULL)))`
- `ck_email_outbox_status` — CHECK `CHECK ((status = ANY (ARRAY['PENDING'::text, 'SENT'::text, 'FAILED'::text])))`
- `ix_email_outbox_pending` — `btree (send_after) WHERE (status = 'PENDING'::text)`
- `ix_email_outbox_user_id` — `btree (user_id)`

</details>

## Progress

### `evaluations`

Mentor's periodic evaluation: grade(s), detailed explanation, next focus steps.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `enrolment_id` | uuid |  |  | FK → `enrolments(id) ON DELETE CASCADE` |  |
| `overall_score` | numeric(4,1) | yes |  |  |  |
| `scale_max` | smallint |  | `10` |  |  |
| `explanation` | text |  |  |  |  |
| `next_steps` | text |  |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_evaluations_overall_score` — CHECK `CHECK (((overall_score IS NULL) OR ((overall_score >= (0)::numeric) AND (overall_score <= (scale_max)::numeric))))`
- `ck_evaluations_scale_max` — CHECK `CHECK ((scale_max > 0))`
- `ix_evaluations_enrolment_created` — `btree (enrolment_id, created_at DESC)`

</details>

### `evaluation_scores`

Named sub-grades of an evaluation (score <= scale_max checked in the app).

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `evaluation_id` | uuid |  |  | FK → `evaluations(id) ON DELETE CASCADE` |  |
| `criterion` | text |  |  |  |  |
| `score` | numeric(4,1) |  |  |  |  |
| `comment` | text | yes |  |  |  |
| `position` | smallint |  | `0` |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_evaluation_scores_score` — CHECK `CHECK ((score >= (0)::numeric))`
- `uq_evaluation_scores_criterion` — UNIQUE `UNIQUE (evaluation_id, criterion)`

</details>

### `projects`

Individual project: IN_PROGRESS -> SUBMITTED (link or file) -> REVIEWED (feedback). Included in the mentorship.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `enrolment_id` | uuid |  |  | FK → `enrolments(id) ON DELETE CASCADE` |  |
| `title` | text |  |  |  |  |
| `description` | text |  |  |  |  |
| `due_at` | timestamptz | yes |  |  |  |
| `status` | text |  | `'IN_PROGRESS'` |  | `IN_PROGRESS` · `SUBMITTED` · `REVIEWED` |
| `submission_url` | text | yes |  |  |  |
| `submission_file_id` | uuid | yes |  | FK → `files(id) ON DELETE SET NULL` |  |
| `submitted_at` | timestamptz | yes |  |  |  |
| `feedback` | text | yes |  |  |  |
| `reviewed_at` | timestamptz | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_projects_review` — CHECK `CHECK (((status <> 'REVIEWED'::text) OR ((feedback IS NOT NULL) AND (reviewed_at IS NOT NULL))))`
- `ck_projects_status` — CHECK `CHECK ((status = ANY (ARRAY['IN_PROGRESS'::text, 'SUBMITTED'::text, 'REVIEWED'::text])))`
- `ck_projects_submission` — CHECK `CHECK (((status = 'IN_PROGRESS'::text) OR (((submission_url IS NOT NULL) OR (submission_file_id IS NOT NULL)) AND (submitted_at IS NOT NULL))))`
- `ix_projects_enrolment_status` — `btree (enrolment_id, status)`

</details>

### `goals`

Goal checklist per enrolment; either party may create / tick (open question).

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `enrolment_id` | uuid |  |  | FK → `enrolments(id) ON DELETE CASCADE` |  |
| `text` | text |  |  |  |  |
| `created_by_user_id` | uuid | yes |  | FK → `users(id) ON DELETE SET NULL` |  |
| `completed_at` | timestamptz | yes |  |  |  |
| `completed_by_user_id` | uuid | yes |  | FK → `users(id) ON DELETE SET NULL` |  |
| `position` | smallint |  | `0` |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_goals_completed_by` — CHECK `CHECK (((completed_by_user_id IS NULL) OR (completed_at IS NOT NULL)))`
- `ix_goals_enrolment_position` — `btree (enrolment_id, "position")`

</details>

## Ratings & reviews

### `session_ratings`

Quick 1-5 star rating after each held session (one per session).

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `session_id` | uuid |  |  | **PK** FK → `sessions(id) ON DELETE CASCADE` |  |
| `mentee_id` | uuid |  |  | FK → `mentee_profiles(user_id)` |  |
| `mentor_id` | uuid |  |  | FK → `mentor_profiles(user_id)` |  |
| `stars` | smallint |  |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_session_ratings_stars` — CHECK `CHECK (((stars >= 1) AND (stars <= 5)))`
- `ix_session_ratings_mentor_id` — `btree (mentor_id)`

</details>

### `reviews`

Detailed review (4 categories x stars + mandatory text), one per enrolment, editable, no mentor reply, no moderation.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `enrolment_id` | uuid |  |  | FK → `enrolments(id) ON DELETE CASCADE` UNIQUE |  |
| `mentee_id` | uuid |  |  | FK → `mentee_profiles(user_id)` |  |
| `mentor_id` | uuid |  |  | FK → `mentor_profiles(user_id)` |  |
| `communication_stars` | smallint |  |  |  |  |
| `communication_text` | text |  |  |  |  |
| `expertise_stars` | smallint |  |  |  |  |
| `expertise_text` | text |  |  |  |  |
| `punctuality_stars` | smallint |  |  |  |  |
| `punctuality_text` | text |  |  |  |  |
| `impact_stars` | smallint |  |  |  |  |
| `impact_text` | text |  |  |  |  |
| `overall_score` | numeric(3,2) | yes | `GENERATED: round((((((communication_stars + expertise_stars) + punctuality_stars) + impact_stars))::numeric / (4)::numeric), 2)` |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_reviews_stars` — CHECK `CHECK ((((communication_stars >= 1) AND (communication_stars <= 5)) AND ((expertise_stars >= 1) AND (expertise_stars <= 5)) AND ((punctuality_stars >= 1) AND (punctuality_stars <= 5)) AND ((impact_stars >= 1) AND (impact_stars <= 5))))`
- `ck_reviews_texts` — CHECK `CHECK (((char_length(btrim(communication_text)) >= 10) AND (char_length(btrim(expertise_text)) >= 10) AND (char_length(btrim(punctuality_text)) >= 10) AND (char_length(btrim(impact_text)) >= 10)))`
- `uq_reviews_enrolment_id` — UNIQUE `UNIQUE (enrolment_id)`
- `ix_reviews_mentee_id` — `btree (mentee_id)`
- `ix_reviews_mentor_created` — `btree (mentor_id, created_at DESC)`

</details>

### `mentor_rating_stats`

Cached aggregates for search sorting and top-3 matching; updated by the app in the same transaction as review / rating writes. avg_overall NULL = "new" mentor.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `mentor_id` | uuid |  |  | **PK** FK → `mentor_profiles(user_id) ON DELETE CASCADE` |  |
| `review_count` | integer |  | `0` |  |  |
| `avg_overall` | numeric(3,2) | yes |  |  |  |
| `avg_communication` | numeric(3,2) | yes |  |  |  |
| `avg_expertise` | numeric(3,2) | yes |  |  |  |
| `avg_punctuality` | numeric(3,2) | yes |  |  |  |
| `avg_impact` | numeric(3,2) | yes |  |  |  |
| `session_rating_count` | integer |  | `0` |  |  |
| `avg_session_stars` | numeric(3,2) | yes |  |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_mentor_rating_stats_counts` — CHECK `CHECK (((review_count >= 0) AND (session_rating_count >= 0)))`
- `ix_mentor_rating_stats_avg_overall` — `btree (avg_overall DESC NULLS LAST)`

</details>

## Sponsored program, content & ops

### `sponsored_program_applications`

Applications to the free sponsored program; admin selects manually. A mentee with a SELECTED row is a beneficiary.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `mentee_id` | uuid |  |  | FK → `mentee_profiles(user_id) ON DELETE CASCADE` |  |
| `answers` | jsonb |  | `'{}'::jsonb` |  |  |
| `status` | text |  | `'IN_REVIEW'` |  | `IN_REVIEW` · `SELECTED` · `NOT_SELECTED` |
| `decided_at` | timestamptz | yes |  |  |  |
| `decision_note` | text | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_sponsored_program_applications_answers` — CHECK `CHECK ((jsonb_typeof(answers) = 'object'::text))`
- `ck_sponsored_program_applications_decided` — CHECK `CHECK (((status = 'IN_REVIEW'::text) = (decided_at IS NULL)))`
- `ck_sponsored_program_applications_status` — CHECK `CHECK ((status = ANY (ARRAY['IN_REVIEW'::text, 'SELECTED'::text, 'NOT_SELECTED'::text])))`
- `ix_sponsored_program_applications_status` — `btree (status, created_at)`
- `uq_sponsored_program_applications_one_open` — `btree (mentee_id) WHERE (status = 'IN_REVIEW'::text)` (unique)

</details>

### `faq_items`

Public FAQ, editable without a deploy. Answers are markdown.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `category` | text |  |  |  | `PLATFORM` · `MENTORSHIP_PROCESS` · `BECOME_MENTOR` · `PAYMENTS` |
| `question` | text |  |  |  |  |
| `answer` | text |  |  |  |  |
| `position` | smallint |  | `0` |  |  |
| `is_published` | boolean |  | `true` |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_faq_items_category` — CHECK `CHECK ((category = ANY (ARRAY['PLATFORM'::text, 'MENTORSHIP_PROCESS'::text, 'BECOME_MENTOR'::text, 'PAYMENTS'::text])))`
- `ix_faq_items_category_position` — `btree (category, "position")`

</details>

### `platform_testimonials`

Landing-page testimonials about Mentorly, curated by the team.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `author_name` | text |  |  |  |  |
| `author_role` | text | yes |  |  |  |
| `photo_file_id` | uuid | yes |  | FK → `files(id) ON DELETE SET NULL` |  |
| `quote` | text |  |  |  |  |
| `rating` | smallint | yes |  |  |  |
| `position` | smallint |  | `0` |  |  |
| `is_published` | boolean |  | `true` |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |
| `updated_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ck_platform_testimonials_rating` — CHECK `CHECK (((rating IS NULL) OR ((rating >= 1) AND (rating <= 5))))`

</details>

### `admin_audit_log`

Append-only log of manual admin operations (no admin UI in MVP). actor = admin email/name.

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | uuid |  | `gen_random_uuid()` | **PK** |  |
| `actor` | text |  |  |  |  |
| `action` | text |  |  |  |  |
| `entity_type` | text |  |  |  |  |
| `entity_id` | text |  |  |  |  |
| `before` | jsonb | yes |  |  |  |
| `after` | jsonb | yes |  |  |  |
| `note` | text | yes |  |  |  |
| `created_at` | timestamptz |  | `now()` |  |  |

<details><summary>Constraints & indexes</summary>

- `ix_admin_audit_log_created` — `btree (created_at DESC)`
- `ix_admin_audit_log_entity` — `btree (entity_type, entity_id)`

</details>

