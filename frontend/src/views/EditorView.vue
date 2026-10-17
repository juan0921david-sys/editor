<template>
  <div class="editor-container">
    <div class="status-indicator">
      ESTADO: <span :class="{'conectado': estadoConexion === 'CONECTADO🟢'}">{{ estadoConexion }}</span> | MI ID: {{ miSocketId || '...' }}
    </div>
    
    <BlockUI 
      v-for="bloque in bloques" 
      :key="bloque.id"
      :bloque="bloque"
      :miSocketId="miSocketId"
      @solicitar-bloqueo="enviarSolicitudBloqueo"
      @liberar-bloqueo="enviarLiberacionBloqueo"
      @actualizar-texto="enviarActualizacionTexto"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'
import BlockUI from '../components/BlockUI.vue'

const socket = ref(null)
const estadoConexion = ref('DESCONECTADO🔴')
const miSocketId = ref('')

const bloques = ref([
  { id: 1, contenido: 'Bloque de texto inicial 1', bloqueadoPor: null },
  { id: 2, contenido: 'Bloque de texto inicial 2', bloqueadoPor: null }
])

onMounted(() => {
  socket.value = io('http://localhost:3000')

  socket.value.on('connect', () => {
    estadoConexion.value = 'CONECTADO🟢'
    miSocketId.value = socket.value.id
  })

  socket.value.on('bloqueo_aprobado', ({ blockId, userId }) => {
    const bloque = bloques.value.find(b => b.id === blockId)
    if (bloque) bloque.bloqueadoPor = userId
  })

  socket.value.on('bloque_liberado', (blockId) => {
    const bloque = bloques.value.find(b => b.id === blockId)
    if (bloque) bloque.bloqueadoPor = null
  })

  socket.value.on('contenido_actualizado', ({ blockId, contenido }) => {
    const bloque = bloques.value.find(b => b.id === blockId)
    if (bloque) bloque.contenido = contenido
  })
})

onUnmounted(() => { if (socket.value) socket.value.disconnect() })

const enviarSolicitudBloqueo = (blockId) => socket.value.emit('solicitar_bloqueo', blockId)
const enviarLiberacionBloqueo = (blockId) => socket.value.emit('liberar_bloqueo', blockId)
const enviarActualizacionTexto = (data) => socket.value.emit('actualizar_contenido', data)
</script>

<style scoped>
.status-indicator {
  margin-bottom: 20px;
  font-size: 0.85rem;
  color: #94a3b8;
}
.conectado { color: #4ade80; }
</style>