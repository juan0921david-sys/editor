<template>
  <div class="intro" @click="avanzar">
    <div class="intro-panel px-panel" @click.stop>
      <div class="pixel-title">EDITOR<br />COLABORATIVO</div>
      <p class="intro-sub">·BLOQUEO DE BLOQUES·</p>

      <template v-if="paso === 'titulo'">
        <button class="px-btn primary press-start" @click="avanzar">PRESS START</button>
        <p class="hint">ENTER O CLIC PARA CONTINUAR</p>
      </template>

      <form v-else class="jugador" @submit.prevent="comenzar">
        <label class="etiqueta" for="nombre-jugador">NOMBRE</label>
        <input
          id="nombre-jugador"
          ref="entrada"
          v-model="nombre"
          class="campo"
          maxlength="16"
          autocomplete="off"
          placeholder="TU NOMBRE"
        />
        <span class="etiqueta">COLOR</span>
        <div class="colores" role="radiogroup" aria-label="Color de jugador">
          <button
            v-for="c in COLORES"
            :key="c"
            type="button"
            role="radio"
            :aria-checked="color === c"
            class="color"
            :class="{ activo: color === c }"
            :style="{ background: c }"
            @click="elegirColor(c)"
          ></button>
        </div>
        <div class="vista-previa">
          <div class="avatar" :style="{ background: color }">{{ inicial }}</div>
          <div class="datos">
            <strong>{{ nombre.trim() || 'JUGADOR' }}</strong>
            <small>ID ÚNICA: #{{ sesion.uid }}</small>
          </div>
        </div>
        <button type="submit" class="px-btn primary entrar" :disabled="!valido">▶ START</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { sesion, COLORES, iniciarSesion } from '../stores/sesion'
import { sonidos } from '../utils/sonidos'

const paso = ref('titulo')
const nombre = ref(sesion.nombre)
const color = ref(sesion.color)
const entrada = ref(null)

const valido = computed(() => nombre.value.trim().length >= 2)
const inicial = computed(() => (nombre.value.trim()[0] || '?').toUpperCase())

const avanzar = async () => {
  if (paso.value !== 'titulo') return
  sonidos.clic()
  paso.value = 'jugador'
  await nextTick()
  if (entrada.value) entrada.value.focus()
}

const elegirColor = (c) => {
  color.value = c
  sonidos.clic()
}

const comenzar = () => {
  if (!valido.value) {
    sonidos.error()
    return
  }
  sonidos.inicio()
  iniciarSesion(nombre.value, color.value)
}

const alTeclear = (e) => {
  if (paso.value === 'titulo' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    avanzar()
  }
}

onMounted(() => window.addEventListener('keydown', alTeclear))
onUnmounted(() => window.removeEventListener('keydown', alTeclear))
</script>

<style scoped>
.intro {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: grid;
  place-items: center;
  padding: 20px;
  overflow: auto;
}

.intro-panel {
  width: min(520px, 100%);
  padding: 38px 30px 32px;
  text-align: center;
  background: var(--sheet);
}

.pixel-title {
  font-family: 'Press Start 2P', monospace;
  font-size: clamp(1.4rem, 5vw, 2.1rem);
  line-height: 1.6;
  color: var(--text);
  text-shadow: 4px 4px 0 var(--shadow);
}

.intro-sub {
  margin: 16px 0 28px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  line-height: 1.8;
  color: var(--muted);
}

.press-start {
  height: 54px;
  padding: 0 28px;
  font-size: 0.8rem;
  animation: parpadeo 1.2s steps(2) infinite;
}

.hint {
  margin: 18px 0 0;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  color: var(--muted);
}

.jugador {
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

.etiqueta {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  color: var(--muted);
}

.campo {
  height: 50px;
  padding: 0 14px;
  background: var(--panel);
  color: var(--text);
  border: 3px solid var(--ink);
  font-size: 1.7rem;
  outline: none;
  caret-color: var(--ink);
}

.campo:focus {
  box-shadow: 4px 4px 0 var(--shadow);
}

.colores {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.color {
  width: 38px;
  height: 38px;
  border: 3px solid var(--ink);
  cursor: pointer;
  transition: transform 0.08s;
}

.color:hover {
  transform: translateY(-2px);
}

.color.activo {
  outline: 3px dashed var(--ink);
  outline-offset: 3px;
  transform: scale(1.08);
}

.vista-previa {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 6px 0;
  padding: 10px 12px;
  border: 2px dashed var(--ink);
}

.avatar {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 3px solid var(--ink);
  color: #1b1740;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.8rem;
}

.datos strong {
  display: block;
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1;
}

.datos small {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  color: var(--muted);
}

.entrar {
  height: 50px;
  font-size: 0.75rem;
}

.entrar:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>