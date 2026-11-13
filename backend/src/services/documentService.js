
const {
  asegurarTabla,
  obtenerDocumento,
  actualizarTituloBD,
  actualizarEstructuraBD
} = require('../models/document.model')

const documentService = {
  async inicializarBaseDeDatos() {
    await asegurarTabla()
  },

  async cargarDocumento(documentoId) {
    if (!documentoId) throw new Error('ID de documento requerido')
    return await obtenerDocumento(documentoId)
  },

  async guardarTitulo(documentoId, titulo) {
    const tituloValido = typeof titulo === 'string' ? titulo.slice(0, 80) : 'Documento sin título'
    await actualizarTituloBD(documentoId, tituloValido)
  },

  async guardarEstructura(documentoId, bloques) {
    if (!Array.isArray(bloques)) throw new Error('La estructura de bloques debe ser un arreglo')
    await actualizarEstructuraBD(documentoId, bloques)
  }
}

module.exports = documentService
