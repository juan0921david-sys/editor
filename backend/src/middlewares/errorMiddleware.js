const { randomUUID } = require('node:crypto')

const correlationMiddleware = (req, res, next) => {
  const correlationId = randomUUID()

  req.correlationId = correlationId
  res.setHeader('x-correlation-id', correlationId)

  next()
}

const errorHandler = (err, req, res, next) => {
  const status = 
    Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 
    ? err.status
    : 500
  console.error(JSON.stringify({
    level: 'error', 
    message: 'Error procesando peticion HTTP', 
    correlationId: req.correlationId || null, 
    method: req.method, 
    path: req.path, 
    status, 
    errorName: typeof err.name === 'string' ? err.name : 'Error', 
    timestamp: new Date().toISOString()
  }))

  const message =
    status >=500
  ? 'Error interno del servidor'
    : typeof err.message === 'string'
  ? err.message
    : 'error en la solicitud'


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
  correlationMiddleware, 
  errorHandler,
  notFoundHandler
}
