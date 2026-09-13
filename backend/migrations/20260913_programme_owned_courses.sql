BEGIN;

ALTER TABLE courses
  ALTER COLUMN department_id DROP NOT NULL;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS curriculum_source VARCHAR(30)
  NOT NULL DEFAULT 'legacy';

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN
  NOT NULL DEFAULT FALSE;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS source_url TEXT;

CREATE INDEX IF NOT EXISTS courses_curriculum_source_idx
  ON courses(curriculum_source);

COMMIT;
