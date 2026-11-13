
const express = require('express')
const router = express.Router()
const { loginSeguro, refrescarToken } = require('../controllers/authController')

router.post('/login', loginSeguro)
router.post('/refresh', refrescarToken)

module.exports = router
