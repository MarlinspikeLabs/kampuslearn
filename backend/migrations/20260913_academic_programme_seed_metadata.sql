BEGIN;

ALTER TABLE academic_programmes
  ADD COLUMN IF NOT EXISTS programme_source VARCHAR(30)
  NOT NULL DEFAULT 'regulatory';

ALTER TABLE academic_programmes
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN
  NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS academic_programmes_source_idx
  ON academic_programmes(programme_source);

COMMIT;
