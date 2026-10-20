<template>
  <div class="block-paragraph" :class="{ locked: estaBloqueadoPorOtro }">
    <div class="block-indicator" v-if="estaBloqueadoPorOtro">
      <span class="lock-icon">🔒 Editando...</span>
    </div>
    
    <textarea 
      v-model="contenidoLocal"
      :disabled="estaBloqueadoPorOtro"
      @focus="solicitarBloqueo"
      @blur="liberarBloqueo"
      @input="actualizarContenido"
      placeholder="Escribe aquí un párrafo..."
      rows="1"
      oninput="this.style.height = '';this.style.height = this.scrollHeight + 'px'"
    ></textarea>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({ bloque: Object, miSocketId: String })
const emit = defineEmits(['solicitar-bloqueo', 'liberar-bloqueo', 'actualizar-texto'])
const contenidoLocal = ref(props.bloque.contenido)

const estaBloqueadoPorOtro = computed(() => props.bloque.bloqueadoPor && props.bloque.bloqueadoPor !== props.miSocketId)

watch(() => props.bloque.contenido, (nuevoValor) => {
  if (estaBloqueadoPorOtro.value) contenidoLocal.value = nuevoValor
})

const solicitarBloqueo = () => { if (!estaBloqueadoPorOtro.value) emit('solicitar-bloqueo', props.bloque.id) }
const liberarBloqueo = () => { emit('liberar-bloqueo', props.bloque.id) }
const actualizarContenido = () => { emit('actualizar-texto', { blockId: props.bloque.id, contenido: contenidoLocal.value }) }
</script>

<style scoped>
.block-paragraph {
  position: relative;
  margin-bottom: 10px;
  padding: 5px 0;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.block-paragraph:hover:not(.locked) {
  background-color: #f8f9fa;
  border-radius: 4px;
}

.block-paragraph.locked {
  border-left: 3px solid #B9A9E8; 
  background-color: rgba(185, 169, 232, 0.05);
}

.block-indicator {
  position: absolute;
  top: -15px;
  left: 0;
  font-size: 0.7rem;
  color: #2B2563;
  font-weight: bold;
}

textarea {
  width: 100%;
  background: transparent;
  color: #000000;
  border: none;
  resize: none;
  font-size: 1.1rem;
  line-height: 1.6;
  font-family: Arial, sans-serif;
  overflow: hidden; 
}

textarea:focus {
  outline: none;
}

textarea::placeholder {
  color: #cccccc;
}
</style>