
const bcrypt = require('bcryptjs')

const crearRepositorioUsuarios = ({
  coste = 12,
  ahora = () => new Date().toISOString()
} = {}) => {
  const porId = new Map()
  const porCorreo = new Map()
  let secuencia = 0

  const normalizar = (correo) =>
    String(correo || '').trim().toLowerCase()

  const crear = async ({ nombre, correo, password, rol = 'editor' }) => {
    const email = normalizar(correo)

    if (!email || typeof password !== 'string' || !password) {
      throw new Error('datos_invalidos')
    }

    if (porCorreo.has(email)) {
      throw new Error('correo_existente')
    }

    const id = `usr_${++secuencia}`
    const usuario = {
      id,
      nombre: String(nombre || '').trim().slice(0, 40),
      correo: email,
      hash: await bcrypt.hash(password, coste),
      rol,
      creadoEn: ahora()
    }

    porId.set(id, usuario)
    porCorreo.set(email, usuario)

    return usuario
  }

  return {
    crear,

    async sembrar({ nombre, correo, password, rol = 'editor' }) {
      const email = normalizar(correo)

      if (porCorreo.has(email)) return porCorreo.get(email)

      return crear({ nombre, correo: email, password, rol })
    },

    async buscarPorCorreo(correo) {
      return porCorreo.get(normalizar(correo)) || null
    },

    async buscarPorId(id) {
      return porId.get(String(id)) || null
    },

    async verificar(usuario, password) {
      if (!usuario || typeof password !== 'string') return false
      return bcrypt.compare(password, usuario.hash)
    }
  }
}

module.exports = { crearRepositorioUsuarios }
