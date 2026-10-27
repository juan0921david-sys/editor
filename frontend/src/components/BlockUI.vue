<template>
  <div
    ref="filaRef"
    class="block-row"
    :class="{
      locked: bloqueadoPorOtro,
      editing: enfocado,
      'menu-open': menuVisible,
      arrastrado,
      'ind-arriba': indicador === 'arriba',
      'ind-abajo': indicador === 'abajo'
    }"
    :data-block-id="String(bloque.id)"
    :data-tipo="bloque.tipo"
    :style="{ '--dueno': duenoColor || 'var(--ink)', '--yo': miColor || 'var(--ink)' }"
    @dragover="alArrastrarSobre"
    @drop="alSoltar"
  >
    <div class="block-controls no-print">
      <span
        class="handle"
        :class="{ deshabilitado: bloqueadoPorOtro || soloLectura }"
        :draggable="!bloqueadoPorOtro && !soloLectura"
        title="Arrastrar para mover"
        aria-label="Arrastrar bloque"
        @dragstart="alIniciarArrastre"
        @dragend="$emit('drag-end')"
      >
        ⋮⋮
      </span>
      <button type="button" title="Añadir bloque debajo" :disabled="soloLectura" @click="$emit('add-block', index)">+</button>
      <button type="button" class="danger" title="Eliminar" :disabled="bloqueadoPorOtro || soloLectura" @click="$emit('delete-block', index)">×</button>
      <button type="button" title="Subir" :disabled="isFirst || bloqueadoPorOtro || soloLectura" @click="$emit('move-up', index)">▲</button>
      <button type="button" title="Bajar" :disabled="isLast || bloqueadoPorOtro || soloLectura" @click="$emit('move-down', index)">▼</button>
    </div>

    <div class="block-main">
      <span class="lock-badge no-print" v-if="bloqueadoPorOtro" :style="{ background: duenoColor }">
        {{ duenoNombre || 'ALGUIEN' }}
      </span>

      <div class="block-body">
        <span v-if="bloque.tipo === 'lista'" class="marcador cuadro" aria-hidden="true"></span>
        <span v-else-if="bloque.tipo === 'numerada'" class="marcador numero" aria-hidden="true">{{ numero }}.</span>
        <button
          v-else-if="bloque.tipo === 'tarea'"
          type="button"
          role="checkbox"
          class="marcador casilla"
          :class="{ on: bloque.hecho }"
          :aria-checked="bloque.hecho"
          :disabled="bloqueadoPorOtro || soloLectura"
          @mousedown.prevent
          @click="$emit('toggle-hecho', index)"
        >
          <span v-if="bloque.hecho">✓</span>
        </button>

        <div v-if="bloque.tipo === 'divisor'" class="divisor" tabindex="0" role="separator" @keydown="alTeclaDivisor">
          <i></i>
        </div>

        <div
          ref="editorRef"
          class="rich-textarea"
          :class="{ hecho: bloque.tipo === 'tarea' && bloque.hecho }"
          :contenteditable="editable"
          :data-placeholder="placeholder"
          :spellcheck="bloque.tipo !== 'codigo'"
          @focus="alEnfocar"
          @blur="alDesenfocar"
          @input="alEscribir"
          @keydown="alPulsarTecla"
          @paste="alPegar"
        ></div>
      </div>

      <div class="slash-menu px-panel no-print" v-if="menuVisible">
        <div class="slash-titulo">BLOQUES</div>
        <button
          v-for="(tipo, i) in opciones"
          :key="tipo.id"
          type="button"
          class="slash-item"
          :class="{ activo: i === seleccion }"
          @mousedown.prevent
          @mouseenter="seleccion = i"
          @click="elegirTipo(tipo.id)"
        >
          <span class="slash-icono">{{ tipo.icono }}</span>
          <span class="slash-texto"><strong>{{ tipo.etiqueta }}</strong><small>{{ tipo.descripcion }}</small></span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { TIPOS_CON_ENTER_BLOQUE, filtrarTipos } from '../utils/tipos'

const props = defineProps({
  bloque: Object,
  index: Number,
  isFirst: Boolean,
  isLast: Boolean,
  miSocketId: String,
  miColor: String,
  soloLectura: Boolean,
  numero: Number,
  duenoNombre: String,
  duenoColor: String,
  indicador: String,
  arrastrado: Boolean,
  hayArrastre: Boolean
})

const emit = defineEmits([
  'add-block',
  'enter-bloque',
  'delete-block',
  'delete-empty',
  'move-up',
  'move-down',
  'move-key',
  'navegar',
  'update-content',
  'solicitar-bloqueo',
  'liberar-bloqueo',
  'cambiar-tipo',
  'toggle-hecho',
  'drag-start',
  'drag-over',
  'drop-block',
  'drag-end'
])

const filaRef = ref(null)
const editorRef = ref(null)
const enfocado = ref(false)
const menuAbierto = ref(false)
const filtro = ref('')
const seleccion = ref(0)

const bloqueadoPorOtro = computed(
  () => !!props.bloque.bloqueadoPor && String(props.bloque.bloqueadoPor) !== String(props.miSocketId)
)

const editable = computed(() => !bloqueadoPorOtro.value && !props.soloLectura && props.bloque.tipo !== 'divisor')
const opciones = computed(() => filtrarTipos(filtro.value))
const menuVisible = computed(() => menuAbierto.value && opciones.value.length > 0)

const placeholder = computed(
  () =>
    ({
      h1: 'Título 1',
      h2: 'Título 2',
      h3: 'Título 3',
      lista: 'Elemento de lista',
      numerada: 'Elemento numerado',
      tarea: 'Tarea pendiente',
      cita: 'Escribe una cita...',
      codigo: 'Escribe código...'
    })[props.bloque.tipo] || "Escribe '/' para ver los bloques..."
)

onMounted(() => {
  if (editorRef.value) editorRef.value.innerHTML = props.bloque.contenido || ''
})

watch(
  () => props.bloque.contenido,
  (nuevo) => {
    const editor = editorRef.value
    if (!editor) return
    if (enfocado.value && !bloqueadoPorOtro.value) return
    const valor = nuevo || ''
    if (editor.innerHTML !== valor) editor.innerHTML = valor
  }
)

const cerrarMenu = () => {
  menuAbierto.value = false
  filtro.value = ''
  seleccion.value = 0
}

const alEnfocar = () => {
  enfocado.value = true
  if (!bloqueadoPorOtro.value && !props.soloLectura) emit('solicitar-bloqueo', String(props.bloque.id))
}

const alDesenfocar = () => {
  enfocado.value = false
  cerrarMenu()
  if (!bloqueadoPorOtro.value) emit('liberar-bloqueo', String(props.bloque.id))
}

const revisarComando = (texto) => {
  if (props.bloque.tipo === 'codigo' || !texto.startsWith('/') || texto.includes('\n')) {
    cerrarMenu()
    return
  }
  filtro.value = texto.slice(1).trim()
  seleccion.value = 0
  menuAbierto.value = true
}

const alEscribir = (e) => {
  const editor = e.target
  if (editor.innerHTML === '<br>') editor.innerHTML = ''
  emit('update-content', { id: String(props.bloque.id), contenido: editor.innerHTML })
  revisarComando(editor.textContent)
}

const elegirTipo = (id) => {
  if (editorRef.value) editorRef.value.innerHTML = ''
  emit('update-content', { id: String(props.bloque.id), contenido: '' })
  cerrarMenu()
  emit('cambiar-tipo', { index: props.index, tipo: id })
}

const esVacio = () => {
  const editor = editorRef.value
  return !!editor && editor.textContent.length === 0 && editor.querySelectorAll('div, br').length === 0
}

const posicionLinea = () => {
  const editor = editorRef.value
  const seleccionActual = window.getSelection()
  if (!editor || !seleccionActual || seleccionActual.rangeCount === 0 || !seleccionActual.isCollapsed) return null
  const rango = seleccionActual.getRangeAt(0).cloneRange()
  rango.collapse(true)
  const rect = rango.getClientRects()[0]
  if (!rect) return { primera: true, ultima: true }
  const caja = editor.getBoundingClientRect()
  const estilo = getComputedStyle(editor)
  const alto = parseFloat(estilo.lineHeight) || rect.height
  const arriba = rect.top - caja.top - parseFloat(estilo.paddingTop)
  const abajo = caja.bottom - rect.bottom - parseFloat(estilo.paddingBottom)
  return { primera: arriba < alto * 0.6, ultima: abajo < alto * 0.6 }
}

const alPulsarTecla = (e) => {
  if (e.isComposing) return
  const tecla = e.key

  if (menuVisible.value) {
    if (tecla === 'ArrowDown') {
      e.preventDefault()
      seleccion.value = (seleccion.value + 1) % opciones.value.length
      return
    }
    if (tecla === 'ArrowUp') {
      e.preventDefault()
      seleccion.value = (seleccion.value - 1 + opciones.value.length) % opciones.value.length
      return
    }
    if (tecla === 'Enter' || tecla === 'Tab') {
      e.preventDefault()
      elegirTipo(opciones.value[seleccion.value].id)
      return
    }
    if (tecla === 'Escape') {
      e.preventDefault()
      cerrarMenu()
      return
    }
  }

  if (e.altKey && (tecla === 'ArrowUp' || tecla === 'ArrowDown')) {
    e.preventDefault()
    emit('move-key', { index: props.index, dir: tecla === 'ArrowUp' ? -1 : 1 })
    return
  }

  if (tecla === 'Enter') {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      emit('add-block', props.index)
      return
    }
    if (TIPOS_CON_ENTER_BLOQUE.includes(props.bloque.tipo) && !e.shiftKey) {
      e.preventDefault()
      emit('enter-bloque', props.index)
      return
    }
    if (props.bloque.tipo === 'codigo' || e.shiftKey) {
      e.preventDefault()
      document.execCommand('insertLineBreak')
    }
    return
  }

  if (tecla === 'Backspace' && esVacio()) {
    e.preventDefault()
    emit('delete-empty', props.index)
    return
  }

  if ((tecla === 'ArrowUp' || tecla === 'ArrowDown') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const posicion = posicionLinea()
    if (!posicion) return
    if (tecla === 'ArrowUp' && posicion.primera) {
      e.preventDefault()
      emit('navegar', { index: props.index, dir: -1 })
    } else if (tecla === 'ArrowDown' && posicion.ultima) {
      e.preventDefault()
      emit('navegar', { index: props.index, dir: 1 })
    }
  }
}

const alTeclaDivisor = (e) => {
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    emit('delete-block', props.index)
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    emit('navegar', { index: props.index, dir: e.key === 'ArrowUp' ? -1 : 1 })
  } else if (e.key === 'Enter') {
    e.preventDefault()
    emit('add-block', props.index)
  }
}

const alPegar = (e) => {
  e.preventDefault()
  const datos = e.clipboardData || window.clipboardData
  const texto = datos ? datos.getData('text/plain') : ''
  document.execCommand('insertText', false, texto)
}

const alIniciarArrastre = (e) => {
  if (bloqueadoPorOtro.value || props.soloLectura) {
    e.preventDefault()
    return
  }
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(props.bloque.id))
  if (filaRef.value) e.dataTransfer.setDragImage(filaRef.value, 24, 16)
  emit('drag-start', props.index)
}

const alArrastrarSobre = (e) => {
  if (!props.hayArrastre) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  const caja = filaRef.value.getBoundingClientRect()
  emit('drag-over', { index: props.index, despues: e.clientY > caja.top + caja.height / 2 })
}

const alSoltar = (e) => {
  if (!props.hayArrastre) return
  e.preventDefault()
  emit('drop-block')
}
</script>

<style scoped>
.block-row {
  position: relative;
  display: grid;
  grid-template-columns: var(--gutter, 84px) 1fr;
  align-items: start;
  margin-bottom: 2px;
}

.block-row.menu-open {
  z-index: 30;
}

.block-row.arrastrado {
  opacity: 0.35;
}

.block-row.ind-arriba::before,
.block-row.ind-abajo::after {
  content: '';
  position: absolute;
  left: var(--gutter, 84px);
  right: 0;
  height: 4px;
  z-index: 5;
  background: var(--ink);
  box-shadow: 0 0 10px var(--accent);
}

.block-row.ind-arriba::before {
  top: -3px;
}

.block-row.ind-abajo::after {
  bottom: -3px;
}

.block-controls {
  position: absolute;
  left: 0;
  top: 3px;
  z-index: 6;
  width: calc(var(--gutter, 84px) - 6px);
  display: grid;
  grid-template-columns: repeat(3, 24px);
  gap: 2px;
  justify-content: end;
  opacity: 0;
  transform: translateX(-6px);
  transition: opacity 0.15s, transform 0.15s;
  pointer-events: none;
}

.block-row:hover .block-controls,
.block-row:focus-within .block-controls {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

@media (hover: none) {
  .block-controls {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }
}

.block-controls button,
.handle {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  padding: 0;
  background: var(--panel);
  color: var(--text);
  border: 2px solid var(--ink);
  box-shadow: 2px 2px 0 var(--shadow);
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.06s, box-shadow 0.06s, background 0.15s;
}

.handle {
  cursor: grab;
  letter-spacing: -2px;
  user-select: none;
}

.handle.deshabilitado {
  opacity: 0.25;
  cursor: not-allowed;
  box-shadow: none;
}

.block-controls button:hover:not(:disabled),
.handle:hover:not(.deshabilitado) {
  background: var(--accent);
  color: var(--on-accent);
}

.block-controls button:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.block-controls button:disabled {
  opacity: 0.25;
  box-shadow: none;
  cursor: default;
}

.block-controls .danger:hover:not(:disabled) {
  background: #ef4444;
  color: #ffffff;
}

.block-main {
  grid-column: 2;
  position: relative;
  min-width: 0;
}

.block-row.editing .block-main::before,
.block-row.locked .block-main::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  z-index: 1;
  pointer-events: none;
}

.block-row.editing .block-main::before {
  background: var(--yo);
}

.block-row.locked .block-main::before {
  background: var(--dueno);
}

.block-body {
  display: flex;
  align-items: flex-start;
}

.rich-textarea {
  flex: 1;
  min-width: 0;
  min-height: 1.6em;
  padding: 4px 12px;
  background: transparent;
  color: var(--text);
  border: 2px solid transparent;
  outline: none;
  caret-color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1rem;
  line-height: 1.6;
  word-break: break-word;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.block-row:hover:not(.locked) .rich-textarea {
  background: var(--hover);
}

.block-row.editing .rich-textarea {
  background: var(--hover);
  border-color: var(--yo);
  box-shadow: 3px 3px 0 var(--shadow);
}

.block-row.locked .rich-textarea {
  border: 2px dashed var(--dueno);
  background: var(--hover);
  background: color-mix(in srgb, var(--dueno) 16%, transparent);
  opacity: 0.88;
  cursor: default;
}

.rich-textarea:empty::before {
  content: attr(data-placeholder);
  color: var(--muted);
  opacity: 0.65;
  pointer-events: none;
}

.rich-textarea.hecho {
  text-decoration: line-through;
  opacity: 0.55;
}

.block-row[data-tipo='h1'] .rich-textarea {
  padding-top: 12px;
  padding-bottom: 6px;
  font-family: 'Press Start 2P', monospace;
  font-size: 1.15rem;
  line-height: 1.7;
}

.block-row[data-tipo='h2'] .rich-textarea {
  padding-top: 8px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.95rem;
  line-height: 1.7;
}

.block-row[data-tipo='h3'] .rich-textarea {
  padding-top: 6px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.8rem;
  line-height: 1.8;
}

.block-row[data-tipo='cita'] .rich-textarea {
  padding-left: 16px;
  border-left: 5px solid var(--accent);
  background: var(--hover);
  font-style: italic;
}

.block-row[data-tipo='codigo'] .rich-textarea {
  background: var(--panel);
  border: 2px solid var(--ink);
  font-size: 0.88rem;
  white-space: pre-wrap;
}

.block-row[data-tipo='divisor'] .rich-textarea {
  display: none;
}

.marcador {
  flex-shrink: 0;
}

.cuadro {
  width: 8px;
  height: 8px;
  margin: 15px 8px 0 12px;
  background: var(--ink);
}

.numero {
  min-width: 26px;
  margin: 6px 4px 0 8px;
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1rem;
  line-height: 1.6;
  text-align: right;
}

.casilla {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  margin: 8px 6px 0 10px;
  padding: 0;
  background: var(--sheet);
  color: var(--on-ink);
  border: 3px solid var(--ink);
  font-size: 0.9rem;
  cursor: pointer;
}

.casilla.on {
  background: var(--ink);
}

.casilla:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.divisor {
  flex: 1;
  padding: 12px 12px;
  outline: none;
}

.divisor i {
  display: block;
  height: 4px;
  background: repeating-linear-gradient(90deg, var(--ink) 0 8px, transparent 8px 14px);
}

.divisor:focus-visible {
  outline: 2px dashed var(--ink);
  outline-offset: -2px;
}

.lock-badge {
  position: absolute;
  top: -9px;
  right: 8px;
  z-index: 7;
  max-width: 60%;
  overflow: hidden;
  padding: 3px 6px;
  color: #1b1740;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.42rem;
  line-height: 1;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 2px 2px 0 var(--shadow);
}

.lock-badge::after {
  content: '_';
  margin-left: 2px;
  animation: parpadeo 1s steps(2) infinite;
}

.slash-menu {
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  z-index: 40;
  width: min(330px, 100%);
  max-height: 330px;
  overflow-y: auto;
  padding: 6px;
}

.slash-titulo {
  padding: 6px 8px;
  color: var(--muted);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
}

.slash-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.slash-item.activo {
  background: var(--accent);
  color: var(--on-accent);
}

.slash-icono {
  min-width: 36px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 2px solid currentColor;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
  font-weight: 700;
}

.slash-texto strong {
  display: block;
  font-size: 1.2rem;
  font-weight: 400;
  line-height: 1;
}

.slash-texto small {
  display: block;
  font-size: 1rem;
  opacity: 0.7;
}

@media (max-width: 640px) {
  .block-row {
    --gutter: 62px;
  }

  .block-controls {
    grid-template-columns: repeat(2, 24px);
  }

  .handle {
    display: none;
  }
}
</style>