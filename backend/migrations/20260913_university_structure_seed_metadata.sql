BEGIN;

ALTER TABLE faculties
  ADD COLUMN IF NOT EXISTS structure_source VARCHAR(30)
  NOT NULL DEFAULT 'institution';

ALTER TABLE faculties
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN
  NOT NULL DEFAULT TRUE;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS structure_source VARCHAR(30)
  NOT NULL DEFAULT 'institution';

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN
  NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS faculties_structure_source_idx
  ON faculties(structure_source);

CREATE INDEX IF NOT EXISTS departments_structure_source_idx
  ON departments(structure_source);

COMMIT;
