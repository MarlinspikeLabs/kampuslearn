BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE academic_programmes
  ADD COLUMN IF NOT EXISTS category VARCHAR(200),
  ADD COLUMN IF NOT EXISTS year_granted_text VARCHAR(60),
  ADD COLUMN IF NOT EXISTS approved_stream INTEGER,
  ADD COLUMN IF NOT EXISTS expiration_date DATE;

CREATE INDEX IF NOT EXISTS academic_programmes_expiration_idx
  ON academic_programmes(expiration_date);

COMMIT;
