<template>
  <div class="app-wrapper" :class="{ zen: sesion.zen }" @click="cerrarMenu">
    <div class="cabecera no-print" v-show="!sesion.zen">
      <header class="px-navbar px-panel" @click.stop>
        <div class="nav-left">
          <div class="logo-badge">DOC</div>
          <div class="doc-controls">
            <input
              v-model="sesion.titulo"
              class="doc-title-input"
              type="text"
              maxlength="80"
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
                  <template v-for="(opcion, i) in menu.opciones" :key="i">
                    <div v-if="opcion.separador" class="separador"></div>
                    <button v-else class="dropdown-item" @mousedown.prevent @click="ejecutarAccion(opcion.accion)">
                      <span>{{ opcion.etiqueta }}</span>
                      <span class="atajo" v-if="opcion.atajo">{{ opcion.atajo }}</span>
                    </button>
                  </template>
                </div>
              </div>
            </nav>
          </div>
        </div>

        <div class="nav-right">
          <button class="players" title="Quién está en el documento" @click="modal = 'compartir'">
            <span
              v-for="u in visibles"
              :key="u.id"
              class="player"
              :class="{ yo: esYo(u) }"
              :style="{ background: u.color }"
              :title="`${u.nombre} #${u.uid || ''}`"
            >
              {{ inicial(u.nombre) }}
            </span>
            <span v-if="extra > 0" class="player mas">+{{ extra }}</span>
          </button>
          <button
            class="px-btn icono-btn"
            :class="{ apagado: !sesion.sonido }"
            :title="sesion.sonido ? 'Silenciar sonidos' : 'Activar sonidos'"
            @click="alternarSonido"
          >
            ♪
          </button>
          <button
            class="px-btn icono-btn"
            :title="sesion.tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
            @click="alternarTema"
          >
            {{ sesion.tema === 'dark' ? '☀' : '☾' }}
          </button>
          <button class="px-btn primary compartir-btn" title="Compartir" @click="modal = 'compartir'">
            <span class="solo-escritorio">COMPARTIR</span>
            <span class="solo-movil">⇪</span>
          </button>
        </div>
      </header>

      <BarraFormato />
    </div>

    <button v-if="sesion.zen" class="px-btn zen-salir no-print" @click="alternarZen">SALIR DEL MODO ENFOQUE</button>

    <main class="main-content">
      <slot></slot>
    </main>

    <div class="toast px-panel no-print" v-if="sesion.aviso">{{ sesion.aviso }}</div>

    <div class="modal-fondo no-print" v-if="modal === 'compartir'" @click.self="modal = null">
      <div class="modal px-panel" role="dialog" aria-label="Compartir documento">
        <div class="modal-cabecera">
          <span>COMPARTIR</span>
          <button class="px-btn" @click="modal = null">X</button>
        </div>
        <p class="modal-texto">
          Quien abra este enlace entra al mismo documento y se identifica con su nombre y su ID única.
        </p>
        <div class="campo-copia">
          <input readonly :value="enlace" @focus="$event.target.select()" />
          <button class="px-btn primary" @click="copiarEnlace">COPIAR</button>
        </div>
        <div class="codigo-doc">CÓDIGO DEL DOCUMENTO <strong>{{ sesion.documentoId }}</strong></div>
        <h3 class="modal-sub">EN ESTE DOCUMENTO ({{ jugadores.length }})</h3>
        <ul class="lista-personas">
          <li v-for="u in jugadores" :key="u.id">
            <span class="chip" :style="{ background: u.color }">{{ inicial(u.nombre) }}</span>
            <span class="nombre">{{ u.nombre }}<em v-if="esYo(u)"> (tú)</em></span>
            <code>#{{ u.uid || '------' }}</code>
          </li>
        </ul>
        <p class="modal-nota" v-if="jugadores.length === 1">Por ahora estás solo. Comparte el enlace para trabajar en conjunto.</p>
      </div>
    </div>

    <div class="modal-fondo no-print" v-if="modal === 'pagina'" @click.self="modal = null">
      <div class="modal px-panel" role="dialog" aria-label="Configurar página">
        <div class="modal-cabecera">
          <span>CONFIGURAR PÁGINA</span>
          <button class="px-btn" @click="modal = null">X</button>
        </div>
        <div class="grupo-pagina" v-for="grupo in gruposPagina" :key="grupo.clave">
          <span class="etiqueta-grupo">{{ grupo.titulo }}</span>
          <div class="opciones-pagina" role="radiogroup" :aria-label="grupo.titulo">
            <button
              v-for="op in grupo.opciones"
              :key="op.valor"
              type="button"
              role="radio"
              :aria-checked="sesion.pagina[grupo.clave] === op.valor"
              class="opcion-pagina"
              :class="{ activa: sesion.pagina[grupo.clave] === op.valor }"
              @click="configurarPagina({ [grupo.clave]: op.valor })"
            >
              <strong>{{ op.etiqueta }}</strong>
              <small>{{ op.detalle }}</small>
            </button>
          </div>
        </div>
        <p class="modal-nota">
          Página actual: {{ resumenPagina }}. Se guarda en este navegador y se usa para mostrar, imprimir y exportar el
          documento; no cambia lo que ven las demás personas.
        </p>
      </div>
    </div>

    <div class="modal-fondo no-print" v-if="modal === 'atajos'" @click.self="modal = null">
      <div class="modal px-panel" role="dialog" aria-label="Atajos de teclado">
        <div class="modal-cabecera">
          <span>ATAJOS</span>
          <button class="px-btn" @click="modal = null">X</button>
        </div>
        <ul class="atajos-lista">
          <li v-for="a in atajos" :key="a[0]"><kbd>{{ a[0] }}</kbd><span>{{ a[1] }}</span></li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import BarraFormato from '../components/BarraFormato.vue'
import {
  sesion,
  TAMANOS_PAGINA,
  MARGENES_PAGINA,
  alternarTema,
  alternarCrt,
  alternarSonido,
  alternarZen,
  cambiarJugador,
  configurarPagina,
  dimensionesPagina,
  crearDocumentoNuevo,
  enlaceDocumento,
  avisar
} from '../stores/sesion'

const menuActivo = ref(null)
const modal = ref(null)

const atajos = [
  ['/', 'Abrir el menú de bloques (incluye el salto de página)'],
  ['Enter', 'Salto de línea (en títulos y listas crea el siguiente bloque)'],
  ['Ctrl + Enter', 'Nuevo bloque debajo'],
  ['Shift + Enter', 'Salto de línea sin crear párrafo'],
  ['Backspace', 'En un bloque vacío: volver a texto o eliminarlo'],
  ['Alt + ↑ / ↓', 'Mover el bloque'],
  ['↑ / ↓', 'Saltar entre bloques desde el borde'],
  ['Ctrl + Z / Ctrl + Y', 'Deshacer / rehacer'],
  ['Ctrl + B / I / U', 'Negrita / cursiva / subrayado'],
  ['Ctrl + .', 'Modo enfoque'],
  ['Esc', 'Cerrar menús o salir del enfoque']
]

const enlace = computed(() => enlaceDocumento())

const jugadores = computed(() =>
  sesion.usuarios.length
    ? sesion.usuarios
    : [{ id: 'yo', uid: sesion.uid, nombre: sesion.nombre, color: sesion.color }]
)

const visibles = computed(() => jugadores.value.slice(0, 3))
const extra = computed(() => Math.max(0, jugadores.value.length - 3))
const esYo = (u) => u.id === 'yo' || u.id === sesion.miId || u.uid === sesion.uid
const inicial = (nombre) => (String(nombre || '?').trim()[0] || '?').toUpperCase()

const textoCm = (cm) => `${cm[0].toFixed(1).replace('.', ',')} × ${cm[1].toFixed(1).replace('.', ',')} cm`

const gruposPagina = computed(() => [
  {
    clave: 'tamano',
    titulo: 'TAMAÑO',
    opciones: Object.entries(TAMANOS_PAGINA).map(([valor, t]) => ({
      valor,
      etiqueta: t.etiqueta,
      detalle: textoCm(t.cm)
    }))
  },
  {
    clave: 'orientacion',
    titulo: 'ORIENTACIÓN',
    opciones: [
      { valor: 'vertical', etiqueta: 'VERTICAL', detalle: 'Hoja de pie' },
      { valor: 'horizontal', etiqueta: 'HORIZONTAL', detalle: 'Hoja acostada' }
    ]
  },
  {
    clave: 'margen',
    titulo: 'MÁRGENES',
    opciones: Object.entries(MARGENES_PAGINA).map(([valor, m]) => ({
      valor,
      etiqueta: m.etiqueta,
      detalle: m.cm
    }))
  }
])

const resumenPagina = computed(() => {
  const base = TAMANOS_PAGINA[sesion.pagina.tamano] || TAMANOS_PAGINA.carta
  const orientacion = sesion.pagina.orientacion === 'horizontal' ? 'horizontal' : 'vertical'
  return `${base.etiqueta} ${orientacion}, ${dimensionesPagina()}`
})

watch(
  () => sesion.titulo,
  (valor) => {
    document.title = `${(valor || '').trim() || 'Documento sin título'} · Editor_Docs`
  },
  { immediate: true }
)

const menus = computed(() => [
  {
    nombre: 'Archivo',
    opciones: [
      { etiqueta: 'Nuevo documento', accion: 'nuevo' },
      { separador: true },
      { etiqueta: 'Descargar como PDF', accion: 'pdf' },
      { etiqueta: 'Descargar como Word (.docx)', accion: 'docx' },
      { etiqueta: 'Descargar como texto (.txt)', accion: 'txt' },
      { etiqueta: 'Descargar como Markdown (.md)', accion: 'md' },
      { etiqueta: 'Descargar como página web (.html)', accion: 'html' },
      { separador: true },
      { etiqueta: 'Configurar página...', accion: 'pagina' },
      { etiqueta: 'Imprimir', accion: 'imprimir', atajo: 'Ctrl+P' },
      { separador: true },
      { etiqueta: 'Cambiar jugador', accion: 'jugador' }
    ]
  },
  {
    nombre: 'Editar',
    opciones: [
      { etiqueta: 'Deshacer', accion: 'undo', atajo: 'Ctrl+Z' },
      { etiqueta: 'Rehacer', accion: 'redo', atajo: 'Ctrl+Y' },
      { separador: true },
      { etiqueta: 'Cortar', accion: 'cut', atajo: 'Ctrl+X' },
      { etiqueta: 'Copiar', accion: 'copy', atajo: 'Ctrl+C' },
      { etiqueta: 'Seleccionar todo', accion: 'selectAll', atajo: 'Ctrl+A' }
    ]
  },
  {
    nombre: 'Ver',
    opciones: [
      { etiqueta: 'Modo enfoque', accion: 'zen', atajo: 'Ctrl+.' },
      { etiqueta: 'Pantalla completa', accion: 'fullscreen' },
      { separador: true },
      { etiqueta: sesion.tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', accion: 'tema' },
      { etiqueta: sesion.crt === 'on' ? 'Desactivar efecto CRT' : 'Activar efecto CRT', accion: 'crt' },
      { etiqueta: sesion.sonido ? 'Silenciar sonidos' : 'Activar sonidos', accion: 'sonido' }
    ]
  },
  {
    nombre: 'Ayuda',
    opciones: [{ etiqueta: 'Atajos de teclado', accion: 'atajos' }]
  }
])

const alternarMenu = (nombre) => {
  menuActivo.value = menuActivo.value === nombre ? null : nombre
}

const cerrarMenu = () => {
  menuActivo.value = null
}

const copiarEnlace = async () => {
  try {
    await navigator.clipboard.writeText(enlace.value)
    avisar('ENLACE COPIADO')
  } catch {
    avisar('NO SE PUDO COPIAR')
  }
}

const ejecutarAccion = (accion) => {
  cerrarMenu()
  if (['cut', 'copy', 'selectAll'].includes(accion)) {
    document.execCommand(accion, false, null)
  } else if (accion === 'undo') {
    window.dispatchEvent(new CustomEvent('deshacer-documento'))
  } else if (accion === 'redo') {
    window.dispatchEvent(new CustomEvent('rehacer-documento'))
  } else if (['pdf', 'docx', 'txt', 'md', 'html'].includes(accion)) {
    window.dispatchEvent(new CustomEvent('exportar-documento', { detail: { formato: accion } }))
  } else if (accion === 'imprimir') {
    window.print()
  } else if (accion === 'pagina') {
    modal.value = 'pagina'
  } else if (accion === 'nuevo') {
    crearDocumentoNuevo()
  } else if (accion === 'jugador') {
    cambiarJugador()
  } else if (accion === 'zen') {
    alternarZen()
  } else if (accion === 'fullscreen') {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  } else if (accion === 'tema') {
    alternarTema()
  } else if (accion === 'crt') {
    alternarCrt()
  } else if (accion === 'sonido') {
    alternarSonido()
  } else if (accion === 'atajos') {
    modal.value = 'atajos'
  }
}

const alTeclear = (e) => {
  if (e.key === 'Escape') {
    if (modal.value) modal.value = null
    else if (sesion.zen) alternarZen()
    else cerrarMenu()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '.') {
    e.preventDefault()
    alternarZen()
  }
}

const abrirCompartir = () => {
  modal.value = 'compartir'
}

const abrirConfiguracionPagina = () => {
  modal.value = 'pagina'
}

onMounted(() => {
  window.addEventListener('keydown', alTeclear)
  window.addEventListener('abrir-compartir', abrirCompartir)
  window.addEventListener('abrir-configuracion-pagina', abrirConfiguracionPagina)
})

onUnmounted(() => {
  window.removeEventListener('keydown', alTeclear)
  window.removeEventListener('abrir-compartir', abrirCompartir)
  window.removeEventListener('abrir-configuracion-pagina', abrirConfiguracionPagina)
})
</script>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
}

.cabecera {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px 14px;
  background: var(--bg);
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.px-navbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px 16px;
  padding: 8px 18px;
}

.nav-left {
  flex: 1 1 300px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.nav-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.logo-badge {
  flex-shrink: 0;
  padding: 12px 8px;
  background: var(--ink);
  color: var(--on-ink);
  border: 3px solid var(--ink);
  box-shadow: 3px 3px 0 var(--shadow);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.65rem;
}

.doc-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.doc-title-input {
  width: 100%;
  max-width: 420px;
  margin-left: -6px;
  padding: 0 6px;
  background: transparent;
  color: var(--text);
  border: 2px solid transparent;
  font-size: 1.55rem;
  line-height: 1.2;
  text-overflow: ellipsis;
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
  flex-wrap: wrap;
  gap: 2px;
  margin-left: -6px;
}

.menu-container {
  position: relative;
}

.menu-item {
  padding: 0 10px;
  background: transparent;
  border: 2px solid transparent;
  color: var(--text);
  font-size: 1.15rem;
  line-height: 1.4;
  cursor: pointer;
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
  z-index: 60;
  min-width: 290px;
  max-width: calc(100vw - 24px);
  margin-top: 12px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  padding: 4px 10px;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 1.2rem;
  text-align: left;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--accent);
  color: var(--on-accent);
}

.separador {
  height: 2px;
  margin: 4px 6px;
  background: var(--accent-soft);
}

.atajo {
  font-size: 0.95rem;
  opacity: 0.7;
}

.players {
  display: flex;
  padding: 4px 6px 4px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
}

.player {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  margin-left: -6px;
  border: 3px solid var(--ink);
  box-shadow: 2px 2px 0 var(--shadow);
  color: #1b1740;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
}

.player.yo {
  outline: 2px solid var(--text);
  outline-offset: 1px;
}

.player.mas {
  background: var(--panel);
  color: var(--text);
}

.icono-btn {
  width: 42px;
  padding: 0;
  font-family: 'VT323', monospace;
  font-size: 1.6rem;
}

.icono-btn.apagado {
  opacity: 0.5;
  text-decoration: line-through;
}

.solo-movil {
  display: none;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem 1rem 4.5rem;
}

.zen-salir {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 60;
}

.toast {
  position: fixed;
  bottom: 60px;
  left: 50%;
  z-index: 300;
  max-width: calc(100vw - 24px);
  transform: translateX(-50%);
  padding: 12px 18px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  text-align: center;
  animation: pop 0.2s ease-out;
}

.modal-fondo {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(5, 5, 5, 0.55);
}

.modal {
  width: min(520px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 20px 22px 24px;
}

.modal-cabecera {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.7rem;
}

.modal-texto,
.modal-nota {
  margin: 0 0 14px;
  color: var(--muted);
  line-height: 1.2;
}

.campo-copia {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.campo-copia input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 10px;
  background: var(--sheet);
  color: var(--text);
  border: 3px solid var(--ink);
  font-size: 1.1rem;
  outline: none;
}

.codigo-doc {
  margin-bottom: 16px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  color: var(--muted);
}

.codigo-doc strong {
  margin-left: 8px;
  padding: 3px 8px;
  background: var(--ink);
  color: var(--on-ink);
}

.modal-sub {
  margin: 0 0 8px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  font-weight: 400;
}

.lista-personas,
.atajos-lista {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.lista-personas li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 2px dashed var(--accent-soft);
}

.chip {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 3px solid var(--ink);
  color: #1b1740;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
}

.nombre {
  flex: 1;
  font-size: 1.3rem;
}

.nombre em {
  color: var(--muted);
  font-style: normal;
}

.lista-personas code {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.8rem;
  color: var(--muted);
}

.grupo-pagina {
  margin-bottom: 16px;
}

.etiqueta-grupo {
  display: block;
  margin-bottom: 8px;
  color: var(--muted);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
}

.opciones-pagina {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.opcion-pagina {
  flex: 1 1 110px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 8px;
  background: var(--sheet);
  color: var(--text);
  border: 3px solid var(--ink);
  box-shadow: 3px 3px 0 var(--shadow);
  text-align: left;
  cursor: pointer;
}

.opcion-pagina strong {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  font-weight: 400;
}

.opcion-pagina small {
  color: var(--muted);
  font-size: 1.05rem;
}

.opcion-pagina:hover {
  background: var(--accent-soft);
}

.opcion-pagina.activa {
  background: var(--accent);
  color: var(--on-accent);
}

.opcion-pagina.activa small {
  color: var(--on-accent);
}

.atajos-lista li {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 0;
  border-bottom: 2px dashed var(--accent-soft);
}

.atajos-lista kbd {
  min-width: 150px;
  padding: 3px 8px;
  background: var(--ink);
  color: var(--on-ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
}

.atajos-lista span {
  line-height: 1.1;
}

@media (max-width: 900px) {
  .logo-badge {
    display: none;
  }
}

@media (max-width: 699px) {
  .cabecera {
    display: contents;
  }

  .px-navbar {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'titulo acciones'
      'menu menu';
    align-items: center;
    margin: 8px 8px 0;
    padding: 6px 10px;
    gap: 2px 8px;
  }

  .nav-left,
  .doc-controls {
    display: contents;
  }

  .doc-title-input {
    grid-area: titulo;
    max-width: none;
    font-size: 1.4rem;
  }

  .doc-menu {
    grid-area: menu;
  }

  .nav-right {
    grid-area: acciones;
    gap: 6px;
    margin-left: 0;
  }

  .players,
  .solo-escritorio {
    display: none;
  }

  .solo-movil {
    display: inline;
  }

  .icono-btn {
    width: 38px;
    height: 38px;
  }

  .compartir-btn {
    width: 42px;
    padding: 0;
    font-size: 0.9rem;
  }

  .menu-container {
    position: static;
  }

  .px-dropdown {
    top: auto;
    left: 8px;
    right: 8px;
    min-width: 0;
    max-width: none;
    margin-top: 10px;
  }

  .toast {
    bottom: 56px;
  }

  .modal {
    padding: 16px 14px 20px;
  }
}
</style>