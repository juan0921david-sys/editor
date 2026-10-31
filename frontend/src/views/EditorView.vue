<template>
  <div class="editor-container" ref="lienzoRef">
    <div v-if="!conectado" class="aviso-offline no-print">SIN CONEXIÓN · EDICIÓN EN PAUSA</div>

    <div class="escala" :style="estiloEscala">
      <div class="hoja" ref="hojaRef" :class="{ movil: modoMovil }" :style="estiloHoja">
        <div v-if="!modoMovil" class="papeles no-print" aria-hidden="true">
          <div v-for="n in paginas" :key="n" class="papel" :style="{ top: (n - 1) * paso + 'px' }"></div>
          <span
            v-for="n in paginas"
            :key="'etiqueta-' + n"
            class="papel-etiqueta"
            :style="{ top: (n - 1) * paso + geo.alto + 14 + 'px' }"
          >
            {{ n }} / {{ paginas }}
          </span>
        </div>

        <div class="contenido" ref="contenidoRef">
          <div v-if="!sesion.sincronizado" class="estado-carga no-print">
            {{ conectado ? 'CARGANDO DOCUMENTO...' : 'CONECTANDO CON EL SERVIDOR...' }}
          </div>

          <BlockUI
            v-for="(bloque, index) in bloques"
            :key="String(bloque.id)"
            class="block-wrapper"
            :bloque="bloque"
            :index="index"
            :isFirst="index === 0"
            :isLast="index === bloques.length - 1"
            :miSocketId="sesion.miId"
            :miColor="sesion.color"
            :soloLectura="!puedeEditar"
            :numero="numeros[index]"
            :duenoNombre="nombreDe(bloque.bloqueadoPor)"
            :duenoColor="colorDe(bloque.bloqueadoPor)"
            :indicador="indicadorDe(index)"
            :arrastrado="arrastrando === index"
            :hayArrastre="arrastrando !== null"
            @solicitar-bloqueo="enviarSolicitudBloqueo"
            @liberar-bloqueo="enviarLiberacionBloqueo"
            @update-content="actualizarContenido"
            @add-block="(i) => agregarBloqueDespues(i)"
            @enter-bloque="alPulsarEnter"
            @delete-block="eliminarBloque"
            @delete-empty="alBorrarVacio"
            @move-up="(i) => moverA(i, i - 1)"
            @move-down="(i) => moverA(i, i + 1)"
            @move-key="moverPorTeclado"
            @navegar="navegar"
            @cambiar-tipo="alCambiarTipo"
            @toggle-hecho="alternarHecho"
            @pegar-bloques="pegarBloques"
            @drag-start="iniciarArrastre"
            @drag-over="sobreBloque"
            @drop-block="soltar"
            @drag-end="finArrastre"
          />

          <button v-if="sesion.sincronizado && bloques.length === 0" class="empty-state" @click="agregarBloqueFinal">
            Haz clic aquí para empezar a escribir...
          </button>
        </div>
      </div>
    </div>

    <footer class="barra-estado no-print" v-show="!sesion.zen">
      <span class="estado-item" :title="conectado ? 'Conectado al servidor' : 'Sin conexión'">
        <span class="led" :class="{ on: conectado }"></span>
        <span class="solo-escritorio">{{ conectado ? 'ONLINE' : 'OFFLINE' }}</span>
      </span>
      <button class="estado-item boton" :title="nombresConectados" @click="emitirVentana('abrir-compartir')">
        {{ sesion.usuarios.length }} JUG
      </button>
      <span v-if="!modoMovil" class="estado-item">PÁG {{ paginaActual }}/{{ paginas }}</span>
      <span class="estado-item solo-escritorio">{{ totalPalabras }} PAL</span>
      <span class="estado-item solo-escritorio">{{ totalCaracteres }} CAR</span>
      <span v-if="puedeEditar" class="estado-item estado-guardado" :class="'estado-' + sesion.guardado">{{ textoGuardado }}</span>
      <span class="espaciador"></span>
      <button
        v-if="!modoMovil"
        class="estado-item boton"
        title="Configurar página"
        @click="emitirVentana('abrir-configuracion-pagina')"
      >
        {{ etiquetaPagina }}
      </button>
      <div v-if="!modoMovil" class="zoom-control">
        <button class="mini-btn" title="Alejar" @click="cambiarZoom(-10)">−</button>
        <span class="zoom-valor">{{ sesion.zoom }}%</span>
        <button class="mini-btn" title="Acercar" @click="cambiarZoom(10)">+</button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { io } from 'socket.io-client'
import BlockUI from '../components/BlockUI.vue'
import {
  sesion,
  COLORES,
  TAMANOS_PAGINA,
  ESPACIO_ENTRE_PAGINAS,
  geometriaPagina,
  cambiarZoom,
  nombreDe,
  colorDe,
  avisar
} from '../stores/sesion'
import { sonidos } from '../utils/sonidos'
import { normalizarTipo, TIPOS_SIN_TEXTO } from '../utils/tipos'
import { sanitizar } from '../utils/sanitizar'
import { exportar, textoPlano } from '../utils/exportar'

const URL_SERVIDOR =
import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const LIMITE_HISTORIAL = 60
const ESPERA_REINTENTO = 3000
const ANCHO_MOVIL = 700
const SEPARACION_BLOQUES = 2
const MAX_LINEAS_PEGADAS = 500
const TIPOS_DE_LISTA = ['lista', 'numerada', 'tarea']

let socket = null
let reintentoUnirse = null
let aplicandoRemoto = false
let tituloPendiente = null
let cuadroPendiente = false
let cuadroScroll = false
let observador = null
let estiloImpresion = null
const historial = []
const rehacerPila = []
const pendientes = new Map()

const lienzoRef = ref(null)
const hojaRef = ref(null)
const contenidoRef = ref(null)
const conectado = ref(false)
const activoId = ref(null)
const arrastrando = ref(null)
const destino = ref(null)
const anchoVentana = ref(window.innerWidth)
const anchoDisponible = ref(0)
const paginas = ref(1)
const paginaActual = ref(1)

let secuenciaIds = 0

const nuevoId = () => {
  secuenciaIds += 1
  return `${Date.now().toString(36)}${secuenciaIds.toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

const crearBloque = (tipo = 'parrafo', contenido = '') => ({
  id: nuevoId(),
  contenido,
  tipo,
  hecho: false,
  bloqueadoPor: null
})

const bloques = ref([])

const puedeEditar = computed(() => conectado.value && sesion.sincronizado)

const modoMovil = computed(() => anchoVentana.value < ANCHO_MOVIL)
const geo = computed(() => geometriaPagina())
const paso = computed(() => geo.value.alto + ESPACIO_ENTRE_PAGINAS)
const alturaHoja = computed(() => paginas.value * paso.value - ESPACIO_ENTRE_PAGINAS)

const escala = computed(() => {
  if (modoMovil.value) return 1
  const ajuste = anchoDisponible.value > 0 ? Math.min(1, anchoDisponible.value / geo.value.ancho) : 1
  return ajuste * (sesion.zoom / 100)
})

const estiloEscala = computed(() =>
  modoMovil.value
    ? {}
    : { width: `${geo.value.ancho * escala.value}px`, height: `${alturaHoja.value * escala.value}px` }
)

const estiloHoja = computed(() => {
  if (modoMovil.value) return {}
  const g = geo.value
  return {
    width: `${g.ancho}px`,
    height: `${alturaHoja.value}px`,
    transform: `scale(${escala.value})`,
    '--mx': `${g.margen}px`,
    '--mt': `${g.margen}px`,
    '--alto-pagina': `${g.alto}px`,
    '--gutter': `${Math.min(84, g.margen)}px`
  }
})

const etiquetaPagina = computed(() => {
  const base = TAMANOS_PAGINA[sesion.pagina.tamano] || TAMANOS_PAGINA.carta
  return `${base.etiqueta}${sesion.pagina.orientacion === 'horizontal' ? ' HORIZ.' : ''}`
})

const nombresConectados = computed(() => sesion.usuarios.map((u) => u.nombre).join(', ') || 'Nadie más conectado')

const textoGuardado = computed(
  () => ({ guardado: 'GUARDADO', guardando: 'GUARDANDO...', error: 'ERROR AL GUARDAR' })[sesion.guardado] || 'GUARDADO'
)

const emitirVentana = (nombre) => window.dispatchEvent(new CustomEvent(nombre))

const sinPermiso = () => {
  if (puedeEditar.value) return false
  sonidos.error()
  return true
}

const bloqueadoPorOtro = (bloque) => !!(bloque && bloque.bloqueadoPor && String(bloque.bloqueadoPor) !== String(sesion.miId))

const indiceActivo = computed(() => bloques.value.findIndex((b) => String(b.id) === String(activoId.value)))
const tipoActivo = computed(() => (indiceActivo.value === -1 ? null : bloques.value[indiceActivo.value].tipo))

const numeros = computed(() => {
  let n = 0
  return bloques.value.map((b) => {
    if (b.tipo === 'numerada') {
      n += 1
      return n
    }
    n = 0
    return 0
  })
})

const textos = computed(() => bloques.value.map((b) => (b.contenido ? textoPlano(b.contenido) : '')))
const totalPalabras = computed(() => textos.value.join(' ').split(/\s+/).filter(Boolean).length)
const totalCaracteres = computed(() => textos.value.join('').length)

watch(
  () => [activoId.value, tipoActivo.value],
  ([id, tipo]) => {
    sesion.activo = id !== null && tipo ? { id: String(id), tipo } : null
  },
  { immediate: true }
)

const paginar = () => {
  cuadroPendiente = false
  const contenedor = contenidoRef.value
  if (!contenedor) return
  const filas = Array.from(contenedor.querySelectorAll(':scope > .block-row'))

  if (modoMovil.value) {
    filas.forEach((fila) => {
      fila.style.removeProperty('--salto')
      fila.__salto = undefined
    })
    if (paginas.value !== 1) paginas.value = 1
    return
  }

  const g = geo.value
  const margen = g.margen
  const util = g.alto - 2 * margen
  const pasoPagina = g.alto + ESPACIO_ENTRE_PAGINAS
  let cursor = margen
  let finUltimo = margen
  let forzarPagina = null

  filas.forEach((fila, i) => {
    const bloque = bloques.value[i]
    const esSalto = !!bloque && bloque.tipo === 'salto'
    const alto = fila.getBoundingClientRect().height / (escala.value || 1)
    let y = cursor

    if (forzarPagina !== null) {
      y = Math.max(y, (forzarPagina + 1) * pasoPagina + margen)
      forzarPagina = null
    }

    let p = Math.floor(y / pasoPagina)

    if (esSalto) {
      forzarPagina = p
    } else {
      let tope = p * pasoPagina + margen
      let fin = p * pasoPagina + g.alto - margen
      if (y < tope) {
        y = tope
      } else if (y >= fin) {
        p += 1
        y = p * pasoPagina + margen
        tope = y
        fin = p * pasoPagina + g.alto - margen
      }
      if (y > tope && y + alto > fin && alto <= util) {
        p += 1
        y = p * pasoPagina + margen
      }
    }

    const espacio = Math.round((y - cursor) * 100) / 100
    if (fila.__salto !== espacio) {
      fila.style.setProperty('--salto', `${espacio}px`)
      fila.__salto = espacio
    }
    cursor = y + alto + SEPARACION_BLOQUES
    finUltimo = y + alto
  })

  let total = Math.floor(Math.max(finUltimo - 1, 0) / pasoPagina) + 1
  if (forzarPagina !== null) total = Math.max(total, forzarPagina + 2)
  total = Math.max(1, total)
  if (paginas.value !== total) paginas.value = total
  actualizarPaginaActual()
}

const programarPaginado = () => {
  if (cuadroPendiente) return
  cuadroPendiente = true
  requestAnimationFrame(paginar)
}

const actualizarPaginaActual = () => {
  cuadroScroll = false
  const hoja = hojaRef.value
  if (!hoja || modoMovil.value) return
  const caja = hoja.getBoundingClientRect()
  const centro = window.innerHeight / 2
  const y = (centro - caja.top) / (escala.value || 1)
  const pagina = Math.min(paginas.value, Math.max(1, Math.floor(y / paso.value) + 1))
  if (paginaActual.value !== pagina) paginaActual.value = pagina
}

const alDesplazar = () => {
  if (cuadroScroll) return
  cuadroScroll = true
  requestAnimationFrame(actualizarPaginaActual)
}

const medirLienzo = () => {
  if (lienzoRef.value) anchoDisponible.value = lienzoRef.value.clientWidth
}

const alRedimensionar = () => {
  anchoVentana.value = window.innerWidth
  medirLienzo()
  programarPaginado()
}

const aplicarEstiloImpresion = () => {
  if (!estiloImpresion) {
    estiloImpresion = document.createElement('style')
    estiloImpresion.id = 'estilo-pagina-impresion'
    document.head.appendChild(estiloImpresion)
  }
  const g = geo.value
  estiloImpresion.textContent = `@page { size: ${g.ancho}px ${g.alto}px; margin: ${g.margen}px; }`
}

watch([bloques, geo, modoMovil], programarPaginado, { deep: true, flush: 'post' })
watch(geo, aplicarEstiloImpresion)

const aplicarTituloRemoto = (titulo) => {
  aplicandoRemoto = true
  sesion.titulo = titulo
  aplicandoRemoto = false
}

watch(
  () => sesion.titulo,
  (valor) => {
    if (aplicandoRemoto) return
    if (socket && puedeEditar.value) {
      socket.emit('cambiar_titulo', valor)
      tituloPendiente = null
    } else {
      tituloPendiente = valor
    }
  },
  { flush: 'sync' }
)

const instantanea = () =>
  bloques.value.map((b) => ({ id: String(b.id), contenido: b.contenido, tipo: b.tipo, hecho: b.hecho }))

const registrar = (antes) => {
  historial.push({ antes, despues: instantanea() })
  if (historial.length > LIMITE_HISTORIAL) historial.shift()
  rehacerPila.length = 0
}

const emitirEstructura = () => {
  if (socket && puedeEditar.value) socket.emit('estructura_actualizada', instantanea())
}

const enviarContenido = (blockId, contenido) => {
  pendientes.set(blockId, contenido)
  if (!socket) return
  socket.emit('actualizar_contenido', { blockId, contenido }, () => {
    if (pendientes.get(blockId) === contenido) pendientes.delete(blockId)
  })
}

const reenviarPendientes = () => {
  Array.from(pendientes.entries()).forEach(([blockId, contenido]) => {
    const bloque = bloques.value.find((b) => String(b.id) === blockId)
    if (!bloque || bloqueadoPorOtro(bloque)) {
      pendientes.delete(blockId)
      return
    }
    bloque.contenido = contenido
    enviarContenido(blockId, contenido)
  })
}

const enfocarBloque = async (id, alFinal = true, soloSiPerdido = false) => {
  await nextTick()
  const editor = document.querySelector(`[data-block-id="${id}"] .rich-textarea`)
  if (!editor) return
  if (soloSiPerdido && document.activeElement === editor) return
  editor.focus({ preventScroll: false })
  const rango = document.createRange()
  rango.selectNodeContents(editor)
  rango.collapse(!alFinal)
  const seleccion = window.getSelection()
  seleccion.removeAllRanges()
  seleccion.addRange(rango)
}

const buscarEditable = (desde, direccion) => {
  let i = desde + direccion
  while (i >= 0 && i < bloques.value.length) {
    const b = bloques.value[i]
    if (!bloqueadoPorOtro(b) && !TIPOS_SIN_TEXTO.includes(b.tipo)) return b
    i += direccion
  }
  return null
}

const agregarBloqueFinal = () => {
  if (sinPermiso()) return
  const antes = instantanea()
  const bloque = crearBloque()
  bloque.bloqueadoPor = sesion.miId
  bloques.value.push(bloque)
  registrar(antes)
  emitirEstructura()
  if (socket) socket.emit('solicitar_bloqueo', String(bloque.id))
  sonidos.agregar()
  enfocarBloque(bloque.id)
}

const agregarBloqueDespues = (index, tipo = 'parrafo') => {
  if (sinPermiso()) return
  const antes = instantanea()
  const bloque = crearBloque(tipo)
  bloque.bloqueadoPor = sesion.miId
  bloques.value.splice(index + 1, 0, bloque)
  registrar(antes)
  emitirEstructura()
  if (socket) socket.emit('solicitar_bloqueo', String(bloque.id))
  sonidos.agregar()
  enfocarBloque(bloque.id)
}

const escaparHtml = (texto) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const pegarBloques = ({ index, lineas }) => {
  if (!puedeEditar.value || !Array.isArray(lineas)) return
  const actual = bloques.value[index]
  if (!actual) return
  const limpias = lineas
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '')
    .slice(0, MAX_LINEAS_PEGADAS)
  if (!limpias.length) return
  const tipo = TIPOS_DE_LISTA.includes(actual.tipo) ? actual.tipo : 'parrafo'
  const antes = instantanea()
  const nuevos = limpias.map((linea) => crearBloque(tipo, escaparHtml(linea)))
  bloques.value.splice(index + 1, 0, ...nuevos)
  registrar(antes)
  emitirEstructura()
  sonidos.agregar()
}

const quitarBloque = (index) => {
  const bloque = bloques.value[index]
  if (!puedeEditar.value || !bloque || bloqueadoPorOtro(bloque)) {
    sonidos.error()
    return false
  }
  const antes = instantanea()
  if (socket && String(bloque.bloqueadoPor) === String(sesion.miId)) socket.emit('liberar_bloqueo', String(bloque.id))
  pendientes.delete(String(bloque.id))
  bloques.value.splice(index, 1)
  registrar(antes)
  emitirEstructura()
  sonidos.eliminar()
  return true
}

const eliminarBloque = (index) => {
  quitarBloque(index)
}

const cambiarTipo = (index, tipo) => {
  const bloque = bloques.value[index]
  if (!puedeEditar.value || !bloque || bloqueadoPorOtro(bloque) || bloque.tipo === tipo) return
  const antes = instantanea()
  const sinTexto = TIPOS_SIN_TEXTO.includes(tipo)
  bloque.tipo = tipo
  if (tipo !== 'tarea') bloque.hecho = false
  let objetivo = String(bloque.id)
  if (sinTexto) {
    bloque.contenido = ''
    enviarContenido(String(bloque.id), '')
    const siguiente = crearBloque()
    siguiente.bloqueadoPor = sesion.miId
    bloques.value.splice(index + 1, 0, siguiente)
    objetivo = String(siguiente.id)
  }
  registrar(antes)
  emitirEstructura()
  if (sinTexto && socket) socket.emit('solicitar_bloqueo', objetivo)
  sonidos.clic()
  enfocarBloque(objetivo, true, !sinTexto)
}

const alCambiarTipo = ({ index, tipo }) => cambiarTipo(index, tipo)

const alCambiarTipoActivo = (e) => {
  if (indiceActivo.value !== -1) cambiarTipo(indiceActivo.value, e.detail)
}

const alternarHecho = (index) => {
  const bloque = bloques.value[index]
  if (!puedeEditar.value || !bloque || bloqueadoPorOtro(bloque)) {
    sonidos.error()
    return
  }
  const antes = instantanea()
  bloque.hecho = !bloque.hecho
  registrar(antes)
  emitirEstructura()
  sonidos.clic()
}

const alPulsarEnter = (index) => {
  const actual = bloques.value[index]
  if (!actual) return
  const vacio = textoPlano(actual.contenido).trim() === ''
  if (vacio && actual.tipo !== 'parrafo') {
    cambiarTipo(index, 'parrafo')
    return
  }
  agregarBloqueDespues(index, TIPOS_DE_LISTA.includes(actual.tipo) ? actual.tipo : 'parrafo')
}

const alBorrarVacio = (index) => {
  const bloque = bloques.value[index]
  if (!bloque) return
  if (bloque.tipo !== 'parrafo') {
    cambiarTipo(index, 'parrafo')
    return
  }
  if (bloques.value.length <= 1) return
  const anterior = index > 0 ? String(bloques.value[index - 1].id) : null
  const siguiente = bloques.value[index + 1] ? String(bloques.value[index + 1].id) : null
  if (!quitarBloque(index)) return
  if (anterior !== null) enfocarBloque(anterior, true)
  else if (siguiente !== null) enfocarBloque(siguiente, false)
}

const moverA = (desde, hacia) => {
  if (hacia < 0 || hacia >= bloques.value.length || desde === hacia) return false
  const bloque = bloques.value[desde]
  if (!puedeEditar.value || bloqueadoPorOtro(bloque)) {
    sonidos.error()
    return false
  }
  const antes = instantanea()
  const [item] = bloques.value.splice(desde, 1)
  bloques.value.splice(hacia, 0, item)
  registrar(antes)
  emitirEstructura()
  sonidos.mover()
  return true
}

const moverPorTeclado = ({ index, dir }) => {
  const id = String(bloques.value[index].id)
  if (moverA(index, index + dir)) enfocarBloque(id, true, true)
}

const navegar = ({ index, dir }) => {
  const objetivo = buscarEditable(index, dir)
  if (objetivo) enfocarBloque(String(objetivo.id), dir < 0)
}

const iniciarArrastre = (index) => {
  arrastrando.value = index
  destino.value = null
}

const sobreBloque = ({ index, despues }) => {
  if (arrastrando.value === null) return
  const actual = destino.value
  if (!actual || actual.index !== index || actual.despues !== despues) destino.value = { index, despues }
}

const indicadorDe = (index) => {
  if (arrastrando.value === null || !destino.value || destino.value.index !== index) return null
  return destino.value.despues ? 'abajo' : 'arriba'
}

const finArrastre = () => {
  arrastrando.value = null
  destino.value = null
}

const soltar = () => {
  const desde = arrastrando.value
  const objetivo = destino.value
  finArrastre()
  if (desde === null || !objetivo) return
  let hacia = objetivo.index + (objetivo.despues ? 1 : 0)
  if (desde < hacia) hacia -= 1
  moverA(desde, hacia)
}

const actualizarContenido = (param1, param2) => {
  if (!puedeEditar.value) return
  const id = (param1 && param1.id) !== undefined ? String(param1.id) : String(param1)
  const contenido = (param1 && param1.contenido) !== undefined ? param1.contenido : param2

  const bloque = bloques.value.find((b) => String(b.id) === id)

  if (bloque && bloqueadoPorOtro(bloque)) return

  if (bloque) bloque.contenido = contenido
  enviarContenido(id, contenido)
}

const enviarSolicitudBloqueo = (blockId) => {
  const strId = String(blockId)
  const bloque = bloques.value.find((b) => String(b.id) === strId)

  if (bloque && bloqueadoPorOtro(bloque)) {
    if (document.activeElement) document.activeElement.blur()
    return
  }

  activoId.value = strId
  if (socket && puedeEditar.value) socket.emit('solicitar_bloqueo', strId)
}

const enviarLiberacionBloqueo = (blockId) => {
  const strId = String(blockId)
  if (String(activoId.value) === strId) activoId.value = null
  if (socket && puedeEditar.value) socket.emit('liberar_bloqueo', strId)
}

const aplicarInstantanea = (lista) => {
  const ids = new Set(lista.map((i) => String(i.id)))
  const eliminados = bloques.value.filter((b) => !ids.has(String(b.id)))
  if (eliminados.some(bloqueadoPorOtro)) return false
  eliminados.forEach((b) => {
    if (socket && String(b.bloqueadoPor) === String(sesion.miId)) socket.emit('liberar_bloqueo', String(b.id))
  })

  const fusion = lista.map((item) => {
    const actual = bloques.value.find((b) => String(b.id) === String(item.id))
    if (actual) {
      actual.tipo = item.tipo
      actual.hecho = item.hecho
      return actual
    }
    return { id: String(item.id), contenido: item.contenido, tipo: item.tipo, hecho: item.hecho, bloqueadoPor: null }
  })

  bloques.value.splice(0, bloques.value.length, ...fusion)
  emitirEstructura()
  return true
}

const editorActivo = () => {
  const el = document.activeElement
  return !!(el && el.classList && el.classList.contains('rich-textarea'))
}

const usarHistorialNativo = (comando) => {
  if (!editorActivo()) return false
  try {
    if (document.queryCommandEnabled(comando)) {
      document.execCommand(comando)
      return true
    }
  } catch {
    return false
  }
  return false
}

const deshacer = () => {
  if (usarHistorialNativo('undo')) return
  if (!puedeEditar.value) return
  const entrada = historial.pop()
  if (!entrada) {
    sonidos.error()
    return
  }
  if (aplicarInstantanea(entrada.antes)) {
    rehacerPila.push(entrada)
    sonidos.mover()
  } else {
    historial.push(entrada)
    sonidos.error()
  }
}

const rehacer = () => {
  if (usarHistorialNativo('redo')) return
  if (!puedeEditar.value) return
  const entrada = rehacerPila.pop()
  if (!entrada) {
    sonidos.error()
    return
  }
  if (aplicarInstantanea(entrada.despues)) {
    historial.push(entrada)
    sonidos.mover()
  } else {
    rehacerPila.push(entrada)
    sonidos.error()
  }
}

const alTeclaGlobal = (e) => {
  const control = e.ctrlKey || e.metaKey
  if (!control || e.altKey) return
  if (e.target && e.target.closest && e.target.closest('input, textarea')) return
  const tecla = e.key.toLowerCase()
  if (tecla === 'z' && !e.shiftKey) {
    e.preventDefault()
    deshacer()
  } else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) {
    e.preventDefault()
    rehacer()
  }
}

const recibirEstructura = (lista) => {
  if (!Array.isArray(lista)) return
  finArrastre()

  const fusion = lista.map((item) => {
    const existente = bloques.value.find((b) => String(b.id) === String(item.id))
    if (existente) {
      existente.tipo = item.tipo !== undefined ? normalizarTipo(item.tipo, existente.tipo) : existente.tipo
      existente.hecho = item.hecho !== undefined ? !!item.hecho : existente.hecho
      if (item.contenido !== undefined && String(existente.bloqueadoPor) !== String(sesion.miId)) {
        existente.contenido = sanitizar(item.contenido)
      }
      return existente
    }
    return {
      id: String(item.id),
      contenido: item.contenido ? sanitizar(item.contenido) : '',
      tipo: normalizarTipo(item.tipo),
      hecho: !!item.hecho,
      bloqueadoPor: null
    }
  })
  bloques.value.splice(0, bloques.value.length, ...fusion)
}

const recibirPresencia = (lista) => {
  if (!Array.isArray(lista)) return
  const limpia = lista.map((u) => ({
    id: String(u.id),
    uid: String(u.uid || '').slice(0, 12),
    nombre: String(u.nombre || '').slice(0, 16) || 'JUGADOR',
    color: COLORES.includes(u.color) ? u.color : COLORES[0]
  }))

  const previos = new Set(sesion.usuarios.map((u) => String(u.id)))
  const nuevos = new Set(limpia.map((u) => String(u.id)))

  if (previos.size > 0) {
    limpia.forEach((u) => {
      if (!previos.has(String(u.id)) && String(u.id) !== String(sesion.miId)) {
        avisar(`${u.nombre.toUpperCase()} SE UNIÓ`)
        sonidos.entrar()
      }
    })
    sesion.usuarios.forEach((u) => {
      if (!nuevos.has(String(u.id))) {
        avisar(`${u.nombre.toUpperCase()} SALIÓ`)
        sonidos.salir()
      }
    })
  }

  sesion.usuarios.splice(0, sesion.usuarios.length, ...limpia)
}

const alExportar = async (e) => {
  const formato = e.detail && e.detail.formato
  if (!formato) return
  avisar('PREPARANDO ARCHIVO...')
  try {
    await exportar(formato, {
      titulo: sesion.titulo,
      autor: sesion.nombre,
      pagina: { ...sesion.pagina },
      bloques: instantanea()
    })
    avisar('ARCHIVO DESCARGADO')
    sonidos.agregar()
  } catch (error) {
    avisar('NO SE PUDO EXPORTAR')
    sonidos.error()
  }
}

const unirse = () => {
  if (!socket || !socket.connected) return
  socket.emit('unirse', {
    documentoId: String(sesion.documentoId),
    uid: sesion.uid,
    nombre: sesion.nombre,
    color: sesion.color
  })
}

const alRecibirEstadoInicial = (estado) => {
  const lista = estado && Array.isArray(estado.bloques) ? estado.bloques : []
  const inicial = lista.map((b) => ({
    id: String(b.id),
    contenido: b.contenido ? sanitizar(b.contenido) : '',
    tipo: normalizarTipo(b.tipo),
    hecho: !!b.hecho,
    bloqueadoPor: null
  }))
  bloques.value.splice(0, bloques.value.length, ...inicial)

  ;((estado && estado.bloqueos) || []).forEach(({ blockId, userId }) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (bloque) bloque.bloqueadoPor = String(userId)
  })

  aplicarTituloRemoto(estado && typeof estado.titulo === 'string' ? estado.titulo : '')

  historial.length = 0
  rehacerPila.length = 0
  sesion.guardado = 'guardado'
  sesion.sincronizado = true

  if (tituloPendiente !== null) {
    const local = tituloPendiente
    tituloPendiente = null
    sesion.titulo = local
  }

  reenviarPendientes()

  if (activoId.value !== null) {
    const bloqueActivo = bloques.value.find((b) => String(b.id) === String(activoId.value))
    if (bloqueActivo && !bloqueadoPorOtro(bloqueActivo)) socket.emit('solicitar_bloqueo', String(activoId.value))
    else activoId.value = null
  }
}

onMounted(() => {
  medirLienzo()
  aplicarEstiloImpresion()

  if (typeof ResizeObserver !== 'undefined') {
    observador = new ResizeObserver(() => {
      medirLienzo()
      programarPaginado()
    })
    if (contenidoRef.value) observador.observe(contenidoRef.value)
    if (lienzoRef.value) observador.observe(lienzoRef.value)
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(programarPaginado)
  programarPaginado()

  window.addEventListener('resize', alRedimensionar)
  window.addEventListener('scroll', alDesplazar, { passive: true })

  socket = io(URL_SERVIDOR)

  socket.on('connect', () => {
    conectado.value = true
    sesion.miId = String(socket.id)
    unirse()
  })

  socket.on('disconnect', () => {
    conectado.value = false
    sesion.sincronizado = false
    sesion.usuarios.splice(0, sesion.usuarios.length)
    bloques.value.forEach((b) => {
      b.bloqueadoPor = null
    })
    clearTimeout(reintentoUnirse)
  })

  socket.on('connect_error', () => {
    conectado.value = false
    sesion.sincronizado = false
  })

  socket.on('error_servidor', () => {
    avisar('NO SE PUDO CARGAR EL DOCUMENTO')
    clearTimeout(reintentoUnirse)
    reintentoUnirse = setTimeout(unirse, ESPERA_REINTENTO)
  })

  socket.on('estado_inicial', alRecibirEstadoInicial)

  socket.on('presencia', recibirPresencia)

  socket.on('estado_guardado', (estado) => {
    if (['guardado', 'guardando', 'error'].includes(estado)) sesion.guardado = estado
  })

  socket.on('titulo_actualizado', (nuevoTitulo) => {
    if (typeof nuevoTitulo === 'string') aplicarTituloRemoto(nuevoTitulo)
  })

  socket.on('bloqueo_aprobado', ({ blockId, userId }) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (bloque) bloque.bloqueadoPor = String(userId)
  })

  socket.on('bloqueo_rechazado', ({ blockId, userId, contenido }) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (bloque) {
      bloque.bloqueadoPor = String(userId)
      if (typeof contenido === 'string') bloque.contenido = sanitizar(contenido)
    }
    pendientes.delete(String(blockId))
    if (String(activoId.value) === String(blockId)) activoId.value = null
    const enfocado = document.activeElement
    if (enfocado && enfocado.closest && enfocado.closest(`[data-block-id="${blockId}"]`)) enfocado.blur()
    sonidos.error()
  })

  socket.on('bloque_liberado', (blockId) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (bloque) bloque.bloqueadoPor = null
  })

  socket.on('contenido_actualizado', ({ blockId, contenido }) => {
    const bloque = bloques.value.find((b) => String(b.id) === String(blockId))
    if (!bloque || String(bloque.bloqueadoPor) === String(sesion.miId)) return
    bloque.contenido = contenido ? sanitizar(contenido) : ''
  })

  socket.on('estructura_actualizada', recibirEstructura)

  window.addEventListener('keydown', alTeclaGlobal)
  window.addEventListener('deshacer-documento', deshacer)
  window.addEventListener('rehacer-documento', rehacer)
  window.addEventListener('agregar-bloque-final', agregarBloqueFinal)
  window.addEventListener('cambiar-tipo-activo', alCambiarTipoActivo)
  window.addEventListener('exportar-documento', alExportar)
})

onUnmounted(() => {
  clearTimeout(reintentoUnirse)
  if (socket) socket.disconnect()
  socket = null
  if (observador) observador.disconnect()
  observador = null
  if (estiloImpresion) estiloImpresion.remove()
  estiloImpresion = null
  sesion.activo = null
  sesion.sincronizado = false
  sesion.guardado = 'guardado'
  window.removeEventListener('resize', alRedimensionar)
  window.removeEventListener('scroll', alDesplazar)
  window.removeEventListener('keydown', alTeclaGlobal)
  window.removeEventListener('deshacer-documento', deshacer)
  window.removeEventListener('rehacer-documento', rehacer)
  window.removeEventListener('agregar-bloque-final', agregarBloqueFinal)
  window.removeEventListener('cambiar-tipo-activo', alCambiarTipoActivo)
  window.removeEventListener('exportar-documento', alExportar)
})
</script>

<style scoped>
.editor-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  padding-bottom: 18px;
  overflow-x: auto;
  overflow-y: hidden;
}

.aviso-offline {
  margin: 0 auto 12px;
  padding: 7px 14px;
  background: #ef4444;
  color: #ffffff;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  text-align: center;
}

.escala {
  position: relative;
  flex-shrink: 0;
  margin: 0 auto;
}

.hoja {
  position: relative;
  transform-origin: top left;
}

.papeles {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.papel {
  position: absolute;
  left: 0;
  width: 100%;
  height: var(--alto-pagina);
  background: var(--sheet);
  border: 3px solid var(--ink);
  box-shadow: 8px 8px 0 var(--shadow), inset 0 0 0 2px var(--sheet), inset 0 0 0 4px var(--accent-soft);
}

.papel-etiqueta {
  position: absolute;
  right: 6px;
  color: var(--muted);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.45rem;
}

.contenido {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  margin-left: calc(var(--mx) - var(--gutter));
  margin-right: var(--mx);
  padding-top: var(--mt);
}

.hoja.movil {
  --gutter: 0px;
  width: 100%;
  min-height: 62vh;
  background: var(--sheet);
  border: 3px solid var(--ink);
  box-shadow: 6px 6px 0 var(--shadow), inset 0 0 0 2px var(--sheet), inset 0 0 0 4px var(--accent-soft);
}

.hoja.movil .contenido {
  margin: 0;
  padding: 18px 8px 56px;
}

.estado-carga {
  margin-left: var(--gutter, 0px);
  padding: 14px 12px;
  color: var(--muted);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  animation: parpadeo 1.2s steps(2) infinite;
}

.empty-state {
  display: block;
  width: calc(100% - var(--gutter, 0px));
  margin-left: var(--gutter, 0px);
  padding: 14px;
  background: transparent;
  border: 2px dashed var(--ink);
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
  font-style: italic;
  font-size: 0.95rem;
  text-align: left;
  cursor: text;
}

.barra-estado {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 7px 14px;
  padding-bottom: calc(7px + env(safe-area-inset-bottom, 0px));
  background: var(--ink);
  color: var(--on-ink);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
}

.estado-item {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.estado-item.boton {
  padding: 4px 6px;
  background: transparent;
  border: 2px solid transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.estado-item.boton:hover {
  border-color: var(--on-ink);
}

.espaciador {
  flex: 1;
}

.estado-guardado.estado-guardando {
  opacity: 0.85;
  animation: parpadeo 1s steps(2) infinite;
}

.estado-guardado.estado-error {
  color: #ff8a8a;
}

.zoom-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mini-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  padding: 0;
  background: transparent;
  border: 2px solid var(--on-ink);
  color: var(--on-ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
}

.mini-btn:hover {
  background: var(--on-ink);
  color: var(--ink);
}

.zoom-valor {
  min-width: 42px;
  text-align: center;
}

.led {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 7px;
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}

.led.on {
  background: #4ade80;
  box-shadow: 0 0 6px #4ade80;
  animation: parpadeo 1.6s steps(2) infinite;
}

@media (max-width: 699px) {
  .solo-escritorio {
    display: none;
  }

  .barra-estado {
    gap: 12px;
    padding: 7px 10px;
    padding-bottom: calc(7px + env(safe-area-inset-bottom, 0px));
  }

  .led {
    margin-right: 0;
  }
}
</style>

<style>
@media print {
  .escala {
    width: auto !important;
    height: auto !important;
    margin: 0 !important;
  }

  .hoja {
    position: static !important;
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    transform: none !important;
    background: #ffffff !important;
    border: none !important;
    box-shadow: none !important;
  }

  .hoja .papeles,
  .barra-estado,
  .aviso-offline {
    display: none !important;
  }

  .editor-container {
    overflow: visible !important;
    padding: 0 !important;
  }

  .hoja .contenido {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .hoja .block-row {
    display: block !important;
    margin: 0 0 2pt !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .hoja .block-row[data-tipo='salto'] {
    height: 0 !important;
    overflow: hidden;
    break-after: page;
    page-break-after: always;
  }

  .hoja .block-row .salto-pagina,
  .hoja .block-row .lock-badge {
    display: none !important;
  }

  .hoja .rich-textarea:empty::before {
    content: none !important;
  }
}
</style>