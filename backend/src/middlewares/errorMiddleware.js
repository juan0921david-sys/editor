
const errorHandler = (err, req, res, next) => {
  console.error('[Error Servidor]:', err.stack || err.message)

  const status = err.status || 500
  const message = err.message || 'Error interno del servidor'

  res.status(status).json({
    ok: false,
    error: message,
    timestamp: new Date().toISOString()
  })
}

const notFoundHandler = (req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Ruta no encontrada'
  })
}

module.exports = {
  errorHandler,
  notFoundHandler
}
