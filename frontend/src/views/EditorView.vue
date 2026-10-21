<template>
  <div class="editor-container">
    <div class="px-toolbar px-panel no-print">
      <button class="tool-btn" title="Deshacer (Ctrl+Z)" @mousedown.prevent="aplicarFormato('undo')">↶</button>
      <button class="tool-btn" title="Rehacer (Ctrl+Y)" @mousedown.prevent="aplicarFormato('redo')">↷</button>

      <span class="divider"></span>

      <button
        v-for="formato in formatos"
        :key="formato.comando"
        :class="['tool-btn', formato.clase, { on: activos[formato.comando] }]"
        :title="formato.titulo"
        @mousedown.prevent="aplicarFormato(formato.comando)"
      >
        {{ formato.etiqueta }}
      </button>

      <span class="divider"></span>

      <button
        v-for="alineacion in alineaciones"
        :key="alineacion.comando"
        :class="['tool-btn', { on: activos[alineacion.comando] }]"
        :title="alineacion.titulo"
        @mousedown.prevent="aplicarFormato(alineacion.comando)"
      >
        <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" shape-rendering="crispEdges">
          <rect v-for="(barra, i) in alineacion.barras" :key="i" :x="barra[0]" :y="barra[1]" :width="barra[2]" height="2" />
        </svg>
      </button>

      <span class="divider"></span>

      <button class="tool-btn quitar" title="Quitar formato" @mousedown.prevent="aplicarFormato('removeFormat')">Tx</button>

      <span class="divider"></span>

      <button class="px-btn primary add-btn" @click="agregarBloqueFinal">+ BLOQUE</button>
    </div>

    <section class="doc-sheet px-panel">
      <div class="sheet-titlebar no-print">
        <div class="titlebar-left">
          <span class="pixel-dots"><i></i><i></i><i></i></span>
          <span class="titlebar-name">DOCUMENTO.DOC</span>
        </div>
        <div class="hud">
          <span class="hud-item"><span class="led" :class="{ on: conectado }"></span>{{ conectado ? 'ONLINE' : 'OFFLINE' }}</span>
          <span class="hud-item">ID {{ idCorto }}</span>
          <span class="hud-item">{{ totalPalabras }} PAL</span>
          <span class="hud-item">{{ bloques.length }} BLQ</span>
        </div>
      </div>

      <div class="sheet-body">
        <BlockUI
          v-for="(bloque, index) in bloques"
          :key="bloque.id"
          :bloque="bloque"
          :index="index"
          :isFirst="index === 0"
          :isLast="index === bloques.length - 1"
          :miSocketId="miSocketId"
          @solicitar-bloqueo="enviarSolicitudBloqueo"
          @liberar-bloqueo="enviarLiberacionBloqueo"
          @update-content="actualizarContenido"
          @add-block="agregarBloqueDespues"
          @delete-block="eliminarBloque"
          @delete-empty="eliminarBloqueVacio"
          @move-up="moverBloqueArriba"
          @move-down="moverBloqueAbajo"
        />

        <button v-if="bloques.length === 0" class="empty-state" @click="agregarBloqueFinal">
          Haz clic aquí para empezar a escribir...
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { io } from 'socket.io-client'
import BlockUI from '../components/BlockUI.vue'

const URL_SERVIDOR = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

let socket = null

const conectado = ref(false)
const miSocketId = ref('')

const bloques = ref([
  {
    id: 1,
    contenido: 'El documento está listo. Selecciona texto y usa las herramientas de arriba.',
    bloqueadoPor: null
  }
])

const formatos = [
  { comando: 'bold', titulo: 'Negrita (Ctrl+B)', etiqueta: 'B', clase: 'fmt-b' },
  { comando: 'italic', titulo: 'Cursiva (Ctrl+I)', etiqueta: 'I', clase: 'fmt-i' },
  { comando: 'underline', titulo: 'Subrayado (Ctrl+U)', etiqueta: 'U', clase: 'fmt-u' },
  { comando: 'strikeThrough', titulo: 'Tachado', etiqueta: 'S', clase: 'fmt-s' }
]

const alineaciones = [
  { comando: 'justifyLeft', titulo: 'Alinear a la izquierda', barras: [[1, 3, 14], [1, 7, 9], [1, 11, 12]] },
  { comando: 'justifyCenter', titulo: 'Centrar', barras: [[1, 3, 14], [4, 7, 8], [2, 11, 12]] },
  { comando: 'justifyRight', titulo: 'Alinear a la derecha', barras: [[1, 3, 14], [6, 7, 9], [3, 11, 12]] },
  { comando: 'justifyFull', titulo: 'Justificar', barras: [[1, 3, 14], [1, 7, 14], [1, 11, 14]] }
]

const activos = reactive({
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  justifyLeft: false,
  justifyCenter: false,
  justifyRight: false,
  justifyFull: false
})

const idCorto = computed(() => (miSocketId.value ? miSocketId.value.slice(0, 4).toUpperCase() : '----'))

const aTextoPlano = (html) => {
  const plantilla = document.createElement('template')
  plantilla.innerHTML = (html || '').replace(/<br\s*\/?>/gi, '\n')
  return plantilla.content.textContent || ''
}

const totalPalabras = computed(() => {
  const texto = bloques.value.map((b) => aTextoPlano(b.contenido)).join(' ')
  return texto.split(/\s+/).filter(Boolean).length
})

const etiquetasPermitidas = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'DIV', 'P', 'SPAN'])
const etiquetasPeligrosas = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META'])
const alineacionesValidas = ['left', 'center', 'right', 'justify']

const sanitizar = (html) => {
  const plantilla = document.createElement('template')
  plantilla.innerHTML = html || ''

  const recorrer = (nodo) => {
    Array.from(nodo.childNodes).forEach((hijo) => {
      if (hijo.nodeType === 3) return
      if (hijo.nodeType !== 1) {
        hijo.remove()
        return
      }
      if (etiquetasPeligrosas.has(hijo.tagName)) {
        hijo.remove()
        return
      }
      if (!etiquetasPermitidas.has(hijo.tagName)) {
        recorrer(hijo)
        hijo.replaceWith(...Array.from(hijo.childNodes))
        return
      }
      const alineacion = hijo.style ? hijo.style.textAlign : ''
      Array.from(hijo.attributes).forEach((atributo) => hijo.removeAttribute(atributo.name))
      if (alineacionesValidas.includes(alineacion)) hijo.style.textAlign = alineacion
      recorrer(hijo)
    })
  }

  recorrer(plantilla.content)
  return plantilla.innerHTML
}

const nuevoId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000)

const bloqueadoPorOtro = (bloque) =>
  !!(bloque && bloque.bloqueadoPor && bloque.bloqueadoPor !== miSocketId.value)

const actualizarActivos = () => {
  const seleccion = window.getSelection()
  const nodo = seleccion ? seleccion.anchorNode : null
  const elemento = nodo ? (nodo.nodeType === 1 ? nodo : nodo.parentElement) : null
  const dentro = !!(elemento && elemento.closest && elemento.closest('.rich-textarea'))

  Object.keys(activos).forEach((comando) => {
    if (!dentro) {
      activos[comando] = false
      return
    }
    try {
      activos[comando] = document.queryCommandState(comando)
    } catch {
      activos[comando] = false
    }
  })
}

const aplicarFormato = (comando) => {
  document.execCommand(comando, false, null)
  actualizarActivos()
}

const enfocarBloque = async (id, alFinal = true) => {
  await nextTick()
  const editor = document.querySelector(`[data-block-id="${id}"] .rich-textarea`)
  if (!editor) return
  editor.focus()
  const rango = document.createRange()
  rango.selectNodeContents(editor)
  rango.collapse(!alFinal)
  const seleccion = window.getSelection()
  seleccion.removeAllRanges()
  seleccion.addRange(rango)
}

const emitirEstructura = () => {
  if (socket) {
    socket.emit(
      'estructura_actualizada',
      bloques.value.map((b) => ({ id: b.id, contenido: b.contenido }))
    )
  }
}

const recibirEstructura = (lista) => {
  if (!Array.isArray(lista)) return
  bloques.value = lista.map((item) => {
    const existente = bloques.value.find((b) => b.id === item.id)
    return existente || { id: item.id, contenido: sanitizar(item.contenido), bloqueadoPor: null }
  })
}

const agregarBloqueFinal = () => {
  const bloque = { id: nuevoId(), contenido: '', bloqueadoPor: null }
  bloques.value.push(bloque)
  emitirEstructura()
  enfocarBloque(bloque.id)
}

const agregarBloqueDespues = (index) => {
  const bloque = { id: nuevoId(), contenido: '', bloqueadoPor: null }
  bloques.value.splice(index + 1, 0, bloque)
  emitirEstructura()
  enfocarBloque(bloque.id)
}

const quitarBloque = (index) => {
  const bloque = bloques.value[index]
  if (!bloque || bloqueadoPorOtro(bloque)) return false
  if (socket && bloque.bloqueadoPor === miSocketId.value) socket.emit('liberar_bloqueo', bloque.id)
  bloques.value.splice(index, 1)
  emitirEstructura()
  return true
}

const eliminarBloque = (index) => {
  quitarBloque(index)
}

const eliminarBloqueVacio = (index) => {
  if (bloques.value.length <= 1) return
  const idAnterior = index > 0 ? bloques.value[index - 1].id : null
  const idSiguiente = bloques.value[index + 1] ? bloques.value[index + 1].id : null
  if (!quitarBloque(index)) return
  if (idAnterior !== null) enfocarBloque(idAnterior, true)
  else if (idSiguiente !== null) enfocarBloque(idSiguiente, false)
}

const mover = (index, destino) => {
  if (destino < 0 || destino >= bloques.value.length) return
  if (bloqueadoPorOtro(bloques.value[index]) || bloqueadoPorOtro(bloques.value[destino])) return
  const [bloque] = bloques.value.splice(index, 1)
  bloques.value.splice(destino, 0, bloque)
  emitirEstructura()
}

const moverBloqueArriba = (index) => mover(index, index - 1)
const moverBloqueAbajo = (index) => mover(index, index + 1)

const actualizarContenido = ({ id, contenido }) => {
  const bloque = bloques.value.find((b) => b.id === id)
  if (bloque) bloque.contenido = contenido
  if (socket) socket.emit('actualizar_contenido', { blockId: id, contenido })
}

const enviarSolicitudBloqueo = (blockId) => {
  if (socket) socket.emit('solicitar_bloqueo', blockId)
}

const enviarLiberacionBloqueo = (blockId) => {
  if (socket) socket.emit('liberar_bloqueo', blockId)
}

const limpiarDocumento = () => {
  const bloque = { id: nuevoId(), contenido: '', bloqueadoPor: null }
  bloques.value = [bloque]
  emitirEstructura()
  enfocarBloque(bloque.id)
}

const escaparHtml = (texto) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const exportarDocumento = (evento) => {
  const { formato, titulo } = evento.detail || {}
  const nombre = (titulo || 'documento').trim().replace(/[\\/:*?"<>|]+/g, '-') || 'documento'
  let contenido = ''
  let tipo = 'text/plain;charset=utf-8'
  let extension = 'txt'

  if (formato === 'html') {
    const parrafos = bloques.value.map((b) => `<div class="bloque">${b.contenido || '<br>'}</div>`).join('\n')
    contenido = `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>${escaparHtml(nombre)}</title>\n<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1b1740}.bloque{margin-bottom:12px}</style>\n</head>\n<body>\n<h1>${escaparHtml(titulo || 'Documento')}</h1>\n${parrafos}\n</body>\n</html>`
    tipo = 'text/html;charset=utf-8'
    extension = 'html'
  } else {
    contenido = bloques.value.map((b) => aTextoPlano(b.contenido)).join('\n\n')
  }

  const archivo = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${nombre}.${extension}`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(() => {
  socket = io(URL_SERVIDOR)

  socket.on('connect', () => {
    conectado.value = true
    miSocketId.value = socket.id
  })

  socket.on('disconnect', () => {
    conectado.value = false
    bloques.value.forEach((b) => {
      b.bloqueadoPor = null
    })
  })

  socket.on('bloqueo_aprobado', ({ blockId, userId }) => {
    const bloque = bloques.value.find((b) => b.id === blockId)
    if (bloque) bloque.bloqueadoPor = userId
  })

  socket.on('bloque_liberado', (blockId) => {
    const bloque = bloques.value.find((b) => b.id === blockId)
    if (bloque) bloque.bloqueadoPor = null
  })

  socket.on('contenido_actualizado', ({ blockId, contenido }) => {
    const bloque = bloques.value.find((b) => b.id === blockId)
    if (!bloque || bloque.bloqueadoPor === miSocketId.value) return
    bloque.contenido = sanitizar(contenido)
  })

  socket.on('estructura_actualizada', recibirEstructura)

  window.addEventListener('limpiar-documento', limpiarDocumento)
  window.addEventListener('exportar-documento', exportarDocumento)
  document.addEventListener('selectionchange', actualizarActivos)
})

onUnmounted(() => {
  if (socket) socket.disconnect()
  window.removeEventListener('limpiar-documento', limpiarDocumento)
  window.removeEventListener('exportar-documento', exportarDocumento)
  document.removeEventListener('selectionchange', actualizarActivos)
})
</script>

<style scoped>
.editor-container {
  width: 100%;
  max-width: 940px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.px-toolbar {
  position: sticky;
  top: calc(var(--nav-h) + 30px);
  z-index: 40;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 12px;
}

.tool-btn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 2px solid transparent;
  color: var(--text);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.06s, background 0.15s;
}

.tool-btn:hover {
  background: var(--accent-soft);
  border-color: var(--ink);
}

.tool-btn:active {
  transform: translate(2px, 2px);
}

.tool-btn.on {
  background: var(--ink);
  color: var(--on-ink);
  border-color: var(--ink);
}

.tool-btn svg {
  display: block;
}

.fmt-b,
.fmt-i,
.fmt-u,
.fmt-s,
.quitar {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1.05rem;
}

.fmt-b {
  font-weight: 700;
}

.fmt-i {
  font-style: italic;
}

.fmt-u {
  text-decoration: underline;
}

.fmt-s {
  text-decoration: line-through;
}

.divider {
  width: 2px;
  height: 22px;
  margin: 0 6px;
  background: var(--ink);
  opacity: 0.35;
}

.add-btn {
  height: 36px;
}

.doc-sheet {
  width: 100%;
  min-height: 72vh;
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
  font-size: 0.6rem;
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

.hud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.hud-item {
  display: inline-flex;
  align-items: center;
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
  padding: 2.4rem 2.2rem 3rem 0.8rem;
}

.empty-state {
  display: block;
  width: 100%;
  margin-left: 70px;
  max-width: calc(100% - 70px);
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
    padding: 1.6rem 0.8rem 2rem 0.4rem;
  }

  .px-toolbar {
    top: calc(var(--nav-h) + 22px);
  }
}
</style>