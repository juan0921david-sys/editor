import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import EditorView from '../views/EditorView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('../views/HomeView.vue') // Vista de inicio que puedes crear después
        },
        {
          path: 'editor',
          name: 'editor',
          component: EditorView
        }
      ]
    }
  ]
})

export default router