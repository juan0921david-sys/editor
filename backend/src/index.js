const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
require('dotenv').config()

const { obtenerDocumento, actualizarTituloBD, actualizarEstructuraBD } = require('./models/document.model')
const pool = require('./config/db')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Backend del Editor Colaborativo activo')
})

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
})

const usuariosPorDocumento = new Map()
const bloqueosPorDocumento = new Map()

io.on('connection', (socket) => {
  let documentoActual = null

  socket.on('unirse', async ({ documentoId, uid, nombre, color }) => {
    documentoActual = documentoId
    socket.join(documentoId)

    if (!usuariosPorDocumento.has(documentoId)) usuariosPorDocumento.set(documentoId, new Map())
    if (!bloqueosPorDocumento.has(documentoId)) bloqueosPorDocumento.set(documentoId, new Map())

    const usuarios = usuariosPorDocumento.get(documentoId)
    usuarios.set(socket.id, { id: socket.id, uid, nombre, color })

    try {
      const doc = await obtenerDocumento(documentoId)
      const bloqueos = Array.from(bloqueosPorDocumento.get(documentoId).entries()).map(([blockId, userId]) => ({ blockId: String(blockId), userId }))
      
      socket.emit('estado_inicial', {
        titulo: doc.titulo,
        bloques: typeof doc.bloques === 'string' ? JSON.parse(doc.bloques) : doc.bloques,
        bloqueos
      })

      io.to(documentoId).emit('presencia', Array.from(usuarios.values()))
    } catch (error) {
      socket.emit('error_servidor')
    }
  })

  socket.on('cambiar_titulo', async (titulo) => {
    if (!documentoActual || typeof titulo !== 'string') return
    socket.to(documentoActual).emit('titulo_actualizado', titulo)
    try {
      await actualizarTituloBD(documentoActual, titulo)
    } catch (e) {}
  })

  socket.on('solicitar_bloqueo', (blockId) => {
    if (!documentoActual) return
    const bId = String(blockId)
    const bloqueos = bloqueosPorDocumento.get(documentoActual)
    
    if (bloqueos.has(bId) && bloqueos.get(bId) !== socket.id) {
      return
    }

    bloqueos.set(bId, socket.id)
    io.to(documentoActual).emit('bloqueo_aprobado', { blockId: bId, userId: socket.id })
  })

  socket.on('liberar_bloqueo', (blockId) => {
    if (!documentoActual) return
    const bId = String(blockId)
    const bloqueos = bloqueosPorDocumento.get(documentoActual)

    if (bloqueos && bloqueos.get(bId) === socket.id) {
      bloqueos.delete(bId)
      io.to(documentoActual).emit('bloque_liberado', bId)
    }
  })

  socket.on('actualizar_contenido', ({ blockId, contenido }) => {
    if (!documentoActual) return
    const bId = String(blockId)
    const bloqueos = bloqueosPorDocumento.get(documentoActual)

    if (!bloqueos.has(bId) || bloqueos.get(bId) === socket.id) {
      bloqueos.set(bId, socket.id)
      socket.to(documentoActual).emit('contenido_actualizado', { blockId: bId, contenido })
    }
  })

  socket.on('estructura_actualizada', (bloques) => {
    if (!documentoActual || !Array.isArray(bloques)) return
    socket.to(documentoActual).emit('estructura_actualizada', bloques)
    actualizarEstructuraBD(documentoActual, bloques).catch(() => {})
  })

  socket.on('disconnect', () => {
    if (!documentoActual) return
    const usuarios = usuariosPorDocumento.get(documentoActual)
    const bloqueos = bloqueosPorDocumento.get(documentoActual)

    if (usuarios) {
      usuarios.delete(socket.id)
      io.to(documentoActual).emit('presencia', Array.from(usuarios.values()))
    }

    if (bloqueos) {
      for (const [blockId, userId] of bloqueos.entries()) {
        if (userId === socket.id) {
          bloqueos.delete(blockId)
          io.to(documentoActual).emit('bloque_liberado', blockId)
        }
      }
    }
  })
})

const PORT = process.env.PORT || 3000

pool.query('SELECT NOW()', (err) => {
  if (!err) {
    server.listen(PORT, () => {})
  }
})