
import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useSesionStore } from '../stores/sesion'

type SolicitudConReintento = InternalAxiosRequestConfig & {
  _retry?: boolean
}

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  withCredentials: true
})

api.interceptors.request.use(
  (config) => {
    const sesion = useSesionStore()

    if (sesion.accessToken) {
      config.headers.set(
        'Authorization',
        `Bearer ${sesion.accessToken}`
      )
    }

    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | SolicitudConReintento
      | undefined

    if (
      !originalRequest ||
      error.response?.status !== 403 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const { data } = await axios.post<{ accessToken: string }>(
        `${api.defaults.baseURL}/auth/refresh`,
        {},
        { withCredentials: true }
      )

      const sesion = useSesionStore()

      sesion.accessToken = data.accessToken

      originalRequest.headers.set(
        'Authorization',
        `Bearer ${data.accessToken}`
      )

      return api(originalRequest)
    } catch (refreshError) {
      const sesion = useSesionStore()
      sesion.cambiarJugador()

      return Promise.reject(refreshError)
    }
  }
)

export default api
