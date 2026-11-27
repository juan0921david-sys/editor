import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useSesionStore } from '../stores/sesion'

type SolicitudConReintento = InternalAxiosRequestConfig & {
  _retry?: boolean
}

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    'http://localhost:3000',
  withCredentials: true
})

api.interceptors.request.use(
  (config) => {
    const sesion = useSesionStore()

    if (sesion.accessToken) {
      config.headers.set('Authorization', `Bearer ${sesion.accessToken}`)
    }

    return config
  },
  (error: unknown) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<unknown>) => {
    const originalRequest = error.config as
      | SolicitudConReintento
      | undefined

    const expirado =
      error.response?.status === 401 || error.response?.status === 403

    if (
      !originalRequest ||
      !expirado ||
      originalRequest._retry ||
      originalRequest.url?.startsWith('/auth/')
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    const sesion = useSesionStore()
    const accessToken = await sesion.renovarToken()

    if (!accessToken) {
      sesion.cerrarSesionLocal()
      return Promise.reject(error)
    }

    originalRequest.headers.set(
      'Authorization',
      `Bearer ${accessToken}`
    )

    return api(originalRequest)
  }
)

export default api
