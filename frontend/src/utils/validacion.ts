import type { RespuestaAuth, UsuarioAuth } from '../types/editor'

export const esRegistro = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)

export const leerAccessToken = (valor: unknown): string =>
  esRegistro(valor) && typeof valor.accessToken === 'string'
    ? valor.accessToken
    : ''

export const leerUsuarioAuth = (valor: unknown): UsuarioAuth | null => {
  if (!esRegistro(valor)) return null
  const { id, nombre, correo, rol } = valor
  if (
    typeof id !== 'string' ||
    typeof nombre !== 'string' ||
    typeof correo !== 'string' ||
    (rol !== 'editor' && rol !== 'admin')
  ) {
    return null
  }
  return { id, nombre, correo, rol }
}

export const leerRespuestaAuth = (valor: unknown): RespuestaAuth | null => {
  if (!esRegistro(valor)) return null
  const accessToken = leerAccessToken(valor)
  const usuario = leerUsuarioAuth(valor.usuario)
  if (!accessToken || !usuario) return null
  return { accessToken, usuario }
}

export const mensajeDeError = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (esRegistro(error) && typeof error.message === 'string') return error.message
  return 'error_desconocido'
}
