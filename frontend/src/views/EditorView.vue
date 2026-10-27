<template>
  <div class="editor-container">
    <section class="doc-sheet px-panel" :style="{ zoom: sesion.zoom / 100 }">
      <div class="sheet-titlebar no-print" v-show="!sesion.zen">
        <div class="titlebar-left">
          <span class="pixel-dots"><i></i><i></i><i></i></span>
          <input class="titlebar-name-input" v-model="sesion.titulo" maxlength="80" placeholder="Título del documento" />
        </div>
        <div class="hud">
          <span class="hud-item"><span class="led" :class="{ on: conectado }"></span>{{ conectado ? 'ONLINE' : 'OFFLINE' }}</span>
          <span class="hud-item">ID #{{ sesion.uid }}</span>
          <div class="hud-users">
            <span
              v-for="user in usuariosVisibles"
              :key="user.id"
              class="user-badge"
              :class="{ yo: user.id === sesion.miId }"
              :style="{ background: user.color }"
              :title="user.nombre"
            >
              {{ user.nombre.slice(0, 3) }}
            </span>
            <span v-if="usuariosExtra > 0" class="user-badge mas">+{{ usuariosExtra }}</span>
          </div>
          <span class="hud-item">{{ sesion.usuarios.length }} JUG</span>
          <span class="hud-item">{{ totalPalabras }} PAL</span>
          <span class="hud-item">{{ totalCaracteres }} CAR</span>
          <span class="hud-item">{{ bloques.length }} BLQ</span>
          <span v-if="puedeEditar" class="hud-item estado-guardado" :class="'estado-' + sesion.guardado">{{ textoGuardado }}</span>
        </div>
      </div>

      <div v-if="!conectado" class="aviso-offline no-print">SIN CONEXIÓN · EDICIÓN EN PAUSA</div>

      <div class="sheet-body">
        <div v-if="!sesion.sincronizado" class="estado-carga no-print">
          {{ conectado ? 'CARGANDO DOCUMENTO...' : 'CONECTANDO CON EL SERVIDOR...' }}
        </div>

        <BlockUI
          v-for="(bloque, index) in bloques"
          :key="String(bloque.id)"
          class="block-wrapper"
          :bloque="bloque"
          :index="index"
          :isFirst="index === 0"
          :isLast="index === bloques.length - 1"
          :miSocketId="sesion.miId"
          :miColor="sesion.color"
          :soloLectura="!puedeEditar"
          :numero="numeros[index]"
          :duenoNombre="nombreDe(bloque.bloqueadoPor)"
          :duenoColor="colorDe(bloque.bloqueadoPor)"
          :indicador="indicadorDe(index)"
          :arrastrado="arrastrando === index"
          :hayArrastre="arrastrando !== null"
          @solicitar-bloqueo="enviarSolicitudBloqueo"
          @liberar-bloqueo="enviarLiberacionBloqueo"
          @update-content="actualizarContenido"
          @add-block="(i) => agregarBloqueDespues(i)"
          @enter-bloque="alPulsarEnter"
          @delete-block="eliminarBloque"
          @delete-empty="alBorrarVacio"
          @move-up="(i) => moverA(i, i - 1)"
          @move-down="(i) => moverA(i, i + 1)"
          @move-key="moverPorTeclado"
          @navegar="navegar"
          @cambiar-tipo="alCambiarTipo"
          @toggle-hecho="alternarHecho"
          @drag-start="iniciarArrastre"
          @drag-over="sobreBloque"
          @drop-block="soltar"
          @drag-end="finArrastre"
        />

        <button v-if="sesion.sincronizado && bloques.length === 0" class="empty-state" @click="agregarBloqueFinal">
          Haz clic aquí para empezar a escribir...
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { io } from 'socket.io-client'
import BlockUI from '../components/BlockUI.vue'
import { sesion, COLORES, nombreDe, colorDe, avisar } from '../stores/sesion'
import { sonidos } from '../utils/sonidos'
import { normalizarTipo } from '../utils/tipos'
import { sanitizar } from '../utils/sanitizar'
import { exportar, textoPlano } from '../utils/exportar'

const URL_SERVIDOR = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const LIMITE_HISTORIAL = 60
const ESPERA_REINTENTO = 3000
const MAX_USUARIOS_HUD = 6
const TIPOS_DE_LISTA = ['lista', 'numerada', 'tarea']

let socket = null
let reintentoUnirse = null
let aplicandoRemoto = false
let tituloPendiente = null
const historial = []
const rehacerPila = []
const pendientes = new Map()

const conectado = ref(false)
const activoId = ref(null)
const arrastrando = ref(null)
const destino = ref(null)

const nuevoId = () => String(Date.now()) + String(Math.floor(Math.random() * 1000))

const crearBloque = (tipo = 'parrafo', contenido = '') => ({
  id: nuevoId(),
  contenido,
  tipo,
  hecho: false,
  bloqueadoPor: null
})

const bloques = ref([])

const puedeEditar = computed(() => conectado.value && sesion.sincronizado)

const textoGuardado = computed(
  () => ({ guardado: 'GUARDADO', guardando: 'GUARDANDO...', error: 'ERROR AL GUARDAR' })[sesion.guardado] || 'GUARDADO'
)

const usuariosVisibles = computed(() => sesion.usuarios.slice(0, MAX_USUARIOS_HUD))
const usuariosExtra = computed(() => Math.max(0, sesion.usuarios.length - MAX_USUARIOS_HUD))

const sinPermiso = () => {
  if (puedeEditar.value) return false
  sonidos.error()
  return true
}

const bloqueadoPorOtro = (bloque) => !!(bloque && bloque.bloqueadoPor && String(bloque.bloqueadoPor) !== String(sesion.miId))

const indiceActivo = computed(() => bloques.value.findIndex((b) => String(b.id) === String(activoId.value)))
const tipoActivo = computed(() => (indiceActivo.value === -1 ? null : bloques.value[indiceActivo.value].tipo))

const numeros = computed(() => {
  let n = 0
  return bloques.value.map((b) => {
    if (b.tipo === 'numerada') {
      n += 1
      return n
    }
    n = 0
    return 0
  })
})

const textos = computed(() => bloques.value.map((b) => (b.contenido ? textoPlano(b.contenido) : '')))
const totalPalabras = computed(() => textos.value.join(' ').split(/\s+/).filter(Boolean).length)
const totalCaracteres = computed(() => textos.value.join('').length)

watch(
  () => [activoId.value, tipoActivo.value],
  ([id, tipo]) => {
    sesion.activo = id !== null && tipo ? { id: String(id), tipo } : null
  },
  { immediate: true }
)

const aplicarTituloRemoto = (titulo) => {
  aplicandoRemoto = true
  sesion.titulo = titulo
  aplicandoRemoto = false
}

watch(
  () => sesion.titulo,
  (valor) => {
    if (aplicandoRemoto) return
    if (socket && puedeEditar.value) {
      socket.emit('cambiar_titulo', valor)
      tituloPendiente = null
    } else {
      tituloPendiente = valor
    }
  },
  { flush: 'sync' }
)

const instantanea = () =>
  bloques.value.map((b) => ({ id: String(b.id), contenido: b.contenido, tipo: b.tipo, hecho: b.hecho }))

const registrar = (antes) => {
  historial.push({ antes, despues: instantanea() })
  if (historial.length > LIMITE_HISTORIAL) historial.shift()
  rehacerPila.length = 0
}

const emitirEstructura = () => {
  if (socket && puedeEditar.value) socket.emit('estructura_actualizada', instantanea())
}

const enviarContenido = (blockId, contenido) => {
  pendientes.set(blockId, contenido)
  if (!socket) return
  socket.emit('actualizar_contenido', { blockId, contenido }, () => {
    if (pendientes.get(blockId) === contenido) pendientes.delete(blockId)
  })
}

const reenviarPendientes = () => {
  Array.from(pendientes.entries()).forEach(([blockId, contenido]) => {
    const bloque = bloques.value.find((b) => String(b.id) === blockId)
    if (!bloque || bloqueadoPorOtro(bloque)) {
      pendientes.delete(blockId)
      return
    }
    bloque.contenido = contenido
    enviarContenido(blockId, contenido)
  })
}

const enfocarBloque = async (id, alFinal = true, soloSiPerdido = false) => {
  await nextTick()
  const editor = document.querySelector(`[data-block-id="${id}"] .rich-textarea`)
  if (!editor) return
  if (soloSiPerdido && document.activeElement === editor) return
  editor.focus()
  const rango = document.createRange()
  rango.selectNodeContents(editor)
  rango.collapse(!alFinal)
  const seleccion = window.getSelection()
  seleccion.removeAllRanges()
  seleccion.addRange(rango)
}

const buscarEditable = (desde, direccion) => {
  let i = desde + direccion
  while (i >= 0 && i < bloques.value.length) {
    const b = bloques.value[i]
    if (!bloqueadoPorOtro(b) && b.tipo !== 'divisor') return b
    i += direccion
  }
  return null
}

const agregarBloqueFinal = () => {
  if (sinPermiso()) return
  const antes = instantanea()
  const bloque = crearBloque()
  bloque.bloqueadoPor = sesion.miId
  bloques.value.push(bloque)
  registrar(antes)
  emitirEstructura()
  if (socket) socket.emit('solicitar_bloqueo', String(bloque.id))
  sonidos.agregar()
  enfocarBloque(bloque.id)
}

const agregarBloqueDespues = (index, tipo = 'parrafo') => {
  if (sinPermiso()) return
  const antes = instantanea()
  const bloque = crearBloque(tipo)
  bloque.bloqueadoPor = sesion.miId
  bloques.value.splice(index + 1, 0, bloque)
  registrar(antes)
  emitirEstructura()
  if (socket) socket.emit('solicitar_bloqueo', String(bloque.id))
  sonidos.agregar()
  enfocarBloque(bloque.id)
}

const quitarBloque = (index) => {
  const bloque = bloques.value[index]
  if (!puedeEditar.value || !bloque || bloqueadoPorOtro(bloque)) {
    sonidos.error()
    return false
  }
  const antes = instantanea()
  if (socket && String(bloque.bloqueadoPor) === String(sesion.miId)) socket.emit('liberar_bloqueo', String(bloque.id))
  pendientes.delete(String(bloque.id))
  bloques.value.splice(index, 1)
  registrar(antes)
  emitirEstructura()
  sonidos.eliminar()
  return true
}

const eliminarBloque = (index) => {
  quitarBloque(index)
}

const cambiarTipo = (index, tipo) => {
  const bloque = bloques.value[index]
  if (!puedeEditar.value || !bloque || bloqueadoPorOtro(bloque) || bloque.tipo === tipo) return
  const antes = instantanea()
  bloque.tipo = tipo
  if (tipo !== 'tarea') bloque.hecho = false
  let objetivo = String(bloque.id)
  if (tipo === 'divisor') {
    bloque.contenido = ''
    enviarContenido(String(bloque.id), '')
    const siguiente = crearBloque()
    siguiente.bloqueadoPor = sesion.miId
    bloques.value.splice(index + 1, 0, siguiente)
    objetivo = String(siguiente.id)
  }
  registrar(antes)
  emitirEstructura()
  if (tipo === 'divisor' && socket) socket.emit('solicitar_bloqueo', objetivo)
  sonidos.clic()
  enfocarBloque(objetivo, true, tipo !== 'divisor')
}

const alCambiarTipo = ({ index, tipo }) => cambiarTipo(index, tipo)

const alCambiarTipoActivo = (e) => {
  if (indiceActivo.value !== -1) cambiarTipo(indiceActivo.value, e.detail)
}

const alternarHecho = (index) => {
  const bloque = bloques.value[index]
  if (!puedeEditar.value || !bloque || bloqueadoPorOtro(bloque)) {
    sonidos.error()
    return
  }
  const antes = instantanea()
  bloque.hecho = !bloque.hecho
  registrar(antes)
  emitirEstructura()
  sonidos.clic()
}

const alPulsarEnter = (index) => {
  const actual = bloques.value[index]
  if (!actual) return
  const vacio = textoPlano(actual.contenido).trim() === ''
  if (vacio && actual.tipo !== 'parrafo') {
    cambiarTipo(index, 'parrafo')
    return
  }
  agregarBloqueDespues(index, TIPOS_DE_LISTA.includes(actual.tipo) ? actual.tipo : 'parrafo')
}

const alBorrarVacio = (index) => {
  const bloque = bloques.value[index]
  if (!bloque) return
  if (bloque.tipo !== 'parrafo') {
    cambiarTipo(index, 'parrafo')
    return
  }
  if (bloques.value.length <= 1) return
  const anterior = index > 0 ? String(bloques.value[index - 1].id) : null
  const siguiente = bloques.value[index + 1] ? String(bloques.value[index + 1].id) : null
  if (!quitarBloque(index)) return
  if (anterior !== null) enfocarBloque(anterior, true)
  else if (siguiente !== null) enfocarBloque(siguiente, false)
}

const moverA = (desde, hacia) => {
  if (hacia < 0 || hacia >= bloques.value.length || desde === hacia) return false
  const bloque = bloques.value[desde]
  if (!puedeEditar.value || bloqueadoPorOtro(bloque)) {
    sonidos.error()
    return false
  }
  const antes = instantanea()
  const [item] = bloques.value.splice(desde, 1)
  bloques.value.splice(hacia, 0, item)
  registrar(antes)
  emitirEstructura()
  sonidos.mover()
  return true
}

const moverPorTeclado = ({ index, dir }) => {
  const id = String(bloques.value[index].id)
  if (moverA(index, index + dir)) enfocarBloque(id, true, true)
}

const navegar = ({ index, dir }) => {
  const objetivo = buscarEditable(index, dir)
  if (objetivo) enfocarBloque(String(objetivo.id), dir < 0)
}

const iniciarArrastre = (index) => {
  arrastrando.value = index
  destino.value = null
}

const sobreBloque = ({ index, despues }) => {
  if (arrastrando.value === null) return
  const actual = destino.value
  if (!actual || actual.index !== index || actual.despues !== despues) destino.value = { index, despues }
}

const indicadorDe = (index) => {
  if (arrastrando.value === null || !destino.value || destino.value.index !== index) return null
  return destino.value.despues ? 'abajo' : 'arriba'
}

const finArrastre = () => {
  arrastrando.value = null
  destino.value = null
}

const soltar = () => {
  const desde = arrastrando.value
  const objetivo = destino.value
  finArrastre()
  if (desde === null || !objetivo) return
  let hacia = objetivo.index + (objetivo.despues ? 1 : 0)
  if (desde < hacia) hacia -= 1
  moverA(desde, hacia)
}

const actualizarContenido = (param1, param2) => {
  if (!puedeEditar.value) return
  const id = (param1 && param1.id) !== undefined ? String(param1.id) : String(param1)
  const contenido = (param1 && param1.contenido) !== undefined ? param1.contenido : param2

  const bloque = bloques.value.find((b) => String(b.id) === id)

  if (bloque && bloqueadoPorOtro(bloque)) return

  if (bloque) bloque.contenido = contenido
  enviarContenido(id, contenido)
}

const enviarSolicitudBloqueo = (blockId) => {
  const strId = String(blockId)
  const bloque = bloques.value.find((b) => String(b.id) === strId)

  if (bloque && bloqueadoPorOtro(bloque)) {
    if (document.activeElement) document.activeElement.blur()
    return
  }

  activoId.value = strId
  if (socket && puedeEditar.value) socket.emit('solicitar_bloqueo', strId)
}

const enviarLiberacionBloqueo = (blockId) => {
  const strId = String(blockId)
  if (String(activoId.value) === strId) activoId.value = null
  if (socket && puedeEditar.value) socket.emit('liberar_bloqueo', strId)
}

const aplicarInstantanea = (lista) => {
  const ids = new Set(lista.map((i) => String(i.id)))
  const eliminados = bloques.value.filter((b) => !ids.has(String(b.id)))
  if (eliminados.some(bloqueadoPorOtro)) return false
  eliminados.forEach((b) => {
    if (socket && String(b.bloqueadoPor) === String(sesion.miId)) socket.emit('liberar_bloqueo', String(b.id))
  })

  const fusion = lista.map((item) => {
    const actual = bloques.value.find((b) => String(b.id) === String(item.id))
    if (actual) {
      actual.tipo = item.tipo
      actual.hecho = item.hecho
      return actual
    }
    return { id: String(item.id), contenido: item.contenido, tipo: item.tipo, hecho: item.hecho, bloqueadoPor: null }
  })

  bloques.value.splice(0, bloques.value.length, ...fusion)
  emitirEstructura()
  return true
}

const editorActivo = () => {
  const el = document.activeElement
  return !!(el && el.classList && el.classList.contains('rich-textarea'))
}

const usarHistorialNativo = (comando) => {
  if (!editorActivo()) return false
  try {
    if (document.queryCommandEnabled(comando)) {
      document.execCommand(comando)
      return true
    }
  } catch {
    return false
  }
  return false
}

const deshacer = () => {
  if (usarHistorialNativo('undo')) return
  if (!puedeEditar.value) return
  const entrada = historial.pop()
  if (!entrada) {
    sonidos.error()
    return
  }
  if (aplicarInstantanea(entrada.antes)) {
    rehacerPila.push(entrada)
    sonidos.mover()
  } else {
    historial.push(entrada)
    sonidos.error()
  }
}

const rehacer = () => {
  if (usarHistorialNativo('redo')) return
  if (!puedeEditar.value) return
  const entrada = rehacerPila.pop()
  if (!entrada) {
    sonidos.error()
    return
  }
  if (aplicarInstantanea(entrada.despues)) {
    historial.push(entrada)
    sonidos.mover()
  } else {
    rehacerPila.push(entrada)
    sonidos.error()
  }
}

const alTeclaGlobal = (e) => {
  const control = e.ctrlKey || e.metaKey
  if (!control || e.altKey) return
  if (e.target && e.target.closest && e.target.closest('input, textarea')) return
  const tecla = e.key.toLowerCase()
  if (tecla === 'z' && !e.shiftKey) {
    e.preventDefault()
    deshacer()
  } else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) {
    e.preventDefault()
    rehacer()
  }
}

const recibirEstructura = (lista) => {
  if (!Array.isArray(lista)) return
  finArrastre()

  const fusion = lista.map((item) => {
    const existente = bloques.value.find((b) => String(b.id) === String(item.id))
    if (existente) {
      existente.tipo = item.tipo !== undefined ? normalizarTipo(item.tipo, existente.tipo) : existente.tipo
      existente.hecho = item.hecho !== undefined ? !!item.hecho : existente.hecho
      if (item.contenido !== undefined && String(existente.bloqueadoPor) !== String(sesion.miId)) {
        existente.contenido = sanitizar(item.contenido)
      }
      return existente
    }
    return {
      id: String(item.id),
      contenido: item.contenido ? sanitizar(item.contenido) : '',
      tipo: normalizarTipo(item.tipo),
      hecho: !!item.hecho,
      bloqueadoPor: null
    }
  })
  bloques.value.splice(0, bloques.value.length, ...fusion)
}

const recibirPresencia = (lista) => {
  if (!Array.isArray(lista)) return
  const limpia = lista.map((u) => ({
    id: String(u.id),
    uid: String(u.uid || '').slice(0, 12),
    nombre: String(u.nombre || '').slice(0, 16) || 'JUGADOR',
    color: COLORES.includes(u.color) ? u.color : COLORES[0]
  }))

  const previos = new Set(sesion.usuarios.map((u) => String(u.id)))
  const nuevos = new Set(limpia.map((u) => String(u.id)))

  if (previos.size > 0) {
    limpia.forEach((u) => {
      if (!previos.has(String(u.id)) && String(u.id) !== String(sesion.miId)) {
        avisar(`${u.nombre.toUpperCase()} SE UNIÓ`)
        sonidos.entrar()
      }
    })
    sesion.usuarios.forEach((u) => {
      if (!nuevos.has(String(u.id))) {
        avisar(`${u.nombre.toUpperCase()} SALIÓ`)
        sonidos.salir()
      }
    })
  }

  sesion.usuarios.splice(0, sesion.usuarios.length, ...limpia)
}

const alExportar = async (e) => {
  const formato = e.detail && e.detail.formato
  if (!formato) return
  avisar('PREPARANDO ARCHIVO...')
  try {
    await exportar(formato, {
      titulo: sesion.titulo,
      autor: sesion.nombre,
      bloques: instantanea()
    })
    avisar('ARCHIVO DESCARGADO')
    sonidos.agregar()
  } catch (error) {
    avisar('NO SE PUDO EXPORTAR')
    sonidos.error()
  }
}

const unirse = () => {
  if (!socket || !socket.connected) return
  socket.emit('unirse', {
    documentoId: String(sesion.documentoId),
    uid: sesion.uid,
    nombre: sesion.nombre,
    color: sesion.color
  })
}

const alRecibirEstadoInicial = (estado) => {
  const lista = estado && Array.isArray(estado.bloques) ? estado.bloques : []
  const inicial = lista.map((b) => ({
    id: String(b.id),
    contenido: b.contenido ? sanitizar(b.contenido) : '',
    tipo: normalizarTipo(b.tipo),
    hecho: !!b.hecho,
    bloqueadoPor: null
  }))
  bloques.value.splice(0, bloques.value.length, ...inicial)

  ;((estado && estado.bloqueos) || []).forEach(({ blockId, userId }) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (bloque) bloque.bloqueadoPor = String(userId)
  })

  aplicarTituloRemoto(estado && typeof estado.titulo === 'string' ? estado.titulo : '')

  historial.length = 0
  rehacerPila.length = 0
  sesion.guardado = 'guardado'
  sesion.sincronizado = true

  if (tituloPendiente !== null) {
    const local = tituloPendiente
    tituloPendiente = null
    sesion.titulo = local
  }

  reenviarPendientes()

  if (activoId.value !== null) {
    const bloqueActivo = bloques.value.find((b) => String(b.id) === String(activoId.value))
    if (bloqueActivo && !bloqueadoPorOtro(bloqueActivo)) socket.emit('solicitar_bloqueo', String(activoId.value))
    else activoId.value = null
  }
}

onMounted(() => {
  socket = io(URL_SERVIDOR)

  socket.on('connect', () => {
    conectado.value = true
    sesion.miId = String(socket.id)
    unirse()
  })

  socket.on('disconnect', () => {
    conectado.value = false
    sesion.sincronizado = false
    sesion.usuarios.splice(0, sesion.usuarios.length)
    bloques.value.forEach((b) => {
      b.bloqueadoPor = null
    })
    clearTimeout(reintentoUnirse)
  })

  socket.on('connect_error', () => {
    conectado.value = false
    sesion.sincronizado = false
  })

  socket.on('error_servidor', () => {
    avisar('NO SE PUDO CARGAR EL DOCUMENTO')
    clearTimeout(reintentoUnirse)
    reintentoUnirse = setTimeout(unirse, ESPERA_REINTENTO)
  })

  socket.on('estado_inicial', alRecibirEstadoInicial)

  socket.on('presencia', recibirPresencia)

  socket.on('estado_guardado', (estado) => {
    if (['guardado', 'guardando', 'error'].includes(estado)) sesion.guardado = estado
  })

  socket.on('titulo_actualizado', (nuevoTitulo) => {
    if (typeof nuevoTitulo === 'string') aplicarTituloRemoto(nuevoTitulo)
  })

  socket.on('bloqueo_aprobado', ({ blockId, userId }) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (bloque) bloque.bloqueadoPor = String(userId)
  })

  socket.on('bloqueo_rechazado', ({ blockId, userId, contenido }) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (bloque) {
      bloque.bloqueadoPor = String(userId)
      if (typeof contenido === 'string') bloque.contenido = sanitizar(contenido)
    }
    pendientes.delete(String(blockId))
    if (String(activoId.value) === String(blockId)) activoId.value = null
    const enfocado = document.activeElement
    if (enfocado && enfocado.closest && enfocado.closest(`[data-block-id="${blockId}"]`)) enfocado.blur()
    sonidos.error()
  })

  socket.on('bloque_liberado', (blockId) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (bloque) bloque.bloqueadoPor = null
  })

  socket.on('contenido_actualizado', ({ blockId, contenido }) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (!bloque || String(bloque.bloqueadoPor) === String(sesion.miId)) return
    bloque.contenido = contenido ? sanitizar(contenido) : ''
  })

  socket.on('estructura_actualizada', recibirEstructura)

  window.addEventListener('keydown', alTeclaGlobal)
  window.addEventListener('deshacer-documento', deshacer)
  window.addEventListener('rehacer-documento', rehacer)
  window.addEventListener('agregar-bloque-final', agregarBloqueFinal)
  window.addEventListener('cambiar-tipo-activo', alCambiarTipoActivo)
  window.addEventListener('exportar-documento', alExportar)
})

onUnmounted(() => {
  clearTimeout(reintentoUnirse)
  if (socket) socket.disconnect()
  socket = null
  sesion.activo = null
  sesion.sincronizado = false
  sesion.guardado = 'guardado'
  window.removeEventListener('keydown', alTeclaGlobal)
  window.removeEventListener('deshacer-documento', deshacer)
  window.removeEventListener('rehacer-documento', rehacer)
  window.removeEventListener('agregar-bloque-final', agregarBloqueFinal)
  window.removeEventListener('cambiar-tipo-activo', alCambiarTipoActivo)
  window.removeEventListener('exportar-documento', alExportar)
})
</script>

<style scoped>
.editor-container {
  width: 100%;
  max-width: 960px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.doc-sheet {
  width: 100%;
  min-height: 74vh;
  display: flex;
  flex-direction: column;
  background: var(--sheet);
  box-shadow: 8px 8px 0 var(--shadow), inset 0 0 0 2px var(--sheet), inset 0 0 0 4px var(--accent-soft);
}

.sheet-titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 9px 14px;
  background: var(--ink);
  color: var(--on-ink);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pixel-dots i {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  background: var(--on-ink);
  opacity: 0.85;
}

.titlebar-name-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--on-ink);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  outline: none;
  width: 250px;
  transition: border 0.2s ease;
}

.titlebar-name-input:focus {
  border-bottom: 1px solid var(--on-ink);
}

.hud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.hud-item {
  display: inline-flex;
  align-items: center;
}

.hud-users {
  display: flex;
  gap: 4px;
  align-items: center;
}

.user-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 5px;
  font-size: 0.45rem;
  font-weight: bold;
  color: #1b1740;
  border: 1px solid var(--on-ink);
}

.user-badge.yo {
  outline: 2px solid var(--on-ink);
  outline-offset: 1px;
}

.user-badge.mas {
  background: var(--on-ink);
}

.estado-guardado.estado-guardando {
  opacity: 0.85;
  animation: parpadeo 1s steps(2) infinite;
}

.estado-guardado.estado-error {
  color: #ff8a8a;
}

.led {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 7px;
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}

.led.on {
  background: #4ade80;
  box-shadow: 0 0 6px #4ade80;
  animation: parpadeo 1.6s steps(2) infinite;
}

.aviso-offline {
  padding: 7px 14px;
  background: #ef4444;
  color: #ffffff;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  text-align: center;
}

.sheet-body {
  --gutter: 84px;
  flex: 1;
  padding: 1.6rem 1.6rem 3rem 0.4rem;
}

.estado-carga {
  margin-left: var(--gutter);
  padding: 14px 12px;
  color: var(--muted);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  animation: parpadeo 1.2s steps(2) infinite;
}

.empty-state {
  display: block;
  width: calc(100% - var(--gutter));
  margin-left: var(--gutter);
  padding: 14px;
  background: transparent;
  border: 2px dashed var(--ink);
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-style: italic;
  font-size: 0.95rem;
  text-align: left;
  cursor: text;
}

@media (max-width: 640px) {
  .sheet-body {
    --gutter: 62px;
    padding: 1.2rem 0.8rem 2.5rem 0.2rem;
  }
}
</style>