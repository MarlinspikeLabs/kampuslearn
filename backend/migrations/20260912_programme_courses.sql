BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS programme_courses (
  programme_id UUID NOT NULL
    REFERENCES academic_programmes(id)
    ON DELETE CASCADE,

  course_id UUID NOT NULL
    REFERENCES courses(id)
    ON DELETE CASCADE,

  level VARCHAR(10) NOT NULL,

  semester semester_type,

  is_core BOOLEAN NOT NULL DEFAULT TRUE,

  source_type VARCHAR(30) NOT NULL DEFAULT 'manual',
  source_url TEXT,
  checked_at DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (programme_id, course_id, level),

  CONSTRAINT programme_courses_level_check
    CHECK (
      level IN ('ND1','ND2','HND1','HND2')
    )
);

CREATE INDEX IF NOT EXISTS programme_courses_programme_idx
  ON programme_courses(programme_id);

CREATE INDEX IF NOT EXISTS programme_courses_course_idx
  ON programme_courses(course_id);

CREATE INDEX IF NOT EXISTS programme_courses_level_idx
  ON programme_courses(programme_id, level);

COMMIT;
