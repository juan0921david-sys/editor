const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
require('dotenv').config()

const pool = require('./config/db')
const {
  asegurarTabla,
  obtenerDocumento,
  actualizarTituloBD,
  actualizarEstructuraBD
} = require('./models/document.model')

const PORT = process.env.PORT || 3000
const ESPERA_GUARDADO = 700
const ESPERA_REINTENTO = 3000
const TTL_BLOQUEO = 60000
const REVISION_SALAS = 5000
const MAX_BLOQUES = 2000
const MAX_CONTENIDO = 100000
const MAX_TITULO = 80
const TITULO_POR_DEFECTO = 'Documento sin título'
const COLORES = ['#B9A9E8', '#8B7BE0', '#6F6BD9', '#E8A9D6', '#7FE0C3', '#F2C66D']

const salas = new Map()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Backend del Editor Colaborativo activo')
})

app.get('/salud', (req, res) => {
  res.json({ ok: true, salas: salas.size })
})

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 8000,
  maxHttpBufferSize: 5e6
})

const limpiarId = (valor) =>
  String(valor || '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 32) || 'principal'

const limpiarBloque = (b) => {
  if (!b || b.id === undefined || b.id === null) return null
  return {
    id: String(b.id).slice(0, 64),
    contenido: typeof b.contenido === 'string' ? b.contenido.slice(0, MAX_CONTENIDO) : '',
    tipo: typeof b.tipo === 'string' && b.tipo ? b.tipo.slice(0, 20) : 'parrafo',
    hecho: !!b.hecho
  }
}

const limpiarBloques = (lista) => {
  if (!Array.isArray(lista)) return null
  const vistos = new Set()
  const salida = []
  for (const item of lista.slice(0, MAX_BLOQUES)) {
    const bloque = limpiarBloque(item)
    if (!bloque || vistos.has(bloque.id)) continue
    vistos.add(bloque.id)
    salida.push(bloque)
  }
  return salida
}

const limpiarTitulo = (valor) => (typeof valor === 'string' ? valor.slice(0, MAX_TITULO) : null)

const copiarBloques = (bloques) => bloques.map((b) => ({ ...b }))

const listaUsuarios = (sala) => Array.from(sala.usuarios.values())

const emitirEstadoGuardado = (sala, estado) => {
  io.to(sala.id).emit('estado_guardado', estado)
}

const cargarSala = async (sala) => {
  const doc = await obtenerDocumento(sala.id)
  sala.titulo = typeof doc.titulo === 'string' ? doc.titulo : TITULO_POR_DEFECTO
  const bloques = typeof doc.bloques === 'string' ? JSON.parse(doc.bloques) : doc.bloques
  sala.bloques = limpiarBloques(bloques) || []
}

const crearSala = (id) => {
  const sala = {
    id,
    titulo: TITULO_POR_DEFECTO,
    bloques: [],
    usuarios: new Map(),
    bloqueos: new Map(),
    tituloSucio: false,
    bloquesSucios: false,
    temporizador: null,
    guardando: false,
    cargada: null
  }
  sala.cargada = cargarSala(sala)
  return sala
}

const obtenerSala = (id) => {
  let sala = salas.get(id)
  if (!sala) {
    sala = crearSala(id)
    salas.set(id, sala)
    sala.cargada.catch(() => {
      if (salas.get(id) === sala) salas.delete(id)
    })
  }
  return sala
}

const salaDe = (socket) => {
  const id = socket.data.salaId
  return id ? salas.get(id) || null : null
}

const guardar = async (sala) => {
  if (sala.guardando) return
  sala.guardando = true
  let fallo = false
  while (sala.tituloSucio || sala.bloquesSucios) {
    const titulo = sala.titulo
    const bloques = copiarBloques(sala.bloques)
    const guardarTitulo = sala.tituloSucio
    const guardarBloques = sala.bloquesSucios
    sala.tituloSucio = false
    sala.bloquesSucios = false
    try {
      if (guardarTitulo) await actualizarTituloBD(sala.id, titulo)
      if (guardarBloques) await actualizarEstructuraBD(sala.id, bloques)
    } catch (error) {
      console.error(`[guardado] fallo en el documento ${sala.id}:`, error)
      sala.tituloSucio = sala.tituloSucio || guardarTitulo
      sala.bloquesSucios = sala.bloquesSucios || guardarBloques
      fallo = true
      break
    }
  }
  sala.guardando = false
  if (fallo) {
    emitirEstadoGuardado(sala, 'error')
    programarGuardado(sala, ESPERA_REINTENTO)
  } else {
    emitirEstadoGuardado(sala, 'guardado')
  }
}

const programarGuardado = (sala, espera = ESPERA_GUARDADO) => {
  if (sala.temporizador) return
  sala.temporizador = setTimeout(() => {
    sala.temporizador = null
    guardar(sala)
  }, espera)
}

const marcarSucio = (sala, { titulo = false, bloques = false }) => {
  if (titulo) sala.tituloSucio = true
  if (bloques) sala.bloquesSucios = true
  if (!sala.temporizador) {
    emitirEstadoGuardado(sala, 'guardando')
    programarGuardado(sala)
  }
}

const vaciarSala = async (sala) => {
  if (sala.temporizador) {
    clearTimeout(sala.temporizador)
    sala.temporizador = null
  }
  await guardar(sala)
  const limpia = !sala.tituloSucio && !sala.bloquesSucios && !sala.guardando
  if (sala.usuarios.size === 0 && limpia && salas.get(sala.id) === sala) salas.delete(sala.id)
}

const liberarBloqueo = (sala, blockId) => {
  if (!sala.bloqueos.delete(blockId)) return
  io.to(sala.id).emit('bloque_liberado', blockId)
}

const tomarBloqueo = (sala, socket, blockId) => {
  const actual = sala.bloqueos.get(blockId)
  if (actual && actual.userId !== socket.id) return false
  for (const [otro, dato] of sala.bloqueos) {
    if (dato.userId === socket.id && otro !== blockId) liberarBloqueo(sala, otro)
  }
  if (actual) {
    actual.t = Date.now()
  } else {
    sala.bloqueos.set(blockId, { userId: socket.id, t: Date.now() })
    io.to(sala.id).emit('bloqueo_aprobado', { blockId, userId: socket.id })
  }
  return true
}

const rechazarBloqueo = (sala, socket, blockId) => {
  const dueno = sala.bloqueos.get(blockId)
  if (!dueno) return
  const bloque = sala.bloques.find((b) => b.id === blockId)
  socket.emit('bloqueo_rechazado', {
    blockId,
    userId: dueno.userId,
    contenido: bloque ? bloque.contenido : undefined
  })
}

const salir = (socket) => {
  const id = socket.data.salaId
  if (!id) return
  socket.data.salaId = null
  socket.leave(id)
  const sala = salas.get(id)
  if (!sala) return
  sala.usuarios.delete(socket.id)
  for (const [blockId, dato] of sala.bloqueos) {
    if (dato.userId === socket.id) liberarBloqueo(sala, blockId)
  }
  io.to(id).emit('presencia', listaUsuarios(sala))
  if (sala.usuarios.size === 0) vaciarSala(sala)
}

io.on('connection', (socket) => {
  socket.data.salaId = null
  socket.data.intento = 0

  socket.on('unirse', async (datos) => {
    const info = datos || {}
    const id = limpiarId(info.documentoId)
    const intento = ++socket.data.intento
    salir(socket)
    const sala = obtenerSala(id)

    try {
      await sala.cargada
    } catch (error) {
      console.error(`[carga] no se pudo cargar el documento ${id}:`, error)
      if (!socket.disconnected) socket.emit('error_servidor')
      return
    }

    if (socket.disconnected || socket.data.intento !== intento) return

    const nombre = String(info.nombre || '').trim().slice(0, 16) || 'JUGADOR'
    const color = COLORES.includes(info.color) ? info.color : COLORES[0]
    const uid = String(info.uid || '').slice(0, 12)

    socket.data.salaId = id
    socket.join(id)
    sala.usuarios.set(socket.id, { id: socket.id, uid, nombre, color })

    socket.emit('estado_inicial', {
      titulo: sala.titulo,
      bloques: copiarBloques(sala.bloques),
      bloqueos: Array.from(sala.bloqueos.entries()).map(([blockId, dato]) => ({
        blockId,
        userId: dato.userId
      }))
    })

    io.to(id).emit('presencia', listaUsuarios(sala))
  })

  socket.on('cambiar_titulo', (valor) => {
    const sala = salaDe(socket)
    const titulo = limpiarTitulo(valor)
    if (!sala || titulo === null) return
    sala.titulo = titulo
    socket.to(sala.id).emit('titulo_actualizado', titulo)
    marcarSucio(sala, { titulo: true })
  })

  socket.on('solicitar_bloqueo', (blockId) => {
    const sala = salaDe(socket)
    if (!sala || blockId === undefined || blockId === null) return
    const id = String(blockId).slice(0, 64)
    if (!tomarBloqueo(sala, socket, id)) rechazarBloqueo(sala, socket, id)
  })

  socket.on('liberar_bloqueo', (blockId) => {
    const sala = salaDe(socket)
    if (!sala || blockId === undefined || blockId === null) return
    const id = String(blockId).slice(0, 64)
    const dato = sala.bloqueos.get(id)
    if (dato && dato.userId === socket.id) liberarBloqueo(sala, id)
  })

  socket.on('actualizar_contenido', (datos, ack) => {
    const responder = typeof ack === 'function' ? ack : () => {}
    const sala = salaDe(socket)
    if (!sala || !datos || datos.blockId === undefined || datos.blockId === null) {
      responder({ ok: false, motivo: 'sin_sala' })
      return
    }
    const blockId = String(datos.blockId).slice(0, 64)
    const contenido = typeof datos.contenido === 'string' ? datos.contenido.slice(0, MAX_CONTENIDO) : ''

    if (!tomarBloqueo(sala, socket, blockId)) {
      rechazarBloqueo(sala, socket, blockId)
      responder({ ok: false, motivo: 'bloqueado' })
      return
    }

    const bloque = sala.bloques.find((b) => b.id === blockId)
    if (!bloque) {
      responder({ ok: false, motivo: 'inexistente' })
      return
    }

    bloque.contenido = contenido
    socket.to(sala.id).emit('contenido_actualizado', { blockId, contenido })
    marcarSucio(sala, { bloques: true })
    responder({ ok: true })
  })

  socket.on('estructura_actualizada', (lista) => {
    const sala = salaDe(socket)
    if (!sala) return
    const entrante = limpiarBloques(lista)
    if (!entrante) return

    const previos = new Map(sala.bloques.map((b) => [b.id, b]))

    const fusion = entrante.map((bloque) => {
      const previo = previos.get(bloque.id)
      if (!previo) return bloque
      const dueno = sala.bloqueos.get(bloque.id)
      if (dueno && dueno.userId !== socket.id) return { ...previo }
      const propio = dueno && dueno.userId === socket.id
      return { ...bloque, contenido: propio ? bloque.contenido : previo.contenido }
    })

    const ids = new Set(fusion.map((b) => b.id))
    let corregido = false
    sala.bloques.forEach((bloque, indice) => {
      const dueno = sala.bloqueos.get(bloque.id)
      if (!ids.has(bloque.id) && dueno && dueno.userId !== socket.id) {
        fusion.splice(Math.min(indice, fusion.length), 0, { ...bloque })
        ids.add(bloque.id)
        corregido = true
      }
    })

    sala.bloques = fusion

    for (const blockId of Array.from(sala.bloqueos.keys())) {
      if (!ids.has(blockId)) liberarBloqueo(sala, blockId)
    }

    const destino = corregido ? io.to(sala.id) : socket.to(sala.id)
    destino.emit('estructura_actualizada', copiarBloques(sala.bloques))
    marcarSucio(sala, { bloques: true })
  })

  socket.on('disconnect', () => {
    salir(socket)
  })
})

setInterval(() => {
  const ahora = Date.now()
  for (const sala of Array.from(salas.values())) {
    for (const [blockId, dato] of Array.from(sala.bloqueos.entries())) {
      if (ahora - dato.t > TTL_BLOQUEO) liberarBloqueo(sala, blockId)
    }
    const limpia = !sala.temporizador && !sala.guardando && !sala.tituloSucio && !sala.bloquesSucios
    if (sala.usuarios.size === 0 && limpia) salas.delete(sala.id)
  }
}, REVISION_SALAS)

const apagar = async () => {
  const tareas = []
  for (const sala of salas.values()) {
    if (sala.temporizador) {
      clearTimeout(sala.temporizador)
      sala.temporizador = null
    }
    tareas.push(guardar(sala))
  }
  await Promise.allSettled(tareas)
  process.exit(0)
}

process.on('SIGINT', apagar)
process.on('SIGTERM', apagar)

const iniciar = async () => {
  try {
    await pool.query('SELECT NOW()')
    await asegurarTabla()
  } catch (error) {
    console.error('No se pudo iniciar el backend. Revisa DATABASE_URL y que PostgreSQL esté activo:', error)
    process.exit(1)
  }
  server.listen(PORT, () => {
    console.log(`Backend del editor escuchando en el puerto ${PORT}`)
  })
}

iniciar()