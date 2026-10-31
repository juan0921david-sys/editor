<template>
  <div class="barra px-panel no-print" @mousedown.prevent @scroll="cerrar">
    <div class="grupo">
      <button class="sel" :disabled="!sesion.activo" title="Tipo de bloque" @click.stop="alternar('tipo', $event)">
        <span>{{ etiquetaTipo }}</span><i>▾</i>
      </button>
    </div>

    <div class="grupo">
      <button class="tool-btn" title="Deshacer (Ctrl+Z)" @click="emitir('deshacer-documento')">↶</button>
      <button class="tool-btn" title="Rehacer (Ctrl+Y)" @click="emitir('rehacer-documento')">↷</button>
    </div>

    <div class="grupo">
      <button class="sel ancho" title="Fuente" @click.stop="alternar('fuente', $event)">
        <span :style="{ fontFamily: `'${fuenteActual}'` }">{{ fuenteActual }}</span><i>▾</i>
      </button>
      <button class="tool-btn" title="Reducir tamaño" @click="cambiarTamano(-1)">−</button>
      <span class="valor">{{ tamanoActual }}</span>
      <button class="tool-btn" title="Aumentar tamaño" @click="cambiarTamano(1)">+</button>
    </div>

    <div class="grupo">
      <button
        v-for="f in formatos"
        :key="f.comando"
        :class="['tool-btn', f.clase, { on: activos[f.comando] }]"
        :title="f.titulo"
        @click="formatear(f.comando)"
      >
        {{ f.etiqueta }}
      </button>
    </div>

    <div class="grupo">
      <button class="tool-btn" title="Color del texto" @click.stop="alternar('color', $event)">
        <span class="letra-a">A</span><i class="muestra" :style="{ background: ultimoColor }"></i>
      </button>
      <button class="tool-btn" title="Resaltado" @click.stop="alternar('fondo', $event)">
        <span class="letra-a resaltada">A</span><i class="muestra" :style="{ background: ultimoFondo }"></i>
      </button>
    </div>

    <div class="grupo">
      <button
        v-for="a in alineaciones"
        :key="a.comando"
        :class="['tool-btn', { on: activos[a.comando] }]"
        :title="a.titulo"
        @click="formatear(a.comando)"
      >
        <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" shape-rendering="crispEdges">
          <rect v-for="(barra, i) in a.barras" :key="i" :x="barra[0]" :y="barra[1]" :width="barra[2]" height="2" />
        </svg>
      </button>
      <button class="tool-btn quitar" title="Quitar formato" @click="formatear('removeFormat')">Tx</button>
    </div>

    <div class="grupo">
      <button class="px-btn primary add-btn" @click="emitir('agregar-bloque-final')">+ BLOQUE</button>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="abierto && (abierto !== 'tipo' || sesion.activo)"
      class="popover px-panel no-print"
      :class="{ paleta: abierto === 'color' || abierto === 'fondo' }"
      :style="{ top: posicion.top + 'px', left: posicion.left + 'px' }"
      @mousedown.prevent
      @click.stop
    >
      <template v-if="abierto === 'tipo'">
        <button
          v-for="t in TIPOS"
          :key="t.id"
          class="opcion"
          :class="{ actual: t.id === sesion.activo.tipo }"
          @click="elegirTipo(t.id)"
        >
          <span class="icono">{{ t.icono }}</span><span>{{ t.etiqueta }}</span>
        </button>
      </template>

      <template v-else-if="abierto === 'fuente'">
        <button
          v-for="f in FUENTES"
          :key="f"
          class="opcion"
          :class="{ actual: f === fuenteActual }"
          :style="{ fontFamily: `'${f}'` }"
          @click="aplicarFuente(f)"
        >
          {{ f }}
        </button>
      </template>

      <template v-else-if="abierto === 'color'">
        <button
          v-for="c in COLORES_TEXTO"
          :key="c"
          class="cuadro"
          :style="{ background: c }"
          :title="c"
          @click="aplicarColor('foreColor', c)"
        ></button>
      </template>

      <template v-else-if="abierto === 'fondo'">
        <button
          v-for="c in COLORES_FONDO"
          :key="c"
          class="cuadro"
          :style="{ background: c }"
          :title="c"
          @click="aplicarColor('hiliteColor', c)"
        ></button>
        <button class="cuadro quitar-fondo" title="Quitar resaltado" @click="aplicarColor('hiliteColor', 'transparent')">×</button>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { sesion } from '../stores/sesion'
import { TIPOS, etiquetaDeTipo } from '../utils/tipos'
import { FUENTES, nombreFuente } from '../utils/sanitizar'
import { sonidos } from '../utils/sonidos'

const TAMANOS = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48]
const COLORES_TEXTO = ['#1B1740', '#2B2563', '#6F6BD9', '#B9A9E8', '#D63D5B', '#E8903A', '#1FA45B', '#2E86DE', '#E8A9D6', '#FFFFFF']
const COLORES_FONDO = ['#FFF2A8', '#E8E0FF', '#CFF5E3', '#FFD6E7', '#CDE4FF', '#FFE0B8', '#D9D9D9']

const formatos = [
  { comando: 'bold', titulo: 'Negrita (Ctrl+B)', etiqueta: 'B', clase: 'fmt-b' },
  { comando: 'italic', titulo: 'Cursiva (Ctrl+I)', etiqueta: 'I', clase: 'fmt-i' },
  { comando: 'underline', titulo: 'Subrayado (Ctrl+U)', etiqueta: 'U', clase: 'fmt-u' },
  { comando: 'strikeThrough', titulo: 'Tachado', etiqueta: 'S', clase: 'fmt-s' }
]

const alineaciones = [
  { comando: 'justifyLeft', titulo: 'Alinear a la izquierda', barras: [[1, 3, 14], [1, 7, 9], [1, 11, 12]] },
  { comando: 'justifyCenter', titulo: 'Centrar', barras: [[1, 3, 14], [4, 7, 8], [2, 11, 12]] },
  { comando: 'justifyRight', titulo: 'Alinear a la derecha', barras: [[1, 3, 14], [6, 7, 9], [3, 11, 12]] },
  { comando: 'justifyFull', titulo: 'Justificar', barras: [[1, 3, 14], [1, 7, 14], [1, 11, 14]] }
]

const activos = reactive({
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  justifyLeft: false,
  justifyCenter: false,
  justifyRight: false,
  justifyFull: false
})

const abierto = ref(null)
const posicion = ref({ top: 0, left: 0 })
const tamanoActual = ref(16)
const fuenteActual = ref('IBM Plex Mono')
const ultimoColor = ref('#B9A9E8')
const ultimoFondo = ref('#FFF2A8')

const etiquetaTipo = computed(() => (sesion.activo ? etiquetaDeTipo(sesion.activo.tipo).toUpperCase() : 'BLOQUE'))

const emitir = (nombre, detalle) => window.dispatchEvent(new CustomEvent(nombre, { detail: detalle }))

const ANCHO_LISTA = 230
const ANCHO_PALETA = 172

const alternar = (nombre, evento) => {
  if (abierto.value === nombre) {
    abierto.value = null
    return
  }
  const caja = evento.currentTarget.getBoundingClientRect()
  const ancho = nombre === 'color' || nombre === 'fondo' ? ANCHO_PALETA : ANCHO_LISTA
  posicion.value = {
    top: Math.round(caja.bottom + 8),
    left: Math.round(Math.max(8, Math.min(caja.left, window.innerWidth - ancho - 8)))
  }
  abierto.value = nombre
}

const editorActual = () => {
  const seleccion = window.getSelection()
  const nodo = seleccion ? seleccion.anchorNode : null
  const elemento = nodo ? (nodo.nodeType === 1 ? nodo : nodo.parentElement) : null
  return elemento && elemento.closest ? elemento.closest('.rich-textarea') : null
}

const conEditor = (accion) => {
  const editor = editorActual()
  if (!editor || !editor.isContentEditable) {
    sonidos.error()
    return
  }
  accion(editor)
  actualizarEstado()
}

const actualizarEstado = () => {
  const editor = editorActual()
  Object.keys(activos).forEach((comando) => {
    if (!editor) {
      activos[comando] = false
      return
    }
    try {
      activos[comando] = document.queryCommandState(comando)
    } catch {
      activos[comando] = false
    }
  })
  if (!editor) return
  const nodo = window.getSelection().anchorNode
  if (!nodo) return
  const elemento = nodo.nodeType === 1 ? nodo : nodo.parentElement
  if (!elemento) return
  const estilo = getComputedStyle(elemento)
  tamanoActual.value = Math.round(parseFloat(estilo.fontSize)) || 16
  fuenteActual.value = nombreFuente(estilo.fontFamily) || 'IBM Plex Mono'
}

const formatear = (comando) =>
  conEditor(() => {
    document.execCommand('styleWithCSS', false, false)
    document.execCommand(comando, false, null)
  })

const aplicarColor = (comando, valor) => {
  abierto.value = null
  conEditor(() => {
    document.execCommand('styleWithCSS', false, true)
    document.execCommand(comando, false, valor)
    if (comando === 'foreColor') ultimoColor.value = valor
    else if (valor !== 'transparent') ultimoFondo.value = valor
  })
}

const seleccionarTodoElBloque = (editor) => {
  const seleccion = window.getSelection()
  if (!seleccion.isCollapsed) return
  const rango = document.createRange()
  rango.selectNodeContents(editor)
  seleccion.removeAllRanges()
  seleccion.addRange(rango)
}

const reseleccionar = (nodos) => {
  if (!nodos.length) return
  const rango = document.createRange()
  rango.setStartBefore(nodos[0])
  rango.setEndAfter(nodos[nodos.length - 1])
  const seleccion = window.getSelection()
  seleccion.removeAllRanges()
  seleccion.addRange(rango)
}

const convertirFont = (editor, selector, aplicar) => {
  const nuevos = []
  editor.querySelectorAll(selector).forEach((fuente) => {
    const span = document.createElement('span')
    aplicar(span, fuente)
    while (fuente.firstChild) span.appendChild(fuente.firstChild)
    fuente.replaceWith(span)
    nuevos.push(span)
  })
  nuevos.forEach((span) => {
    span.querySelectorAll('span').forEach((interno) => {
      if (span.style.fontSize) interno.style.removeProperty('font-size')
      if (span.style.fontFamily) interno.style.removeProperty('font-family')
    })
  })
  reseleccionar(nuevos)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
}

const aplicarTamano = (px) =>
  conEditor((editor) => {
    seleccionarTodoElBloque(editor)
    document.execCommand('styleWithCSS', false, false)
    document.execCommand('fontSize', false, '7')
    convertirFont(editor, 'font[size="7"]', (span) => {
      span.style.fontSize = `${px}px`
    })
    setTimeout(() => {
      tamanoActual.value = px
    }, 10)
  })

const aplicarFuente = (nombre) => {
  abierto.value = null
  conEditor((editor) => {
    seleccionarTodoElBloque(editor)
    document.execCommand('styleWithCSS', false, false)
    document.execCommand('fontName', false, nombre)
    convertirFont(editor, 'font[face]', (span) => {
      span.style.fontFamily = `"${nombre}"`
    })
    fuenteActual.value = nombre
  })
}

const cambiarTamano = (direccion) => {
  const actual = Number(tamanoActual.value)
  const siguiente =
    direccion > 0
      ? TAMANOS.find((t) => t > actual) || TAMANOS[TAMANOS.length - 1]
      : [...TAMANOS].reverse().find((t) => t < actual) || TAMANOS[0]
  aplicarTamano(siguiente)
}

const elegirTipo = (id) => {
  abierto.value = null
  emitir('cambiar-tipo-activo', id)
}

const cerrar = () => {
  abierto.value = null
}

onMounted(() => {
  document.addEventListener('selectionchange', actualizarEstado)
  document.addEventListener('click', cerrar)
  window.addEventListener('resize', cerrar)
  window.addEventListener('scroll', cerrar, true)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', actualizarEstado)
  document.removeEventListener('click', cerrar)
  window.removeEventListener('resize', cerrar)
  window.removeEventListener('scroll', cerrar, true)
})
</script>

<style scoped>
.barra {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  padding: 6px 8px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.grupo {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
}

.grupo + .grupo {
  border-left: 2px solid var(--accent-soft);
}

.sel {
  height: 34px;
  min-width: 112px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  border: 2px solid var(--ink);
  color: var(--text);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  cursor: pointer;
}

.sel.ancho {
  min-width: 140px;
  font-family: inherit;
  font-size: 1.15rem;
}

.sel:disabled {
  opacity: 0.45;
  cursor: default;
}

.sel i {
  font-style: normal;
}

.tool-btn {
  position: relative;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  padding: 0;
  background: transparent;
  border: 2px solid transparent;
  color: var(--text);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.06s, background 0.15s;
}

.tool-btn:hover {
  background: var(--accent-soft);
  border-color: var(--ink);
}

.tool-btn:active {
  transform: translate(2px, 2px);
}

.tool-btn.on {
  background: var(--ink);
  color: var(--on-ink);
}

.fmt-b,
.fmt-i,
.fmt-u,
.fmt-s,
.quitar {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1.05rem;
}

.fmt-b {
  font-weight: 700;
}

.fmt-i {
  font-style: italic;
}

.fmt-u {
  text-decoration: underline;
}

.fmt-s {
  text-decoration: line-through;
}

.valor {
  min-width: 28px;
  text-align: center;
  font-size: 1.25rem;
}

.letra-a {
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 700;
  font-size: 1.05rem;
  margin-top: -5px;
}

.letra-a.resaltada {
  background: #fff2a8;
  color: #1b1740;
  padding: 0 3px;
}

.muestra {
  position: absolute;
  left: 7px;
  right: 7px;
  bottom: 3px;
  height: 4px;
}

.add-btn {
  height: 34px;
  white-space: nowrap;
}

.popover {
  position: fixed;
  z-index: 70;
  width: 230px;
  max-width: calc(100vw - 16px);
  max-height: min(340px, 70vh);
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.opcion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 1.2rem;
  text-align: left;
  cursor: pointer;
}

.opcion:hover,
.opcion.actual {
  background: var(--accent);
  color: var(--on-accent);
}

.icono {
  min-width: 30px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
  font-weight: 700;
}

.paleta {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 6px;
  width: 172px;
}

.cuadro {
  width: 28px;
  height: 28px;
  border: 2px solid var(--ink);
  cursor: pointer;
  transition: transform 0.08s;
}

.cuadro:hover {
  transform: scale(1.12);
}

.quitar-fondo {
  background: var(--sheet);
  color: var(--text);
  font-size: 1.2rem;
  line-height: 1;
}

@media (hover: none) {
  .tool-btn {
    width: 38px;
    height: 38px;
  }
}

@media (max-width: 699px) {
  .barra {
    position: sticky;
    top: 0;
    z-index: 50;
    margin: 8px 8px 0;
  }

  .grupo {
    padding: 0 6px;
  }
}
</style>