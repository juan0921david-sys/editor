const adquirirBloqueo = (sala, userId, blockId, { ahora, ttl, liberar, aprobar }) => {
  if (!sala.bloques.some((bloque) => bloque.id === blockId)) return false

  let actual = sala.bloqueos.get(blockId)

  if (actual && ahora - actual.t >= ttl) {
    liberar(blockId)
    actual = undefined
  }

  if (actual && actual.userId !== userId) return false

  for (const [otro, dato] of sala.bloqueos) {
    if (dato.userId === userId && otro !== blockId) liberar(otro)
  }

  if (actual) {
    actual.t = ahora
  } else {
    sala.bloqueos.set(blockId, { userId, t: ahora })
    aprobar(blockId, userId)
  }

  return true
}

module.exports = { adquirirBloqueo }