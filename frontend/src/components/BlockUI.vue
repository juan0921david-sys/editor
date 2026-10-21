<template>
  <div
    class="block-row"
    :class="{ locked: bloqueadoPorOtro, editing: enfocado }"
    :data-block-id="bloque.id"
  >
    <div class="block-controls no-print">
      <button type="button" title="Añadir bloque debajo" @click="$emit('add-block', index)">+</button>
      <button
        type="button"
        title="Subir"
        :disabled="isFirst || bloqueadoPorOtro"
        @click="$emit('move-up', index)"
      >
        ▲
      </button>
      <button
        type="button"
        title="Bajar"
        :disabled="isLast || bloqueadoPorOtro"
        @click="$emit('move-down', index)"
      >
        ▼
      </button>
      <button
        type="button"
        class="danger"
        title="Eliminar"
        :disabled="bloqueadoPorOtro"
        @click="$emit('delete-block', index)"
      >
        ×
      </button>
    </div>

    <div class="block-main">
      <span class="lock-badge no-print" v-if="bloqueadoPorOtro">BLOQUEADO · {{ quien }}</span>
      <div
        ref="editorRef"
        class="rich-textarea"
        :contenteditable="!bloqueadoPorOtro"
        data-placeholder="Escribe aquí o pulsa Enter para crear otro bloque..."
        spellcheck="true"
        @focus="alEnfocar"
        @blur="alDesenfocar"
        @input="alEscribir"
        @keydown="alPulsarTecla"
        @paste="alPegar"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  bloque: Object,
  index: Number,
  isFirst: Boolean,
  isLast: Boolean,
  miSocketId: String
})

const emit = defineEmits([
  'add-block',
  'delete-block',
  'delete-empty',
  'move-up',
  'move-down',
  'update-content',
  'solicitar-bloqueo',
  'liberar-bloqueo'
])

const editorRef = ref(null)
const enfocado = ref(false)

const bloqueadoPorOtro = computed(
  () => !!props.bloque.bloqueadoPor && props.bloque.bloqueadoPor !== props.miSocketId
)

const quien = computed(() => String(props.bloque.bloqueadoPor || '').slice(0, 4).toUpperCase())

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

const alEnfocar = () => {
  enfocado.value = true
  if (!bloqueadoPorOtro.value) emit('solicitar-bloqueo', props.bloque.id)
}

const alDesenfocar = () => {
  enfocado.value = false
  if (!bloqueadoPorOtro.value) emit('liberar-bloqueo', props.bloque.id)
}

const alEscribir = (e) => {
  const editor = e.target
  if (editor.innerHTML === '<br>') editor.innerHTML = ''
  emit('update-content', { id: props.bloque.id, contenido: editor.innerHTML })
}

const esVacio = () => !(editorRef.value && editorRef.value.textContent.length)

const alPulsarTecla = (e) => {
  if (e.isComposing) return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('add-block', props.index)
    return
  }
  if (e.key === 'Backspace' && esVacio()) {
    e.preventDefault()
    emit('delete-empty', props.index)
  }
}

const alPegar = (e) => {
  e.preventDefault()
  const datos = e.clipboardData || window.clipboardData
  const texto = datos ? datos.getData('text/plain') : ''
  document.execCommand('insertText', false, texto)
}
</script>

<style scoped>
.block-row {
  position: relative;
  display: grid;
  grid-template-columns: 70px 1fr;
  align-items: start;
  margin-bottom: 8px;
}

.block-controls {
  display: grid;
  grid-template-columns: repeat(2, 26px);
  gap: 3px;
  justify-content: end;
  padding: 4px 8px 0 0;
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

.block-controls button {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  background: var(--panel);
  color: var(--text);
  border: 2px solid var(--ink);
  box-shadow: 2px 2px 0 var(--shadow);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.06s, box-shadow 0.06s, background 0.15s;
}

.block-controls button:hover:not(:disabled) {
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
  position: relative;
  min-width: 0;
}

.rich-textarea {
  min-height: 1.75em;
  padding: 6px 12px;
  background: transparent;
  color: var(--text);
  border: 2px solid transparent;
  outline: none;
  caret-color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1rem;
  line-height: 1.75;
  word-break: break-word;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.block-row:hover:not(.locked) .rich-textarea {
  background: var(--hover);
}

.block-row.editing .rich-textarea {
  background: var(--hover);
  border-color: var(--ink);
  box-shadow: 3px 3px 0 var(--shadow);
}

.block-row.locked .rich-textarea {
  border: 2px dashed var(--ink);
  background: repeating-linear-gradient(135deg, var(--hover) 0 6px, transparent 6px 12px);
  opacity: 0.7;
  cursor: not-allowed;
}

.rich-textarea:empty::before {
  content: attr(data-placeholder);
  color: var(--muted);
  opacity: 0.65;
  pointer-events: none;
}

.lock-badge {
  position: absolute;
  top: -11px;
  right: 10px;
  z-index: 2;
  padding: 4px 8px;
  background: var(--ink);
  color: var(--on-ink);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
}

.lock-badge::after {
  content: '_';
  margin-left: 2px;
  animation: parpadeo 1s steps(2) infinite;
}

@media (max-width: 640px) {
  .block-row {
    grid-template-columns: 62px 1fr;
  }
}
</style>