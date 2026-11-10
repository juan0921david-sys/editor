import axios from 'axios'
import { useSessionStore} from '../stores/sesion'

const api = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
withCredentials: true
})
api.interceptors.request.use((config)=>{
    const sesion= useSesionStore()
    if (sesion.acccessToken){
        config.headers.Authorization= `Bearer ${sesion.accessToken}`
}
return config
}, (error)=> Promise.reject(error))

api.interceptors.response.use(
    (response)=>response,
    async(error)=>{
        const originalrequest = error.config
        if (error.response?.status === 403 && !originalRequest._retry){
            originalrequest._retry= true
            try {
                const { data } = await api.post('/auth/refresh')
                const sesion= useSessionStore()
                sesion.accessToken = data.accessToken
                originalrequest.headers.Authorization = `Bearer ${data.accessToken}`
                return api(originalRequest)
            } catch (refreshError){
                const sesion=useSessionStore()
                sesion.cambiarJugador()
                return Promise.reject(refreshError)
            }
        }
        return Promise.reject(error)
    }
)
export default api