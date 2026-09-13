BEGIN;

ALTER TABLE academic_programmes
  DROP CONSTRAINT IF EXISTS academic_programmes_institution_id_name_award_type_key;

ALTER TABLE academic_programmes
  ADD CONSTRAINT academic_programmes_source_identity_key
  UNIQUE (
    institution_id,
    name,
    award_type,
    programme_source
  );

COMMIT;
