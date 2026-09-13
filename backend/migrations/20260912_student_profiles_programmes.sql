BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS programme_id UUID;

ALTER TABLE student_profiles
  ALTER COLUMN department_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_profiles_programme_id_fkey'
  ) THEN
    ALTER TABLE student_profiles
      ADD CONSTRAINT student_profiles_programme_id_fkey
      FOREIGN KEY (programme_id)
      REFERENCES academic_programmes(id);
  END IF;
END $$;

ALTER TABLE student_profiles
  DROP CONSTRAINT IF EXISTS student_in_one_track;

ALTER TABLE student_profiles
  ADD CONSTRAINT student_academic_track_check
  CHECK (
    (
      programme_id IS NULL
      AND department_id IS NOT NULL
      AND (
        (faculty_id IS NOT NULL AND school_id IS NULL)
        OR
        (faculty_id IS NULL AND school_id IS NOT NULL)
      )
    )
    OR
    (
      programme_id IS NOT NULL
      AND department_id IS NULL
      AND faculty_id IS NULL
      AND school_id IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS student_profiles_programme_id_idx
  ON student_profiles(programme_id);

COMMIT;
