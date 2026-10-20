<template>
  <div class="block" :class="{ locked: estaBloqueadoPorOtro, editing: enfocado }">
    <div class="block-menu" v-if="!estaBloqueadoPorOtro">
      <button title="Añadir abajo" @click="emit('add-block', bloque.id)">＋</button>
      <button title="Subir" @click="emit('move-up', bloque.id)">↑</button>
      <button title="Bajar" @click="emit('move-down', bloque.id)">↓</button>
      <button title="Eliminar" class="danger" @click="emit('delete-block', bloque.id)">✕</button>
    </div>

    <span v-if="estaBloqueadoPorOtro" class="lock-badge">🔒 Editando…</span>

    <div
      ref="el"
      class="block-content"
      :contenteditable="!estaBloqueadoPorOtro"
      data-placeholder="Escribe aquí un párrafo..."
      @focus="alEnfocar"
      @blur="alDesenfocar"
      @input="actualizarContenido"
      @keydown.enter.prevent="emit('add-block', bloque.id)"
      @paste="alPegar"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import DOMPurify from 'dompurify'

const props = defineProps({ bloque: Object, miSocketId: String })
const emit = defineEmits([
  'solicitar-bloqueo', 'liberar-bloqueo', 'actualizar-texto',
  'add-block', 'delete-block', 'move-up', 'move-down'
])

const el = ref(null)
const enfocado = ref(false)

const estaBloqueadoPorOtro = computed(() =>
  props.bloque.bloqueadoPor && props.bloque.bloqueadoPor !== props.miSocketId
)

// Solo se permiten estas etiquetas (protege contra XSS entre usuarios)
const limpiar = (html) =>
  DOMPurify.sanitize(html || '', { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'br'] })

onMounted(() => { el.value.innerHTML = limpiar(props.bloque.contenido) })

// Cambios que llegan de otros usuarios (si yo no estoy escribiendo aquí)
watch(() => props.bloque.contenido, (nuevo) => {
  if (document.activeElement === el.value) return
  const limpio = limpiar(nuevo)
  if (el.value.innerHTML !== limpio) el.value.innerHTML = limpio
})

const alEnfocar = () => {
  enfocado.value = true
  if (!estaBloqueadoPorOtro.value) emit('solicitar-bloqueo', props.bloque.id)
}
const alDesenfocar = () => {
  enfocado.value = false
  emit('liberar-bloqueo', props.bloque.id)
}
const actualizarContenido = () => {
  emit('actualizar-texto', { blockId: props.bloque.id, contenido: el.value.innerHTML })
}
// Pegar siempre como texto plano
const alPegar = (e) => {
  e.preventDefault()
  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
}
</script>

<style scoped>
.block {
  position: relative;
  margin-bottom: 6px;
  padding: 8px 14px;
  border-radius: 14px;
  border: 1px solid transparent;
  transition: background .2s, border-color .2s, box-shadow .2s;
}
.block:hover:not(.locked) { background: rgba(255,255,255,.05); }
.block.editing {
  background: rgba(255,255,255,.07);
  border-color: rgba(185,169,232,.45);
  box-shadow: 0 0 0 4px rgba(185,169,232,.08);
}
.block.locked {
  background: rgba(43,37,99,.35);
  border-color: rgba(185,169,232,.35);
}

.block-content {
  outline: none;
  min-height: 1.7em;
  font-size: 1.08rem;
  line-height: 1.7;
  color: rgba(255,255,255,.95);
  word-break: break-word;
}
.block.locked .block-content { opacity: .55; cursor: not-allowed; }
.block-content:empty::before {
  content: attr(data-placeholder);
  color: rgba(255,255,255,.28);
  pointer-events: none;
}

.lock-badge {
  position: absolute;
  top: -10px; right: 12px;
  font-size: .7rem; font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(185,169,232,.25);
  border: 1px solid rgba(185,169,232,.5);
  backdrop-filter: blur(10px);
}

/* Menú lateral: aparece en hover */
.block-menu {
  position: absolute;
  left: -50px; top: 6px;
  display: flex; flex-direction: column; gap: 4px;
  opacity: 0;
  transform: translateX(6px);
  transition: opacity .2s, transform .2s;
}
.block:hover .block-menu,
.block:focus-within .block-menu { opacity: 1; transform: translateX(0); }

.block-menu button {
  width: 28px; height: 28px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.1);
  backdrop-filter: blur(14px);
  color: #fff;
  font-size: .8rem;
  cursor: pointer;
  transition: background .15s, transform .15s;
}
.block-menu button:hover { background: rgba(185,169,232,.35); }
.block-menu button:active { transform: scale(.9); }
.block-menu button.danger:hover { background: rgba(239,68,68,.45); }
</style>