BEGIN;

SET LOCAL lock_timeout = '5s';

-- National regulator directories do not consistently publish a verified
-- abbreviation or city for every institution. These fields are metadata,
-- not identity requirements.
ALTER TABLE institutions
  ALTER COLUMN short_name DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL;

COMMIT;
