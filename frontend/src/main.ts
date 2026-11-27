import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useSesionStore } from './stores/sesion'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const sesion = useSesionStore()

sesion.restaurarSesion().finally(() => {
  if (
    sesion.autenticado &&
    router.currentRoute.value.name === 'ingresar'
  ) {
    router.replace({ name: 'editor' })
  }
  app.mount('#app')
})
