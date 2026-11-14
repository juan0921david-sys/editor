const { z } = require('zod')

const loginSchema = z.strictObject({
  nombre: z.string().trim().min(2).max(16),
  uid: z.string().max(12).optional()
})

module.exports = {
  loginSchema
}