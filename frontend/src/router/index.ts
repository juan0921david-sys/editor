import { createRouter, createWebHistory } from 'vue-router'
import EditorView from '../views/EditorView.vue'
import MainLayout from '../layouts/MainLayout.vue'
import PantallaInicio from '../components/PantallaInicio.vue'
import { useSesionStore } from '../stores/sesion'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: EditorView,
      meta: { layout: MainLayout, requiresAuth: true }
    },
    {
      path: '/ingresar',
      name: 'ingresar',
      component: PantallaInicio,
      meta: { requiresAuth: false }
    }
  ]
})

router.beforeEach((to) => {
  const sesion = useSesionStore()

  if (to.meta.requiresAuth === true && !sesion.autenticado) {
    return { name: 'ingresar' }
  }

  if (to.name === 'ingresar' && sesion.autenticado) {
    return { name: 'editor' }
  }

  return true
})

export default router
