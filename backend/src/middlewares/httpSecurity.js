const crearOpcionesCors = (env = process.env) => {
  const configurados = env.FRONTEND_ORIGINS
  if (!configurados && env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_ORIGINS es obligatorio en producción')
  }
  const origenes = (configurados || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((valor) => valor.trim())

  for (const origen of origenes) {
    const url = new URL(origen)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origen) {
      throw new Error('FRONTEND_ORIGINS debe contener orígenes HTTP/HTTPS sin ruta')
    }
  }

  return {
    origin: (origen, callback) => {
      if (!origen || origenes.includes(origen)) return callback(null, true)
      const error = new Error('Origen no permitido')
      error.status = 403
      callback(error)
    },
    credentials: true,
    exposedHeaders: ['x-correlation-id', 'Retry-After'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id']
  }
}

const crearLimitador = ({
  max = 300,
  ventanaMs = 60_000,
  maxClaves = 10_000,
  reloj = Date.now
} = {}) => {
  const clientes = new Map()
  let siguienteLimpieza = 0

  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next()
    const ahora = reloj()

    if (ahora >= siguienteLimpieza) {
      for (const [clave, entrada] of clientes) {
        if (ahora >= entrada.vence) clientes.delete(clave)
      }
      siguienteLimpieza = ahora + ventanaMs
    }

    const clave = req.ip || req.socket.remoteAddress || 'desconocido'
    let entrada = clientes.get(clave)
    if (!entrada || ahora >= entrada.vence) {
      if (!entrada && clientes.size >= maxClaves) {
        res.setHeader('Retry-After', Math.ceil(ventanaMs / 1000))
        const error = new Error('Servidor ocupado; intenta de nuevo más tarde')
        error.status = 503
        return next(error)
      }
      entrada = { total: 0, vence: ahora + ventanaMs }
      clientes.set(clave, entrada)
    }

    if (entrada.total >= max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((entrada.vence - ahora) / 1000)))
      const error = new Error('Demasiadas solicitudes; intenta de nuevo más tarde')
      error.status = 429
      return next(error)
    }

    entrada.total += 1
    next()
  }
}

module.exports = { crearOpcionesCors, crearLimitador }
