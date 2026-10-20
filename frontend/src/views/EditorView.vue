<template>
  <div class="editor-container">
    
    <!-- Toolbar flotante transparente -->
    <div class="ios-toolbar">
      <button class="tool-btn"><strong>B</strong></button>
      <button class="tool-btn"><em>I</em></button>
      <button class="tool-btn"><u>U</u></button>
      <div class="divider"></div>
      <button class="tool-btn" @click="agregarBloqueFinal">➕ Añadir Bloque</button>
    </div>

    <!-- Hoja del documento translúcida -->
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
      
      <!-- Placeholder si se borran todos los bloques -->
      <div v-if="bloques.length === 0" class="empty-state" @click="agregarBloqueFinal">
        Haz clic aquí para empezar a escribir...
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import BlockUI from '../components/BlockUI.vue'

// Estado inicial (simulando lo que vendrá de la base de datos)
const bloques = ref([
  { id: Date.now(), contenido: 'Empieza a escribir en este documento de cristal...', bloqueadoPor: null }
])

// Funciones CRUD de bloques (Estilo Notion)
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
</script>

<style scoped>
.editor-container {
  width: 100%;
  max-width: 850px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.ios-toolbar {
  display: flex;
  gap: 10px;
  padding: 10px 20px;
  background: rgba(43, 37, 99, 0.4); /* Índigo transparente */
  backdrop-filter: blur(25px) saturate(200%);
  -webkit-backdrop-filter: blur(25px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 30px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.tool-btn {
  background: transparent; border: none; color: white; cursor: pointer;
  padding: 5px 10px; border-radius: 8px; transition: 0.2s;
}
.tool-btn:hover { background: rgba(185, 169, 232, 0.3); }
.divider { width: 1px; background: rgba(255,255,255,0.2); margin: 0 5px; }

/* La Hoja de Cristal Premium */
.ios-document {
  width: 100%;
  min-height: 85vh;
  background: #ffffff; /* Hoja totalmente blanca */
  border: 1px solid rgba(185, 169, 232, 0.3); /* Borde sutil Lavanda */
  border-radius: 12px;
  padding: 4rem 5rem;
  box-shadow: 0 10px 30px rgba(43, 37, 99, 0.1); /* Sombra Índigo suave */
  color: #333333;
}

.empty-state {
  color: rgba(255,255,255,0.4);
  font-style: italic;
  cursor: text;
  padding: 10px;
}
</style>