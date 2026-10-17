<template>
  <div class="block-mockup" :class="{ locked: estaBloqueadoPorOtro }">
    <div class="block-header">
      <span v-if="estaBloqueadoPorOtro">🔒 Bloqueado por otro usuario</span>
      <span v-else>🔓 Bloque libre</span>
    </div>
    
    <textarea 
      v-model="contenidoLocal"
      :disabled="estaBloqueadoPorOtro"
      @focus="solicitarBloqueo"
      @blur="liberarBloqueo"
      @input="actualizarContenido"
      placeholder="Escribe aquí..."
    ></textarea>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  bloque: Object,
  miSocketId: String
})

const emit = defineEmits(['solicitar-bloqueo', 'liberar-bloqueo', 'actualizar-texto'])
const contenidoLocal = ref(props.bloque.contenido)

const estaBloqueadoPorOtro = computed(() => {
  return props.bloque.bloqueadoPor && props.bloque.bloqueadoPor !== props.miSocketId
})

watch(() => props.bloque.contenido, (nuevoValor) => {
  if (estaBloqueadoPorOtro.value) contenidoLocal.value = nuevoValor
})

const solicitarBloqueo = () => {
  if (!estaBloqueadoPorOtro.value) emit('solicitar-bloqueo', props.bloque.id)
}

const liberarBloqueo = () => {
  emit('liberar-bloqueo', props.bloque.id)
}

const actualizarContenido = () => {
  emit('actualizar-texto', { blockId: props.bloque.id, contenido: contenidoLocal.value })
}
</script>

<style scoped>
.block-mockup {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 1.2rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.block-mockup.locked {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.05);
}

.block-header {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
  color: #94a3b8;
}

textarea {
  width: 100%;
  min-height: 80px;
  background: transparent;
  color: #f1f5f9;
  border: none;
  resize: vertical;
  font-size: 1rem;
  font-family: inherit;
}

textarea:focus { outline: none; }
textarea::placeholder { color: rgba(255, 255, 255, 0.2); }
</style>