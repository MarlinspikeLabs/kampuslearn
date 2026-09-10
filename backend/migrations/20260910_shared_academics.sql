CREATE TABLE IF NOT EXISTS academic_template_assignments (
 institution_id uuid PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
 template_key text NOT NULL,
 template_version integer NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT now(),
 summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
