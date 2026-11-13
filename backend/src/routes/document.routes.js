
const express = require('express')
const router = express.Router()
const { obtenerDocumentoHttp } = require('../controllers/documentController')

router.get('/:id', obtenerDocumentoHttp)

module.exports = router
