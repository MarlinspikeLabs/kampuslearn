CREATE TABLE IF NOT EXISTS course_default_assignments (
 department_id uuid PRIMARY KEY REFERENCES departments(id) ON DELETE CASCADE,
 profile_key text NOT NULL,
 template_version integer NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT now(),
 summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
