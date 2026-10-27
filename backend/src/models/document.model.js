const pool = require('../config/db')

const obtenerDocumento = async (documentoId) => {
  const query = 'SELECT titulo, bloques FROM documentos WHERE id = $1'
  const resultado = await pool.query(query, [documentoId])

  if (resultado.rows.length > 0) {
    return resultado.rows[0]
  }

  const tituloPorDefecto = 'Documento sin título'
  const bloquesPorDefecto = JSON.stringify([
    {
      id: '1',
      contenido: 'El documento está listo. Escribe "/" para ver los tipos de bloque.',
      tipo: 'parrafo',
      hecho: false,
      bloqueadoPor: null
    }
  ])

  const insertQuery = `
    INSERT INTO documentos (id, titulo, bloques, actualizado_en)
    VALUES ($1, $2, $3, NOW())
    RETURNING titulo, bloques
  `
  const nuevoDoc = await pool.query(insertQuery, [documentoId, tituloPorDefecto, bloquesPorDefecto])
  return nuevoDoc.rows[0]
}

const actualizarTituloBD = async (documentoId, titulo) => {
  const query = `
    INSERT INTO documentos (id, titulo, bloques, actualizado_en)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (id) 
    DO UPDATE SET titulo = EXCLUDED.titulo, actualizado_en = NOW()
  `
  const bloquesIniciales = JSON.stringify([
    {
      id: '1',
      contenido: '',
      tipo: 'parrafo',
      hecho: false,
      bloqueadoPor: null
    }
  ])
  await pool.query(query, [documentoId, titulo, bloquesIniciales])
}

const actualizarEstructuraBD = async (documentoId, bloques) => {
  const query = `
    UPDATE documentos 
    SET bloques = $1, actualizado_en = NOW() 
    WHERE id = $2
  `
  await pool.query(query, [JSON.stringify(bloques), documentoId])
}

module.exports = {
  obtenerDocumento,
  actualizarTituloBD,
  actualizarEstructuraBD
}