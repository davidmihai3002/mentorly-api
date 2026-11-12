import { MigrationInterface, QueryRunner } from 'typeorm';

const updatedAtTrigger = (table: string) => `
  CREATE TRIGGER trg_${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at()
`;

/**
 * Progress (evaluations, evaluation_scores, projects, goals) and
 * reputation (session_ratings, reviews, mentor_rating_stats).
 */
export class CreateProgressAndReviews1794441607000 implements MigrationInterface {
  name = 'CreateProgressAndReviews1794441607000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------ evaluations
    await queryRunner.query(`
      CREATE TABLE evaluations (
        id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        enrolment_id   uuid          NOT NULL REFERENCES enrolments (id) ON DELETE CASCADE,
        overall_score  numeric(4,1)  NULL,
        scale_max      smallint      NOT NULL DEFAULT 10,
        explanation    text          NOT NULL,
        next_steps     text          NOT NULL,
        created_at     timestamptz   NOT NULL DEFAULT now(),
        updated_at     timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT ck_evaluations_scale_max CHECK (scale_max > 0),
        CONSTRAINT ck_evaluations_overall_score
          CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= scale_max))
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_evaluations_enrolment_created ON evaluations (enrolment_id, created_at DESC)`);
    await queryRunner.query(updatedAtTrigger('evaluations'));
    await queryRunner.query(`COMMENT ON TABLE evaluations IS 'Mentor''s periodic evaluation: grade(s), detailed explanation, next focus steps.'`);

    // ------------------------------------------------------ evaluation_scores
    await queryRunner.query(`
      CREATE TABLE evaluation_scores (
        id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        evaluation_id  uuid          NOT NULL REFERENCES evaluations (id) ON DELETE CASCADE,
        criterion      text          NOT NULL,
        score          numeric(4,1)  NOT NULL,
        comment        text          NULL,
        position       smallint      NOT NULL DEFAULT 0,
        created_at     timestamptz   NOT NULL DEFAULT now(),
        updated_at     timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT ck_evaluation_scores_score CHECK (score >= 0),
        CONSTRAINT uq_evaluation_scores_criterion UNIQUE (evaluation_id, criterion)
      )
    `);
    await queryRunner.query(updatedAtTrigger('evaluation_scores'));
    await queryRunner.query(`COMMENT ON TABLE evaluation_scores IS 'Named sub-grades of an evaluation (score <= scale_max checked in the app).'`);

    // --------------------------------------------------------------- projects
    await queryRunner.query(`
      CREATE TABLE projects (
        id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        enrolment_id        uuid        NOT NULL REFERENCES enrolments (id) ON DELETE CASCADE,
        title               text        NOT NULL,
        description         text        NOT NULL,
        due_at              timestamptz NULL,
        status              text        NOT NULL DEFAULT 'IN_PROGRESS',
        submission_url      text        NULL,
        submission_file_id  uuid        NULL REFERENCES files (id) ON DELETE SET NULL,
        submitted_at        timestamptz NULL,
        feedback            text        NULL,
        reviewed_at         timestamptz NULL,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_projects_status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'REVIEWED')),
        CONSTRAINT ck_projects_submission CHECK (
          status = 'IN_PROGRESS'
          OR ((submission_url IS NOT NULL OR submission_file_id IS NOT NULL) AND submitted_at IS NOT NULL)
        ),
        CONSTRAINT ck_projects_review CHECK (
          status <> 'REVIEWED' OR (feedback IS NOT NULL AND reviewed_at IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_projects_enrolment_status ON projects (enrolment_id, status)`);
    await queryRunner.query(updatedAtTrigger('projects'));
    await queryRunner.query(`COMMENT ON TABLE projects IS 'Individual project: IN_PROGRESS -> SUBMITTED (link or file) -> REVIEWED (feedback). Included in the mentorship.'`);

    // ------------------------------------------------------------------ goals
    await queryRunner.query(`
      CREATE TABLE goals (
        id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        enrolment_id          uuid        NOT NULL REFERENCES enrolments (id) ON DELETE CASCADE,
        text                  text        NOT NULL,
        created_by_user_id    uuid        NULL REFERENCES users (id) ON DELETE SET NULL,
        completed_at          timestamptz NULL,
        completed_by_user_id  uuid        NULL REFERENCES users (id) ON DELETE SET NULL,
        position              smallint    NOT NULL DEFAULT 0,
        created_at            timestamptz NOT NULL DEFAULT now(),
        updated_at            timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_goals_completed_by CHECK (completed_by_user_id IS NULL OR completed_at IS NOT NULL)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_goals_enrolment_position ON goals (enrolment_id, position)`);
    await queryRunner.query(updatedAtTrigger('goals'));
    await queryRunner.query(`COMMENT ON TABLE goals IS 'Goal checklist per enrolment; either party may create / tick (open question).'`);

    // -------------------------------------------------------- session_ratings
    await queryRunner.query(`
      CREATE TABLE session_ratings (
        session_id  uuid        PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,
        mentee_id   uuid        NOT NULL REFERENCES mentee_profiles (user_id),
        mentor_id   uuid        NOT NULL REFERENCES mentor_profiles (user_id),
        stars       smallint    NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_session_ratings_stars CHECK (stars BETWEEN 1 AND 5)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_session_ratings_mentor_id ON session_ratings (mentor_id)`);
    await queryRunner.query(`COMMENT ON TABLE session_ratings IS 'Quick 1-5 star rating after each held session (one per session).'`);

    // ---------------------------------------------------------------- reviews
    await queryRunner.query(`
      CREATE TABLE reviews (
        id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        enrolment_id         uuid          NOT NULL REFERENCES enrolments (id) ON DELETE CASCADE,
        mentee_id            uuid          NOT NULL REFERENCES mentee_profiles (user_id),
        mentor_id            uuid          NOT NULL REFERENCES mentor_profiles (user_id),
        communication_stars  smallint      NOT NULL,
        communication_text   text          NOT NULL,
        expertise_stars      smallint      NOT NULL,
        expertise_text       text          NOT NULL,
        punctuality_stars    smallint      NOT NULL,
        punctuality_text     text          NOT NULL,
        impact_stars         smallint      NOT NULL,
        impact_text          text          NOT NULL,
        overall_score        numeric(3,2)  GENERATED ALWAYS AS (
          round((communication_stars + expertise_stars + punctuality_stars + impact_stars)::numeric / 4, 2)
        ) STORED,
        created_at           timestamptz   NOT NULL DEFAULT now(),
        updated_at           timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT uq_reviews_enrolment_id UNIQUE (enrolment_id),
        CONSTRAINT ck_reviews_stars CHECK (
          communication_stars BETWEEN 1 AND 5 AND expertise_stars BETWEEN 1 AND 5
          AND punctuality_stars BETWEEN 1 AND 5 AND impact_stars BETWEEN 1 AND 5
        ),
        CONSTRAINT ck_reviews_texts CHECK (
          char_length(btrim(communication_text)) >= 10 AND char_length(btrim(expertise_text)) >= 10
          AND char_length(btrim(punctuality_text)) >= 10 AND char_length(btrim(impact_text)) >= 10
        )
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_reviews_mentor_created ON reviews (mentor_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX ix_reviews_mentee_id ON reviews (mentee_id)`);
    await queryRunner.query(updatedAtTrigger('reviews'));
    await queryRunner.query(`COMMENT ON TABLE reviews IS 'Detailed review (4 categories x stars + mandatory text), one per enrolment, editable, no mentor reply, no moderation.'`);

    // ---------------------------------------------------- mentor_rating_stats
    await queryRunner.query(`
      CREATE TABLE mentor_rating_stats (
        mentor_id             uuid          PRIMARY KEY REFERENCES mentor_profiles (user_id) ON DELETE CASCADE,
        review_count          integer       NOT NULL DEFAULT 0,
        avg_overall           numeric(3,2)  NULL,
        avg_communication     numeric(3,2)  NULL,
        avg_expertise         numeric(3,2)  NULL,
        avg_punctuality       numeric(3,2)  NULL,
        avg_impact            numeric(3,2)  NULL,
        session_rating_count  integer       NOT NULL DEFAULT 0,
        avg_session_stars     numeric(3,2)  NULL,
        updated_at            timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT ck_mentor_rating_stats_counts CHECK (review_count >= 0 AND session_rating_count >= 0)
      )
    `);
    await queryRunner.query(`CREATE INDEX ix_mentor_rating_stats_avg_overall ON mentor_rating_stats (avg_overall DESC NULLS LAST)`);
    await queryRunner.query(updatedAtTrigger('mentor_rating_stats'));
    await queryRunner.query(`COMMENT ON TABLE mentor_rating_stats IS 'Cached aggregates for search sorting and top-3 matching; updated by the app in the same transaction as review / rating writes. avg_overall NULL = "new" mentor.'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS mentor_rating_stats`);
    await queryRunner.query(`DROP TABLE IF EXISTS reviews`);
    await queryRunner.query(`DROP TABLE IF EXISTS session_ratings`);
    await queryRunner.query(`DROP TABLE IF EXISTS goals`);
    await queryRunner.query(`DROP TABLE IF EXISTS projects`);
    await queryRunner.query(`DROP TABLE IF EXISTS evaluation_scores`);
    await queryRunner.query(`DROP TABLE IF EXISTS evaluations`);
  }
}
