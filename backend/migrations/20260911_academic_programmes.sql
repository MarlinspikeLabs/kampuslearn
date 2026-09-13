BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS academic_programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  institution_id UUID NOT NULL
    REFERENCES institutions(id) ON DELETE CASCADE,

  department_id UUID
    REFERENCES departments(id) ON DELETE SET NULL,

  name VARCHAR(200) NOT NULL,

  award_type VARCHAR(20) NOT NULL
    CHECK (
      award_type IN (
        'ND',
        'HND',
        'BSc',
        'BA',
        'BEng',
        'BTech',
        'LLB',
        'MBBS',
        'Other'
      )
    ),

  regulator VARCHAR(30) NOT NULL,

  accreditation_status VARCHAR(30) NOT NULL
    DEFAULT 'accredited',

  source_url TEXT,

  checked_at DATE,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (institution_id, name, award_type)
);

CREATE INDEX IF NOT EXISTS academic_programmes_institution_idx
  ON academic_programmes(institution_id);

CREATE INDEX IF NOT EXISTS academic_programmes_department_idx
  ON academic_programmes(department_id);

COMMIT;
