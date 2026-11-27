import axios from 'axios'
import type { AxiosError } from 'axios'
import type { RespuestaAuth } from '../types/editor'
import { leerRespuestaAuth, mensajeDeError } from '../utils/validacion'

const baseURL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  'http://localhost:3000'

const cliente = axios.create({
  baseURL,
  withCredentials: true
})

const extraerError = (error: unknown): Error => {
  if (axios.isAxiosError(error)) {
    const fallo = error as AxiosError<unknown>
    const datos = fallo.response?.data
    if (typeof datos === 'object' && datos !== null && 'error' in datos) {
      const mensaje = (datos as { error?: unknown }).error
      if (typeof mensaje === 'string') return new Error(mensaje)
    }
  }
  return new Error(mensajeDeError(error))
}

const convertir = (valor: unknown): RespuestaAuth => {
  const respuesta = leerRespuestaAuth(valor)
  if (!respuesta) throw new Error('respuesta_invalida')
  return respuesta
}

export const login = async (
  correo: string,
  password: string
): Promise<RespuestaAuth> => {
  try {
    const { data } = await cliente.post<unknown>('/auth/login', {
      correo,
      password
    })
    return convertir(data)
  } catch (error) {
    throw extraerError(error)
  }
}

export const registro = async (
  nombre: string,
  correo: string,
  password: string
): Promise<void> => {
  try {
    await cliente.post('/auth/registro', { nombre, correo, password })
  } catch (error) {
    throw extraerError(error)
  }
}

export const refrescar = async (): Promise<RespuestaAuth> => {
  try {
    const { data } = await cliente.post<unknown>('/auth/refresh', {})
    return convertir(data)
  } catch (error) {
    throw extraerError(error)
  }
}

export const logout = async (): Promise<void> => {
  try {
    await cliente.post('/auth/logout', {})
  } catch (error) {
    throw extraerError(error)
  }
}

export const logoutTodos = async (): Promise<void> => {
  try {
    await cliente.post('/auth/logout-todos', {})
  } catch (error) {
    throw extraerError(error)
  }
}
