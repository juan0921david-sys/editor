
const express = require('express')

const crearAuthRoutes = (controller, middleware) => {
  const router = express.Router()

  router.post('/registro', controller.registrar)
  router.post('/login', controller.login)
  router.post('/refresh', controller.refrescar)
  router.post('/logout', controller.cerrarSesion)
  router.post('/logout-todos', controller.cerrarTodas)
  router.get('/me', middleware.requerirAuth, controller.yo)

  return router
}

module.exports = { crearAuthRoutes }
