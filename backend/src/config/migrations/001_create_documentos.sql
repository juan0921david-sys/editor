CREATE TABLE IF NOT EXISTS documentos (
  id VARCHAR(64) PRIMARY KEY,
  titulo TEXT NOT NULL DEFAULT 'Documento sin título',
  bloques JSONB NOT NULL DEFAULT '[]'::jsonb,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);