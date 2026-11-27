-- Fase 3A: cuentas y sesiones de refresco.
-- No ejecutada: la implementación actual usa repositorios en memoria.

CREATE TABLE IF NOT EXISTS usuarios (
  id           TEXT PRIMARY KEY,
  nombre       TEXT NOT NULL,
  correo       TEXT NOT NULL UNIQUE,
  hash         TEXT NOT NULL,
  rol          TEXT NOT NULL DEFAULT 'editor' CHECK (rol IN ('editor', 'admin')),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sesiones_refresco (
  jti          TEXT PRIMARY KEY,
  familia      TEXT NOT NULL,
  usuario_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  hash_token   TEXT NOT NULL,
  estado       TEXT NOT NULL DEFAULT 'activa'
                 CHECK (estado IN ('activa', 'rotada', 'revocada')),
  expira_en    TIMESTAMPTZ NOT NULL,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario
  ON sesiones_refresco (usuario_id);

CREATE INDEX IF NOT EXISTS idx_sesiones_familia
  ON sesiones_refresco (familia);
