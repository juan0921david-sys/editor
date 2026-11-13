
const documentService = require('../services/documentService')

const obtenerDocumentoHttp = async (req, res, next) => {
  try {
    const { id } = req.params
    const doc = await documentService.cargarDocumento(id)
    res.json({ ok: true, data: doc })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  obtenerDocumentoHttp
}
