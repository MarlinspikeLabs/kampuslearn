BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS ai_generation_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('chat', 'quiz_gen')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  cost_micros BIGINT NOT NULL CHECK (cost_micros >= 0),
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_generation_user_time ON ai_generation_requests(user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_generation_time ON ai_generation_requests(created_at);
CREATE TABLE IF NOT EXISTS ai_material_chunks (
  material_id UUID NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page INTEGER NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT NOT NULL,
  search TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  PRIMARY KEY(material_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS ai_material_search ON ai_material_chunks USING GIN(search);
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS grounding TEXT;
COMMIT;
