const pool = require('../config/db')

const obtenerDocumento = async (id) => {
  const res = await pool.query('SELECT * FROM documentos WHERE id = $1', [id])
  if (res.rows.length > 0) return res.rows[0]
  
  const nuevo = await pool.query(
    'INSERT INTO documentos (id, titulo, bloques) VALUES ($1, $2, $3) RETURNING *',
    [id, 'Documento sin titulo', JSON.stringify([])]
  )
  return nuevo.rows[0]
}

const actualizarEstructuraBD = async (id, bloques) => {
  await pool.query(
    'UPDATE documentos SET bloques = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
    [JSON.stringify(bloques), id]
  )
}

const actualizarTituloBD = async (id, titulo) => {
  await pool.query(
    'UPDATE documentos SET titulo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
    [titulo, id]
  )
}

module.exports = {
  obtenerDocumento,
  actualizarEstructuraBD,
  actualizarTituloBD
}