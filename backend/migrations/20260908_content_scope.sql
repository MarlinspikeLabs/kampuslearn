ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS content_scope text NOT NULL DEFAULT 'institution';
ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS generic_subject text;
ALTER TABLE course_materials ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE past_questions ADD COLUMN IF NOT EXISTS content_scope text NOT NULL DEFAULT 'institution';
ALTER TABLE past_questions ADD COLUMN IF NOT EXISTS generic_subject text;
ALTER TABLE past_questions ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE past_questions ALTER COLUMN department_id DROP NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='course_materials_scope_check' AND conrelid='course_materials'::regclass) THEN
  ALTER TABLE course_materials ADD CONSTRAINT course_materials_scope_check CHECK (
   (content_scope='institution' AND course_id IS NOT NULL) OR
   (content_scope='generic' AND course_id IS NULL AND generic_subject IS NOT NULL AND length(btrim(generic_subject)) BETWEEN 1 AND 180)
  );
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='past_questions_scope_check' AND conrelid='past_questions'::regclass) THEN
  ALTER TABLE past_questions ADD CONSTRAINT past_questions_scope_check CHECK (
   (content_scope='institution' AND course_id IS NOT NULL) OR
   (content_scope='generic' AND course_id IS NULL AND department_id IS NULL AND generic_subject IS NOT NULL AND length(btrim(generic_subject)) BETWEEN 1 AND 180)
  );
 END IF;
END $$;
