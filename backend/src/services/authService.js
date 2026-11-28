
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { hashToken } = require('./sesionService')

const REFRESCO_MS = 7 * 24 * 60 * 60 * 1000

const fallo = (mensaje, status = 401) =>
  Object.assign(new Error(mensaje), { status })

const crearAuthService = ({
  usuarios,
  sesiones,
  secretos,
  ahora = Date.now,
  generarId = () => crypto.randomUUID()
} = {}) => {
  const access = secretos && secretos.access
  const refresh = secretos && secretos.refresh

  if (!access || !refresh) {
    throw new Error('Faltan secretos JWT')
  }

  const publico = (usuario) => ({
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol
  })

  const firmarAcceso = (usuario, sid) =>
    jwt.sign(
      {
        sub: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        sid
      },
      access,
      {
        algorithm: 'HS256',
        expiresIn: '15m'
      }
    )

  const crearRefresco = (usuario, familia = generarId()) => {
    const jti = generarId()
    const token = jwt.sign(
      {
        sub: usuario.id,
        familia
      },
      refresh,
      {
        algorithm: 'HS256',
        expiresIn: '7d',
        jwtid: jti
      }
    )

    sesiones.registrar({
      jti,
      familia,
      usuarioId: usuario.id,
      hash: hashToken(token),
      expiraEn: ahora() + REFRESCO_MS
    })

    return { token, jti, familia }
  }

  const registrar = async ({ nombre, username, correo, password, rol }) => {
    const usuario = await usuarios.crear({ nombre, correo, password, rol })
    return publico(usuario)
  }

  const login = async ({ correo, password }) => {
    const usuario = await usuarios.buscarPorCorreo(correo)

    if (!usuario || !(await usuarios.verificar(usuario, password))) {
      throw fallo('credenciales_invalidas')
    }

    const refresco = crearRefresco(usuario)

    return {
      accessToken: firmarAcceso(usuario, refresco.jti),
      refreshToken: refresco.token,
      usuario: publico(usuario)
    }
  }

  const refrescar = async (token) => {
    if (!token) throw fallo('sin_refresh_token')

    let payload

    try {
      payload = jwt.verify(token, refresh, { algorithms: ['HS256'] })
    } catch {
      throw fallo('refresh_invalido')
    }

    const sesion = sesiones.obtener(payload.jti)

    if (!sesion) throw fallo('sesion_desconocida')

    if (
      sesion.estado !== 'activa' ||
      sesion.usuarioId !== payload.sub ||
      sesion.hash !== hashToken(token)
    ) {
      sesiones.revocarFamilia(sesion.familia)
      throw fallo('reutilizacion_detectada')
    }

    if (sesion.expiraEn <= ahora()) {
      sesiones.revocar(sesion.jti)
      throw fallo('sesion_expirada')
    }

    const usuario = await usuarios.buscarPorId(payload.sub)

    if (!usuario) throw fallo('usuario_inexistente')

    sesiones.marcarRotada(sesion.jti)

    const nuevo = crearRefresco(usuario, sesion.familia)

    return {
      accessToken: firmarAcceso(usuario, nuevo.jti),
      refreshToken: nuevo.token,
      usuario: publico(usuario)
    }
  }

  const verificarAcceso = (token) => {
    let payload

    try {
      payload = jwt.verify(token, access, { algorithms: ['HS256'] })
    } catch {
      throw fallo('token_invalido')
    }

    const sesion = sesiones.obtener(payload.sid)

    if (
      !sesion ||
      sesion.estado !== 'activa' ||
      sesion.usuarioId !== payload.sub ||
      sesion.expiraEn <= ahora()
    ) {
      throw fallo('sesion_revocada')
    }

    return payload
  }

  const sesionDeRefresh = (token) => {
    if (!token) return null

    try {
      return jwt.verify(token, refresh, { algorithms: ['HS256'] })
    } catch {
      return null
    }
  }

  const cerrarSesion = (token) => {
    const payload = sesionDeRefresh(token)
    if (payload) sesiones.revocar(payload.jti)
  }

  const cerrarTodas = (token) => {
    const payload = sesionDeRefresh(token)
    if (payload) sesiones.revocarUsuario(payload.sub)
  }

  return {
    registrar,
    login,
    refrescar,
    verificarAcceso,
    cerrarSesion,
    cerrarTodas,
    limpiarSesiones: () => sesiones.limpiar(ahora())
  }
}

module.exports = { crearAuthService }
