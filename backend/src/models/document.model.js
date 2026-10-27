const pool = require('../config/db')

const TITULO_POR_DEFECTO = 'Documento sin título'

const bloquesPorDefecto = () =>
  JSON.stringify([
    {
      id: '1',
      contenido: 'El documento está listo. Escribe "/" para ver los tipos de bloque.',
      tipo: 'parrafo',
      hecho: false
    }
  ])

const asegurarTabla = async () => {
  const existente = await pool.query("SELECT to_regclass('documentos') AS tabla")
  if (!existente.rows[0].tabla) {
    await pool.query(`
      CREATE TABLE documentos (
        id VARCHAR(64) PRIMARY KEY,
        titulo TEXT NOT NULL DEFAULT 'Documento sin título',
        bloques JSONB NOT NULL DEFAULT '[]'::jsonb,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }

  const permisos = await pool.query(
    `SELECT has_table_privilege(current_user, 'documentos', 'SELECT') AS leer,
            has_table_privilege(current_user, 'documentos', 'INSERT') AS insertar,
            has_table_privilege(current_user, 'documentos', 'UPDATE') AS actualizar`
  )
  const { leer, insertar, actualizar } = permisos.rows[0]
  if (!leer || !insertar || !actualizar) {
    throw new Error('El usuario de la base de datos no tiene permisos SELECT, INSERT y UPDATE sobre la tabla documentos')
  }

  await pool.query('SELECT id, titulo, bloques, actualizado_en FROM documentos LIMIT 1')
}

const obtenerDocumento = async (documentoId) => {
  await pool.query(
    `INSERT INTO documentos (id, titulo, bloques, actualizado_en)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [documentoId, TITULO_POR_DEFECTO, bloquesPorDefecto()]
  )
  const resultado = await pool.query('SELECT titulo, bloques FROM documentos WHERE id = $1', [documentoId])
  if (resultado.rows.length === 0) throw new Error(`No se pudo cargar el documento ${documentoId}`)
  return resultado.rows[0]
}

const actualizarTituloBD = async (documentoId, titulo) => {
  await pool.query(
    `INSERT INTO documentos (id, titulo, bloques, actualizado_en)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id)
     DO UPDATE SET titulo = EXCLUDED.titulo, actualizado_en = NOW()`,
    [documentoId, titulo, bloquesPorDefecto()]
  )
}

const actualizarEstructuraBD = async (documentoId, bloques) => {
  await pool.query(
    `INSERT INTO documentos (id, titulo, bloques, actualizado_en)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id)
     DO UPDATE SET bloques = EXCLUDED.bloques, actualizado_en = NOW()`,
    [documentoId, TITULO_POR_DEFECTO, JSON.stringify(bloques)]
  )
}

module.exports = {
  asegurarTabla,
  obtenerDocumento,
  actualizarTituloBD,
  actualizarEstructuraBD
}