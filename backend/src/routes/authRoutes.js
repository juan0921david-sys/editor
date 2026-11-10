import { Router } from 'express'
import { loginSeguro, refrescarToken } from '../controllers/authControllers.js'

const router = Router()

router.post('/login', loginSeguro)
router.post('/refresh', refrescarToken)


export default router