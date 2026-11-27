
const crearAuthMiddleware = (auth) => {
  const requerirAuth = (req, res, next) => {
    const cabecera = String(req.headers.authorization || '')
    const coincidencia = /^Bearer\s+(.+)$/i.exec(cabecera)

    if (!coincidencia) {
      return res.status(401).json({ error: 'autenticacion_requerida' })
    }

    try {
      req.auth = auth.verificarAcceso(coincidencia[1].trim())
      return next()
    } catch (error) {
      return res.status(error.status || 401).json({ error: error.message })
    }
  }

  const requerirRol = (...roles) => (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'autenticacion_requerida' })
    }

    if (!roles.includes(req.auth.rol)) {
      return res.status(403).json({ error: 'permiso_denegado' })
    }

    return next()
  }

  const requerirPropietario = (obtenerPropietario) => async (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'autenticacion_requerida' })
    }

    try {
      const propietario = await obtenerPropietario(req)

      if (!propietario) {
        return res.status(404).json({ error: 'recurso_inexistente' })
      }

      if (propietario !== req.auth.sub && req.auth.rol !== 'admin') {
        return res.status(403).json({ error: 'permiso_denegado' })
      }

      return next()
    } catch (error) {
      return res.status(500).json({ error: 'error_al_autorizar' })
    }
  }

  return {
    requerirAuth,
    requerirRol,
    requerirPropietario
  }
}

module.exports = { crearAuthMiddleware }
