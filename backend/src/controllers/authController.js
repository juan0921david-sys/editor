
const {
  loginSchema,
  registroSchema
} = require('../validators/authSchemas')

const ESTADOS = {
  credenciales_invalidas: 401,
  sin_refresh_token: 401,
  refresh_invalido: 401,
  sesion_desconocida: 401,
  reutilizacion_detectada: 401,
  sesion_expirada: 401,
  usuario_inexistente: 401,
  token_invalido: 401,
  sesion_revocada: 401,
  correo_existente: 409
}

const crearAuthController = (auth) => {
  const opcionesCookie = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
  })

  const responderError = (res, error) => {
    const status = ESTADOS[error.message] || 500

    if (status === 500) {
      console.error('[auth] error no controlado:', error)
    }

    return res.status(status).json({ error: error.message })
  }

  const registrar = async (req, res) => {
    const resultado = registroSchema.safeParse(req.body)

    if (!resultado.success) {
      return res.status(400).json({ error: 'datos_invalidos' })
    }

    try {
      const usuario = await auth.registrar(resultado.data)
      return res.status(201).json({ usuario })
    } catch (error) {
      return responderError(res, error)
    }
  }

  const login = async (req, res) => {
    const resultado = loginSchema.safeParse(req.body)

    if (!resultado.success) {
      return res.status(400).json({ error: 'datos_invalidos' })
    }

    try {
      const sesion = await auth.login(resultado.data)

      res.cookie('refreshToken', sesion.refreshToken, opcionesCookie())

      return res.json({
        accessToken: sesion.accessToken,
        usuario: sesion.usuario
      })
    } catch (error) {
      return responderError(res, error)
    }
  }

  const refrescar = async (req, res) => {
    try {
      const sesion = await auth.refrescar(req.cookies && req.cookies.refreshToken)

      res.cookie('refreshToken', sesion.refreshToken, opcionesCookie())

      return res.json({
        accessToken: sesion.accessToken,
        usuario: sesion.usuario
      })
    } catch (error) {
      return responderError(res, error)
    }
  }

  const cerrarSesion = (req, res) => {
    auth.cerrarSesion(req.cookies && req.cookies.refreshToken)

    res.clearCookie('refreshToken', opcionesCookie())

    return res.json({ ok: true })
  }

  const cerrarTodas = (req, res) => {
    auth.cerrarTodas(req.cookies && req.cookies.refreshToken)

    res.clearCookie('refreshToken', opcionesCookie())

    return res.json({ ok: true })
  }

  const yo = (req, res) =>
    res.json({
      usuario: {
        id: req.auth.sub,
        nombre: req.auth.nombre,
        rol: req.auth.rol
      }
    })

  return {
    registrar,
    login,
    refrescar,
    cerrarSesion,
    cerrarTodas,
    yo
  }
}

module.exports = { crearAuthController }
