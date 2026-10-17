import { createRouter, createWebHistory } from 'vue-router'
import EditorView from '../views/EditorView.vue'
import MainLayout from '../layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: EditorView,
      meta: { layout: MainLayout }
    }
  ]
})

export default router