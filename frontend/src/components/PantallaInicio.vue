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
        <p class="etiqueta">{{ modo === 'login' ? 'INGRESO' : 'NUEVA CUENTA' }}</p>

        <template v-if="modo === 'registro'">
          <label class="etiqueta" for="nombre-jugador">NOMBRE</label>
          <input
            id="nombre-jugador"
            v-model="nombre"
            class="campo"
            maxlength="40"
            autocomplete="name"
            placeholder="TU NOMBRE"
          />
        </template>

        <label class="etiqueta" for="correo-jugador">CORREO</label>
        <input
          id="correo-jugador"
          ref="entrada"
          v-model="correo"
          class="campo"
          type="email"
          maxlength="120"
          autocomplete="email"
          placeholder="TU CORREO"
        />

        <label class="etiqueta" for="password-jugador">CONTRASEÑA</label>
        <input
          id="password-jugador"
          v-model="password"
          class="campo"
          type="password"
          minlength="8"
          maxlength="128"
          autocomplete="current-password"
          placeholder="MÍNIMO 8 CARACTERES"
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

        <p v-if="error" class="error">{{ error }}</p>

        <div class="vista-previa">
          <div class="avatar" :style="{ background: color }">{{ inicial }}</div>
          <div class="datos">
            <strong>{{ (modo === 'registro' ? nombre : correo).trim() || 'JUGADOR' }}</strong>
            <small v-if="sesion.autenticado">ID: #{{ sesion.uid }}</small>
            <small v-else>IDENTIDAD: {{ modo === 'login' ? 'INGRESO' : 'REGISTRO' }}</small>
          </div>
        </div>

        <button
          type="submit"
          class="px-btn primary entrar"
          :disabled="!valido || cargando"
        >
          {{ cargando ? 'ESPERANDO...' : modo === 'login' ? '▶ INGRESAR' : '▶ CREAR CUENTA' }}
        </button>
        <button type="button" class="px-btn cambio" @click="cambiarModo">
          {{ modo === 'login' ? 'CREAR CUENTA' : 'YA TENGO CUENTA' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSesionStore, COLORES } from '../stores/sesion'
import { sonidos } from '../utils/sonidos'
import { mensajeDeError } from '../utils/validacion'

type Modo = 'login' | 'registro'

const sesion = useSesionStore()
const router = useRouter()

const paso = ref('titulo')
const modo = ref<Modo>('login')
const nombre = ref(sesion.nombre)
const correo = ref('')
const password = ref('')
const color = ref(sesion.color)
const error = ref('')
const cargando = ref(false)
const entrada = ref<HTMLInputElement | null>(null)

const valido = computed<boolean>(() => {
  if (modo.value === 'registro' && nombre.value.trim().length < 2) return false
  return correo.value.trim().length > 3 && password.value.length >= 8
})

const inicial = computed<string>(() => {
  const texto =
    modo.value === 'registro' ? nombre.value.trim() : correo.value.trim()
  return (texto[0] || '?').toUpperCase()
})

const avanzar = async () => {
  if (paso.value !== 'titulo') return
  sonidos.clic()
  paso.value = 'jugador'
  await nextTick()
  if (entrada.value) entrada.value.focus()
}

const elegirColor = (c: string) => {
  color.value = c
  sonidos.clic()
}

const cambiarModo = () => {
  modo.value = modo.value === 'login' ? 'registro' : 'login'
  error.value = ''
  sonidos.clic()
}

const comenzar = async () => {
  if (!valido.value) {
    sonidos.error()
    return
  }

  cargando.value = true
  error.value = ''

  try {
    if (modo.value === 'login') {
      await sesion.iniciarSesion(
        correo.value.trim(),
        password.value,
        color.value
      )
    } else {
      await sesion.registrar(
        nombre.value.trim(),
        correo.value.trim(),
        password.value,
        color.value
      )
    }
    sonidos.agregar()
    await router.push({ name: 'editor' })
  } catch (e) {
    error.value = mensajeDeError(e)
    password.value = ''
    sonidos.error()
  } finally {
    cargando.value = false
  }
}

const alTeclear = (e: KeyboardEvent) => {
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
