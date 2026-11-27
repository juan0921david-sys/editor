
const { z } = require('zod')

const correo = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .refine(
    (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
    'correo_invalido'
  )

const password = z.string().min(8).max(128)

const loginSchema = z.strictObject({
  correo,
  password
})

const registroSchema = z.strictObject({
  nombre: z.string().trim().min(2).max(40),
  correo,
  password
})

module.exports = { loginSchema, registroSchema }
