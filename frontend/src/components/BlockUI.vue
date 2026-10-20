<template>
  <div class="block-row" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <div class="pro-block-controls" :class="{ 'visible': isHovered }">
      <button @click="$emit('add-block', index)">＋</button>
      <button @click="$emit('move-up', index)" :disabled="isFirst">∧</button>
      <button @click="$emit('move-down', index)" :disabled="isLast">∨</button>
      <button @click="$emit('delete-block', index)" class="btn-danger">✕</button>
    </div>

    <div class="block-content">
      <div 
        class="rich-textarea"
        contenteditable="true"
        @input="onInput"
        @keydown.enter.prevent="handleEnter"
        ref="editorRef"
        placeholder="Escribe algo o usa '/' para comandos..."
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  bloque: Object,
  index: Number,
  isFirst: Boolean,
  isLast: Boolean
})

const emit = defineEmits(['add-block', 'delete-block', 'move-up', 'move-down', 'update-content'])
const isHovered = ref(false)
const editorRef = ref(null)

onMounted(() => {
  if (editorRef.value && props.bloque?.contenido) {
    editorRef.value.innerHTML = props.bloque.contenido
  }
})

watch(() => props.bloque?.contenido, (newVal) => {
  if (editorRef.value && editorRef.value.innerHTML !== newVal) {
    editorRef.value.innerHTML = newVal || ''
  }
})

const onInput = (e) => {
  emit('update-content', { id: props.bloque.id, contenido: e.target.innerHTML })
}

const handleEnter = () => {
  emit('add-block', props.index)
}
</script>

<style scoped>
.block-row {
  position: relative;
  display: flex;
  margin-bottom: 6px;
}

.pro-block-controls {
  position: absolute;
  left: -110px;
  top: 4px;
  display: flex;
  gap: 2px;
  background: rgba(185, 169, 232, 0.15);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(185, 169, 232, 0.4);
  border-radius: 6px;
  padding: 2px;
  box-shadow: 0 8px 24px rgba(43, 37, 99, 0.15);
  opacity: 0;
  transform: translateX(10px) scale(0.95);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.block-row:hover .pro-block-controls {
  opacity: 1;
  transform: translateX(0) scale(1);
  pointer-events: auto;
}

.pro-block-controls button {
  background: transparent;
  border: none;
  color: #2B2563;
  font-size: 1rem;
  font-weight: 600;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.pro-block-controls button:hover:not(:disabled) {
  background: rgba(43, 37, 99, 0.15);
  color: #2B2563;
}

.pro-block-controls button:disabled {
  opacity: 0.2;
  cursor: default;
}

.btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15) !important;
  color: #ef4444 !important;
}

.block-content {
  width: 100%;
}

.rich-textarea {
  width: 100%;
  min-height: 1.5em;
  background: transparent;
  color: #1a1a1a;
  border: 1px solid transparent;
  font-size: 1.1rem;
  line-height: 1.6;
  font-family: inherit;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  outline: none;
}

.rich-textarea:focus {
  background: rgba(185, 169, 232, 0.05);
  border-color: rgba(43, 37, 99, 0.3);
}

.rich-textarea:empty:before {
  content: attr(placeholder);
  color: #a0a0a0;
  pointer-events: none;
  display: block;
}
</style>