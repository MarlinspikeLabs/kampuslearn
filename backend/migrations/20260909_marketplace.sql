CREATE TABLE IF NOT EXISTS marketplace_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name varchar(100) NOT NULL CHECK (length(trim(name)) > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_categories_name_key ON marketplace_categories (lower(trim(name)));
CREATE TABLE IF NOT EXISTS marketplace_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title varchar(180) NOT NULL CHECK (length(trim(title)) > 0),
 description text NOT NULL DEFAULT '',
 category_id uuid NOT NULL REFERENCES marketplace_categories(id),
 institution_id uuid REFERENCES institutions(id),
 format varchar(10) NOT NULL CHECK (format IN ('digital','physical')),
 price_kobo integer NOT NULL CHECK (price_kobo BETWEEN 0 AND 100000000),
 stock integer CHECK (stock BETWEEN 0 AND 1000000),
 status varchar(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','archived')),
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((format='digital' AND stock IS NULL) OR (format='physical' AND stock IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS marketplace_products_status_idx ON marketplace_products(status);
