
const jwt = require('jsonwebtoken')

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret_key_seguro_grado'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key_seguro_grado'

const loginSeguro = (req, res) => {
  try {
    const { nombre, uid } = req.body
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' })
    }

    const payload = { uid: uid || 'usr_' + Date.now(), nombre: nombre.trim() }

    const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' })

    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' })

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    return res.json({ accessToken, usuario: payload })
  } catch (error) {
    return res.status(500).json({ error: 'Error al generar la sesión segura' })
  }
}

const refrescarToken = (req, res) => {
  const cookies = req.headers.cookie ? Object.fromEntries(req.headers.cookie.split('; ').map(c => c.split('='))) : {}
  const refreshToken = cookies.refreshToken

  if (!refreshToken) {
    return res.status(401).json({ error: 'No hay token de refresco disponible' })
  }

  jwt.verify(refreshToken, REFRESH_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Sesión expirada o inválida' })
    }
    const accessToken = jwt.sign({ uid: user.uid, nombre: user.nombre }, ACCESS_SECRET, { expiresIn: '15m' })
    return res.json({ accessToken })
  })
}

module.exports = {
  loginSeguro,
  refrescarToken
}
