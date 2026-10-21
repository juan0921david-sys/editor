<template>
  <div class="app-wrapper" @click="cerrarMenu">
    <header class="px-navbar px-panel no-print" @click.stop>
      <div class="nav-left">
        <div class="logo-badge">DOC</div>
        <div class="doc-controls">
          <input
            v-model="tituloDocumento"
            class="doc-title-input"
            type="text"
            maxlength="60"
            placeholder="Documento sin título"
          />
          <nav class="doc-menu">
            <div class="menu-container" v-for="menu in menus" :key="menu.nombre">
              <button
                class="menu-item"
                :class="{ abierto: menuActivo === menu.nombre }"
                @mousedown.prevent
                @click="alternarMenu(menu.nombre)"
              >
                {{ menu.nombre }}
              </button>
              <div class="px-dropdown px-panel" v-if="menuActivo === menu.nombre">
                <button
                  class="dropdown-item"
                  v-for="opcion in menu.opciones"
                  :key="opcion.etiqueta"
                  @mousedown.prevent
                  @click="ejecutarAccion(opcion.accion)"
                >
                  <span>{{ opcion.etiqueta }}</span>
                  <span class="atajo" v-if="opcion.atajo">{{ opcion.atajo }}</span>
                </button>
              </div>
            </div>
          </nav>
        </div>
      </div>

      <div class="nav-right">
        <div class="players">
          <div class="player p1" title="Juan">J</div>
          <div class="player p2" title="Nicolas">N</div>
        </div>
        <button
          class="px-btn theme-btn"
          :title="tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          @click="alternarTema"
        >
          {{ tema === 'dark' ? '☀' : '☾' }}
        </button>
        <button class="px-btn primary" @click="ejecutarAccion('compartir')">COMPARTIR</button>
      </div>
    </header>

    <main class="main-content">
      <slot></slot>
    </main>

    <div class="toast px-panel no-print" v-if="aviso">{{ aviso }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const leerAlmacen = (clave, defecto) => {
  try {
    return localStorage.getItem(clave) || defecto
  } catch {
    return defecto
  }
}

const guardarAlmacen = (clave, valor) => {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    return
  }
}

const prefiereOscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

const tema = ref(leerAlmacen('editor-tema', prefiereOscuro ? 'dark' : 'light'))
const crt = ref(leerAlmacen('editor-crt', 'on'))
const tituloDocumento = ref(leerAlmacen('editor-titulo', 'Estructura Editor Colaborativo'))
const menuActivo = ref(null)
const aviso = ref('')
let temporizadorAviso = null

document.documentElement.dataset.theme = tema.value
document.documentElement.dataset.crt = crt.value

watch(tema, (valor) => {
  document.documentElement.dataset.theme = valor
  guardarAlmacen('editor-tema', valor)
})

watch(crt, (valor) => {
  document.documentElement.dataset.crt = valor
  guardarAlmacen('editor-crt', valor)
})

watch(
  tituloDocumento,
  (valor) => {
    guardarAlmacen('editor-titulo', valor)
    document.title = `${valor.trim() || 'Documento sin título'} · Editor_Docs`
  },
  { immediate: true }
)

const menus = computed(() => [
  {
    nombre: 'Archivo',
    opciones: [
      { etiqueta: 'Nuevo documento', accion: 'nuevo' },
      { etiqueta: 'Descargar como .txt', accion: 'txt' },
      { etiqueta: 'Descargar como .html', accion: 'html' },
      { etiqueta: 'Imprimir / Guardar PDF', accion: 'imprimir', atajo: 'Ctrl+P' }
    ]
  },
  {
    nombre: 'Editar',
    opciones: [
      { etiqueta: 'Deshacer', accion: 'undo', atajo: 'Ctrl+Z' },
      { etiqueta: 'Rehacer', accion: 'redo', atajo: 'Ctrl+Y' },
      { etiqueta: 'Cortar', accion: 'cut', atajo: 'Ctrl+X' },
      { etiqueta: 'Copiar', accion: 'copy', atajo: 'Ctrl+C' },
      { etiqueta: 'Seleccionar todo', accion: 'selectAll', atajo: 'Ctrl+A' }
    ]
  },
  {
    nombre: 'Ver',
    opciones: [
      { etiqueta: 'Pantalla completa', accion: 'fullscreen' },
      { etiqueta: tema.value === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', accion: 'tema' },
      { etiqueta: crt.value === 'on' ? 'Desactivar efecto CRT' : 'Activar efecto CRT', accion: 'crt' }
    ]
  }
])

const alternarMenu = (nombre) => {
  menuActivo.value = menuActivo.value === nombre ? null : nombre
}

const cerrarMenu = () => {
  menuActivo.value = null
}

const alternarTema = () => {
  tema.value = tema.value === 'dark' ? 'light' : 'dark'
}

const mostrarAviso = (texto) => {
  aviso.value = texto
  clearTimeout(temporizadorAviso)
  temporizadorAviso = setTimeout(() => {
    aviso.value = ''
  }, 2200)
}

const compartir = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    mostrarAviso('ENLACE COPIADO')
  } catch {
    mostrarAviso('NO SE PUDO COPIAR')
  }
}

const ejecutarAccion = (accion) => {
  cerrarMenu()

  if (['undo', 'redo', 'cut', 'copy', 'selectAll'].includes(accion)) {
    document.execCommand(accion, false, null)
  } else if (accion === 'imprimir') {
    window.print()
  } else if (accion === 'fullscreen') {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  } else if (accion === 'nuevo') {
    if (window.confirm('¿Crear un documento nuevo? Se borrará el contenido actual.')) {
      window.dispatchEvent(new CustomEvent('limpiar-documento'))
    }
  } else if (accion === 'txt' || accion === 'html') {
    window.dispatchEvent(
      new CustomEvent('exportar-documento', {
        detail: { formato: accion, titulo: tituloDocumento.value }
      })
    )
  } else if (accion === 'tema') {
    alternarTema()
  } else if (accion === 'crt') {
    crt.value = crt.value === 'on' ? 'off' : 'on'
  } else if (accion === 'compartir') {
    compartir()
  }
}

const alTeclear = (e) => {
  if (e.key === 'Escape') cerrarMenu()
}

onMounted(() => window.addEventListener('keydown', alTeclear))

onUnmounted(() => {
  window.removeEventListener('keydown', alTeclear)
  clearTimeout(temporizadorAviso)
})
</script>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

.px-navbar {
  position: sticky;
  top: 12px;
  z-index: 50;
  height: var(--nav-h);
  margin: 12px 16px 0;
  padding: 0 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.nav-left,
.nav-right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.logo-badge {
  flex-shrink: 0;
  background: var(--ink);
  color: var(--on-ink);
  border: 3px solid var(--ink);
  box-shadow: 3px 3px 0 var(--shadow);
  padding: 12px 8px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.65rem;
}

.doc-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.doc-title-input {
  width: min(340px, 42vw);
  background: transparent;
  color: var(--text);
  border: 2px solid transparent;
  padding: 0 6px;
  margin-left: -6px;
  font-size: 1.6rem;
  line-height: 1.2;
  outline: none;
  transition: background 0.15s, border-color 0.15s;
}

.doc-title-input:hover {
  border-color: var(--accent-soft);
}

.doc-title-input:focus {
  border-color: var(--ink);
  background: var(--accent-soft);
}

.doc-menu {
  display: flex;
  gap: 2px;
  margin-left: -6px;
}

.menu-container {
  position: relative;
}

.menu-item {
  background: transparent;
  border: 2px solid transparent;
  color: var(--text);
  padding: 0 10px;
  font-size: 1.15rem;
  line-height: 1.4;
  cursor: pointer;
  transition: background 0.15s;
}

.menu-item:hover {
  background: var(--accent-soft);
}

.menu-item.abierto {
  background: var(--ink);
  color: var(--on-ink);
}

.px-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 12px;
  min-width: 270px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 60;
}

.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  background: transparent;
  border: none;
  color: var(--text);
  text-align: left;
  padding: 4px 10px;
  font-size: 1.2rem;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--accent);
  color: var(--on-accent);
}

.atajo {
  font-size: 0.95rem;
  opacity: 0.7;
}

.players {
  display: flex;
  padding-left: 6px;
}

.player {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  margin-left: -6px;
  border: 3px solid var(--ink);
  box-shadow: 2px 2px 0 var(--shadow);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
}

.p1 {
  background: var(--accent);
  color: var(--on-accent);
}

.p2 {
  background: #2b2563;
  color: #b9a9e8;
}

.theme-btn {
  width: 42px;
  padding: 0;
  font-family: 'VT323', monospace;
  font-size: 1.6rem;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem 3.5rem;
}

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 300;
  padding: 12px 18px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  animation: pop 0.2s ease-out;
}

@media (max-width: 640px) {
  .logo-badge,
  .players {
    display: none;
  }

  .doc-title-input {
    width: 38vw;
  }

  .px-navbar {
    margin: 8px 8px 0;
    padding: 0 10px;
  }
}
</style>