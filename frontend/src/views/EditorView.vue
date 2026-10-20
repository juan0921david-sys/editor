<template>
  <div class="editor-container">
    <div class="ios-toolbar">
      <button class="tool-btn" @mousedown.prevent="aplicarFormato('bold')"><strong>B</strong></button>
      <button class="tool-btn" @mousedown.prevent="aplicarFormato('italic')"><em>I</em></button>
      <button class="tool-btn" @mousedown.prevent="aplicarFormato('underline')"><u>U</u></button>
      <div class="divider"></div>
      <button class="tool-btn" @click="agregarBloqueFinal">➕ Añadir Bloque</button>
    </div>

    <div class="ios-document">
      <BlockUI 
        v-for="(bloque, index) in bloques" 
        :key="bloque.id"
        :bloque="bloque"
        :index="index"
        :isFirst="index === 0"
        :isLast="index === bloques.length - 1"
        @add-block="agregarBloqueDespues"
        @delete-block="eliminarBloque"
        @move-up="moverBloqueArriba"
        @move-down="moverBloqueAbajo"
      />
      
      <div v-if="bloques.length === 0" class="empty-state" @click="agregarBloqueFinal">
        Haz clic aquí para empezar a escribir...
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import BlockUI from '../components/BlockUI.vue'

const bloques = ref([
  { id: Date.now(), contenido: '', bloqueadoPor: null }
])

const agregarBloqueFinal = () => {
  bloques.value.push({ id: Date.now(), contenido: '', bloqueadoPor: null })
}

const agregarBloqueDespues = (index) => {
  bloques.value.splice(index + 1, 0, { id: Date.now(), contenido: '', bloqueadoPor: null })
}

const eliminarBloque = (index) => {
  bloques.value.splice(index, 1)
}

const moverBloqueArriba = (index) => {
  if (index > 0) {
    const temp = bloques.value[index]
    bloques.value[index] = bloques.value[index - 1]
    bloques.value[index - 1] = temp
  }
}

const moverBloqueAbajo = (index) => {
  if (index < bloques.value.length - 1) {
    const temp = bloques.value[index]
    bloques.value[index] = bloques.value[index + 1]
    bloques.value[index + 1] = temp
  }
}

const aplicarFormato = (comando) => {
  document.execCommand(comando, false, null)
}
</script>

<style scoped>
.editor-container {
  width: 100%;
  max-width: 850px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  position: relative;
}

.ios-toolbar {
  display: flex;
  gap: 10px;
  padding: 12px 24px;
  background: rgba(43, 37, 99, 0.45);
  backdrop-filter: blur(35px) saturate(200%);
  -webkit-backdrop-filter: blur(35px) saturate(200%);
  border: 1px solid rgba(185, 169, 232, 0.3);
  border-radius: 30px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  z-index: 10;
  margin-bottom: 20px;
}

.tool-btn {
  background: transparent;
  border: none;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(185, 169, 232, 0.3);
  color: #ffffff;
}

.divider { 
  width: 1px; 
  background: rgba(185, 169, 232, 0.3); 
  margin: 0 5px; 
}

.ios-document {
  width: 100%;
  min-height: 85vh;
  background: #ffffff;
  border: 1px solid rgba(185, 169, 232, 0.3);
  border-radius: 12px;
  padding: 4rem 5rem;
  box-shadow: 0 10px 30px rgba(43, 37, 99, 0.1);
  color: #333333;
}

.empty-state {
  color: rgba(0,0,0,0.4);
  font-style: italic;
  cursor: text;
  padding: 10px;
}
</style>