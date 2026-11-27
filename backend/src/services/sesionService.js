
const crypto = require('crypto')

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex')

const crearAlmacenSesiones = () => {
  const porId = new Map()
  const porFamilia = new Map()
  const porUsuario = new Map()

  const agregar = (mapa, clave, valor) => {
    const lista = mapa.get(clave) || new Set()
    lista.add(valor)
    mapa.set(clave, lista)
  }

  const quitar = (mapa, clave, valor) => {
    const lista = mapa.get(clave)
    if (!lista) return
    lista.delete(valor)
    if (!lista.size) mapa.delete(clave)
  }

  return {
    registrar({ jti, familia, usuarioId, hash, expiraEn }) {
      porId.set(String(jti), {
        jti: String(jti),
        familia: String(familia),
        usuarioId: String(usuarioId),
        hash,
        expiraEn,
        estado: 'activa'
      })

      agregar(porFamilia, String(familia), String(jti))
      agregar(porUsuario, String(usuarioId), String(jti))
    },

    obtener(jti) {
      return porId.get(String(jti)) || null
    },

    marcarRotada(jti) {
      const sesion = porId.get(String(jti))
      if (sesion) sesion.estado = 'rotada'
    },

    revocar(jti) {
      const sesion = porId.get(String(jti))
      if (!sesion) return
      sesion.estado = 'revocada'
      quitar(porFamilia, sesion.familia, sesion.jti)
      quitar(porUsuario, sesion.usuarioId, sesion.jti)
    },

    revocarFamilia(familia) {
      const lista = porFamilia.get(String(familia))
      if (!lista) return
      for (const jti of Array.from(lista)) this.revocar(jti)
    },

    revocarUsuario(usuarioId, exceptoJti) {
      const lista = porUsuario.get(String(usuarioId))
      if (!lista) return
      for (const jti of Array.from(lista)) {
        if (jti !== String(exceptoJti)) this.revocar(jti)
      }
    },

    limpiar(ahora) {
      for (const sesion of Array.from(porId.values())) {
        if (sesion.expiraEn > ahora) continue
        porId.delete(sesion.jti)
        quitar(porFamilia, sesion.familia, sesion.jti)
        quitar(porUsuario, sesion.usuarioId, sesion.jti)
      }
    }
  }
}

module.exports = { crearAlmacenSesiones, hashToken }
