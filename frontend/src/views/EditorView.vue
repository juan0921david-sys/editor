<template>
  <div class="editor-container">
    <section class="doc-sheet px-panel" :style="{ zoom: sesion.zoom / 100 }">
      <div class="sheet-titlebar no-print" v-show="!sesion.zen">
        <div class="titlebar-left">
          <span class="pixel-dots"><i></i><i></i><i></i></span>
          <input class="titlebar-name-input" v-model="sesion.titulo" @input="alCambiarTitulo" placeholder="Título del documento" />
        </div>
        <div class="hud">
          <span class="hud-item"><span class="led" :class="{ on: conectado }"></span>{{ conectado ? 'ONLINE' : 'OFFLINE' }}</span>
          <span class="hud-item">ID #{{ sesion.uid }}</span>
          <div class="hud-users">
            <span v-for="user in sesion.usuarios" :key="user.id" class="user-badge" :style="{ background: user.color }" :title="user.nombre">
              {{ user.nombre.slice(0, 3) }}
            </span>
          </div>
          <span class="hud-item">{{ sesion.usuarios.length }} JUG</span>
          <span class="hud-item">{{ totalPalabras }} PAL</span>
          <span class="hud-item">{{ totalCaracteres }} CAR</span>
          <span class="hud-item">{{ bloques.length }} BLQ</span>
        </div>
      </div>

      <div class="sheet-body">
        <BlockUI
          v-for="(bloque, index) in bloques"
          :key="String(bloque.id)"
          class="block-wrapper"
          :class="{ 'bloque-bloqueado-externo': bloqueadoPorOtro(bloque) }"
          :bloque="bloque"
          :index="index"
          :isFirst="index === 0"
          :isLast="index === bloques.length - 1"
          :miSocketId="sesion.miId"
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

        <button v-if="bloques.length === 0" class="empty-state" @click="agregarBloqueFinal">
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

const URL_SERVIDOR = 'https://grim-cauldron-974wjj7g6469cx9rj-3000.app.github.dev'
const LIMITE_HISTORIAL = 60
const TIPOS_DE_LISTA = ['lista', 'numerada', 'tarea']

let socket = null
let timeoutGuardado = null
const historial = []
const rehacerPila = []

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

const bloques = ref([
  {
    id: '1',
    contenido: 'El documento está listo. Escribe "/" para ver los tipos de bloque.',
    tipo: 'parrafo',
    hecho: false,
    bloqueadoPor: null
  }
])

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

const textos = computed(() => bloques.value.map((b) => b.contenido ? textoPlano(b.contenido) : ''))
const totalPalabras = computed(() => textos.value.join(' ').split(/\s+/).filter(Boolean).length)
const totalCaracteres = computed(() => textos.value.join('').length)

watch(
  () => [activoId.value, tipoActivo.value],
  ([id, tipo]) => {
    sesion.activo = id !== null && tipo ? { id: String(id), tipo } : null
  },
  { immediate: true }
)

const instantanea = () =>
  bloques.value.map((b) => ({ id: String(b.id), contenido: b.contenido, tipo: b.tipo, hecho: b.hecho }))

const registrar = (antes) => {
  historial.push({ antes, despues: instantanea() })
  if (historial.length > LIMITE_HISTORIAL) historial.shift()
  rehacerPila.length = 0
}

const emitirEstructura = () => {
  if (socket) socket.emit('estructura_actualizada', instantanea())
}

const autoGuardar = () => {
  clearTimeout(timeoutGuardado)
  timeoutGuardado = setTimeout(() => {
    emitirEstructura()
  }, 500)
}

const alCambiarTitulo = (e) => {
  const nuevoTitulo = e.target.value
  sesion.titulo = nuevoTitulo
  if (socket) socket.emit('cambiar_titulo', nuevoTitulo)
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
  if (!bloque || bloqueadoPorOtro(bloque)) {
    sonidos.error()
    return false
  }
  const antes = instantanea()
  if (socket && String(bloque.bloqueadoPor) === String(sesion.miId)) socket.emit('liberar_bloqueo', String(bloque.id))
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
  if (!bloque || bloqueadoPorOtro(bloque) || bloque.tipo === tipo) return
  const antes = instantanea()
  bloque.tipo = tipo
  if (tipo !== 'tarea') bloque.hecho = false
  let objetivo = String(bloque.id)
  if (tipo === 'divisor') {
    bloque.contenido = ''
    if (socket) socket.emit('actualizar_contenido', { blockId: String(bloque.id), contenido: '' })
    const siguiente = crearBloque()
    siguiente.bloqueadoPor = sesion.miId
    bloques.value.splice(index + 1, 0, siguiente)
    if (socket) socket.emit('solicitar_bloqueo', String(siguiente.id))
    objetivo = String(siguiente.id)
  }
  registrar(antes)
  emitirEstructura()
  sonidos.clic()
  enfocarBloque(objetivo, true, tipo !== 'divisor')
}

const alCambiarTipo = ({ index, tipo }) => cambiarTipo(index, tipo)

const alCambiarTipoActivo = (e) => {
  if (indiceActivo.value !== -1) cambiarTipo(indiceActivo.value, e.detail)
}

const alternarHecho = (index) => {
  const bloque = bloques.value[index]
  if (!bloque || bloqueadoPorOtro(bloque)) {
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
  if (bloqueadoPorOtro(bloque)) {
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
  const id = (param1 && param1.id) !== undefined ? String(param1.id) : String(param1)
  const contenido = (param1 && param1.contenido) !== undefined ? param1.contenido : param2

  const bloque = bloques.value.find((b) => String(b.id) === id)
  
  if (bloque && bloque.bloqueadoPor && String(bloque.bloqueadoPor) !== String(sesion.miId)) {
    return
  }

  if (bloque) bloque.contenido = contenido
  if (socket) socket.emit('actualizar_contenido', { blockId: id, contenido })
  autoGuardar()
}

const enviarSolicitudBloqueo = (blockId) => {
  const strId = String(blockId)
  const bloque = bloques.value.find((b) => String(b.id) === strId)
  
  if (bloque && bloque.bloqueadoPor && String(bloque.bloqueadoPor) !== String(sesion.miId)) {
    if (document.activeElement) document.activeElement.blur()
    return
  }

  activoId.value = strId
  if (socket) socket.emit('solicitar_bloqueo', strId)
}

const enviarLiberacionBloqueo = (blockId) => {
  const strId = String(blockId)
  if (String(activoId.value) === strId) activoId.value = null
  emitirEstructura() 
  if (socket) socket.emit('liberar_bloqueo', strId)
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

onMounted(() => {
  socket = io(URL_SERVIDOR)

  socket.on('connect', () => {
    conectado.value = true
    sesion.miId = String(socket.id)
    socket.emit('unirse', {
      documentoId: String(sesion.documentoId),
      uid: sesion.uid,
      nombre: sesion.nombre,
      color: sesion.color
    })
  })

  socket.on('disconnect', () => {
    conectado.value = false
    sesion.usuarios.splice(0, sesion.usuarios.length)
    bloques.value.forEach((b) => {
      b.bloqueadoPor = null
    })
  })

  socket.on('connect_error', () => {
    conectado.value = false
  })

  socket.on('estado_inicial', (estado) => {
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
    
    if (estado && estado.titulo) {
      sesion.titulo = estado.titulo
    }
  })

  socket.on('presencia', recibirPresencia)

  socket.on('titulo_actualizado', (nuevoTitulo) => {
    sesion.titulo = nuevoTitulo
  })

  socket.on('bloqueo_aprobado', ({ blockId, userId }) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (bloque) bloque.bloqueadoPor = String(userId)
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
  if (socket) socket.disconnect()
  sesion.activo = null
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

.sheet-body {
  flex: 1;
  padding: 2.4rem 2.2rem 3.5rem 0.8rem;
}

.bloque-bloqueado-externo {
  opacity: 0.6;
  background-color: rgba(255, 0, 0, 0.04);
  border-radius: 4px;
}

.bloque-bloqueado-externo :deep(.rich-textarea),
.bloque-bloqueado-externo :deep(.block-content),
.bloque-bloqueado-externo :deep([contenteditable="true"]) {
  pointer-events: none !important;
  user-select: none !important;
  cursor: not-allowed !important;
}

.empty-state {
  display: block;
  width: calc(100% - 94px);
  margin-left: 94px;
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
    padding: 1.6rem 0.8rem 2.5rem 0.4rem;
  }

  .empty-state {
    width: calc(100% - 62px);
    margin-left: 62px;
  }
}
</style>