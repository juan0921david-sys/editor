
const test = require('node:test')
const assert = require('node:assert/strict')

const { crearRepositorioUsuarios } = require('../src/repositories/usuarioRepository')
const { crearAlmacenSesiones } = require('../src/services/sesionService')
const { crearAuthService } = require('../src/services/authService')

const secretos = {
  access: 'a'.repeat(48),
  refresh: 'b'.repeat(48)
}

const crearSistema = (llaves = secretos) => {
  const usuarios = crearRepositorioUsuarios({ coste: 4 })
  const sesiones = crearAlmacenSesiones()
  const auth = crearAuthService({ usuarios, sesiones, secretos: llaves })

  return { usuarios, sesiones, auth }
}

test('registro hashea la contraseña y login devuelve tokens', async () => {
  const { usuarios, auth } = crearSistema()

  const usuario = await auth.registrar({
    nombre: 'Ana',
    correo: ' ana@local.test ',
    password: 'clave-segura-123'
  })

  assert.equal(usuario.correo, 'ana@local.test')
  assert.notEqual(usuario.id, undefined)

  const guardado = await usuarios.buscarPorCorreo('ana@local.test')
  assert.notEqual(guardado.hash, 'clave-segura-123')

  const sesion = await auth.login({
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  assert.equal(typeof sesion.accessToken, 'string')
  assert.equal(typeof sesion.refreshToken, 'string')
  assert.equal(sesion.usuario.rol, 'editor')
  assert.equal(auth.verificarAcceso(sesion.accessToken).sub, usuario.id)
})

test('login rechaza contraseña incorrecta', async () => {
  const { auth } = crearSistema()

  await auth.registrar({
    nombre: 'Ana',
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  await assert.rejects(
    () => auth.login({
      correo: 'ana@local.test',
      password: 'incorrecta'
    }),
    (error) => error.message === 'credenciales_invalidas' && error.status === 401
  )
})

test('refresh rota el token y el anterior deja de ser válido', async () => {
  const { auth } = crearSistema()

  await auth.registrar({
    nombre: 'Ana',
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  const primera = await auth.login({
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  const segunda = await auth.refrescar(primera.refreshToken)

  assert.notEqual(segunda.refreshToken, primera.refreshToken)
  assert.equal(
    auth.verificarAcceso(segunda.accessToken).sub,
    primera.usuario.id
  )

  await assert.rejects(
    () => auth.refrescar(primera.refreshToken),
    (error) => error.message === 'reutilizacion_detectada'
  )
})

test('reutilización revoca toda la familia de sesiones', async () => {
  const { auth } = crearSistema()

  await auth.registrar({
    nombre: 'Ana',
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  const primera = await auth.login({
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  const segunda = await auth.refrescar(primera.refreshToken)

  await assert.rejects(() => auth.refrescar(primera.refreshToken))

  assert.throws(
    () => auth.verificarAcceso(segunda.accessToken),
    (error) => error.message === 'sesion_revocada'
  )

  await assert.rejects(
    () => auth.refrescar(segunda.refreshToken),
    (error) => error.message === 'reutilizacion_detectada'
  )
})

test('logout revoca la sesión actual', async () => {
  const { auth } = crearSistema()

  await auth.registrar({
    nombre: 'Ana',
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  const sesion = await auth.login({
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  auth.cerrarSesion(sesion.refreshToken)

  assert.throws(
    () => auth.verificarAcceso(sesion.accessToken),
    (error) => error.message === 'sesion_revocada'
  )
})

test('logout-todos revoca las sesiones concurrentes', async () => {
  const { auth } = crearSistema()

  await auth.registrar({
    nombre: 'Ana',
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  const datos = {
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  }

  const una = await auth.login(datos)
  const dos = await auth.login(datos)

  auth.cerrarTodas(una.refreshToken)

  assert.throws(() => auth.verificarAcceso(una.accessToken))
  assert.throws(() => auth.verificarAcceso(dos.accessToken))
})

test('un access token de otra firma es rechazado', async () => {
  const { auth } = crearSistema()
  const otra = crearSistema({
    access: 'c'.repeat(48),
    refresh: 'd'.repeat(48)
  })

  await auth.registrar({
    nombre: 'Ana',
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  const sesion = await auth.login({
    correo: 'ana@local.test',
    password: 'clave-segura-123'
  })

  assert.throws(
    () => otra.auth.verificarAcceso(sesion.accessToken),
    (error) => error.message === 'token_invalido'
  )
})
