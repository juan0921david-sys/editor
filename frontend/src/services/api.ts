import axios from 'axios'
import type {
    AxiosError,
    InternalAxiosRequestConfig
} from 'axios'

import { useSesionStore } from '../stores/sesion'
import { leerAccessToken } from '../utils/validacion'

type SolicitudConReintento = InternalAxiosRequestConfig & {
    _retry?: boolean
}

const api = axios.create({
    baseURL:
        import.meta.env.VITE_BACKEND_URL ||
        'http://localhost:3000',
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
    (error: unknown) => Promise.reject(error)
)

api.interceptors.response.use(
    (response) => response,

    async (error: AxiosError<unknown>) => {
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
            const { data } = await axios.post<unknown>(
                `${api.defaults.baseURL}/auth/refresh`,
                {},
                { withCredentials: true }
            )

            const accessToken = leerAccessToken(data)

            if (!accessToken) {
                throw new Error('Respuesta de renovación inválida')
            }

            const sesion = useSesionStore()
            sesion.accessToken = accessToken

            originalRequest.headers.set(
                'Authorization',
                `Bearer ${accessToken}`
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