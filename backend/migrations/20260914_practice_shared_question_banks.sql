BEGIN;

CREATE TABLE IF NOT EXISTS practice_course_question_sources (
    course_id UUID PRIMARY KEY
        REFERENCES courses(id) ON DELETE CASCADE,

    source_course_id UUID NOT NULL
        REFERENCES courses(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (course_id IS NOT NULL),
    CHECK (source_course_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_practice_question_sources_source
    ON practice_course_question_sources(source_course_id);

COMMIT;
