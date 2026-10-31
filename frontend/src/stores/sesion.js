import { reactive, watch } from 'vue'

export const COLORES = ['#B9A9E8', '#8B7BE0', '#6F6BD9', '#E8A9D6', '#7FE0C3', '#F2C66D']

export const TAMANOS_PAGINA = {
  carta: { etiqueta: 'CARTA', ancho: 816, alto: 1056, cm: [21.6, 27.9] },
  a4: { etiqueta: 'A4', ancho: 794, alto: 1123, cm: [21.0, 29.7] },
  oficio: { etiqueta: 'OFICIO', ancho: 816, alto: 1248, cm: [21.6, 33.0] }
}

export const MARGENES_PAGINA = {
  normal: { etiqueta: 'NORMAL', px: 96, cm: '2,54 cm' },
  estrecho: { etiqueta: 'ESTRECHO', px: 48, cm: '1,27 cm' },
  amplio: { etiqueta: 'AMPLIO', px: 144, cm: '3,81 cm' }
}

export const ESPACIO_ENTRE_PAGINAS = 32

const leer = (clave, defecto) => {
  try {
    const valor = localStorage.getItem(clave)
    return valor === null ? defecto : valor
  } catch {
    return defecto
  }
}

const escribir = (clave, valor) => {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    return
  }
}

export const generarId = (largo = 6) => {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(largo)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}

const documentoId =
  (new URLSearchParams(window.location.search).get('doc') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) ||
  'principal'

const uid = leer('editor-uid', '') || generarId(6)
escribir('editor-uid', uid)

const leerJugador = () => {
  try {
    const dato = JSON.parse(leer('editor-jugador', 'null'))
    return dato && typeof dato.nombre === 'string' ? dato : null
  } catch {
    return null
  }
}

const leerPagina = () => {
  try {
    const dato = JSON.parse(leer('editor-pagina', 'null'))
    if (!dato) return null
    return {
      tamano: TAMANOS_PAGINA[dato.tamano] ? dato.tamano : 'carta',
      orientacion: dato.orientacion === 'horizontal' ? 'horizontal' : 'vertical',
      margen: MARGENES_PAGINA[dato.margen] ? dato.margen : 'normal'
    }
  } catch {
    return null
  }
}

const guardado = leerJugador()
const prefiereOscuro = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)

export const sesion = reactive({
  listo: false,
  uid,
  nombre: guardado ? guardado.nombre : '',
  color: guardado && COLORES.includes(guardado.color) ? guardado.color : COLORES[0],
  miId: '',
  usuarios: [],
  documentoId,
  titulo: '',
  pagina: leerPagina() || { tamano: 'carta', orientacion: 'vertical', margen: 'normal' },
  sincronizado: false,
  guardado: 'guardado',
  activo: null,
  tema: leer('editor-tema', prefiereOscuro ? 'dark' : 'light'),
  crt: leer('editor-crt', 'on'),
  sonido: leer('editor-sonido', 'on') === 'on',
  zoom: Number(leer('editor-zoom', '100')) || 100,
  zen: false,
  aviso: ''
})

const aplicarAspecto = () => {
  document.documentElement.dataset.theme = sesion.tema
  document.documentElement.dataset.crt = sesion.crt
}

aplicarAspecto()

watch(
  () => sesion.zoom,
  (valor) => escribir('editor-zoom', String(valor))
)

let temporizadorAviso = null

export const avisar = (texto) => {
  sesion.aviso = texto
  clearTimeout(temporizadorAviso)
  temporizadorAviso = setTimeout(() => {
    sesion.aviso = ''
  }, 2400)
}

export const iniciarSesion = (nombre, color) => {
  sesion.nombre = nombre.trim().slice(0, 16)
  sesion.color = COLORES.includes(color) ? color : COLORES[0]
  escribir('editor-jugador', JSON.stringify({ nombre: sesion.nombre, color: sesion.color }))
  sesion.listo = true
}

export const cambiarJugador = () => {
  sesion.listo = false
  sesion.zen = false
  sesion.usuarios = []
  sesion.miId = ''
  sesion.activo = null
  sesion.sincronizado = false
  sesion.guardado = 'guardado'
}

export const configurarPagina = (cambios) => {
  const siguiente = { ...sesion.pagina, ...cambios }
  sesion.pagina.tamano = TAMANOS_PAGINA[siguiente.tamano] ? siguiente.tamano : 'carta'
  sesion.pagina.orientacion = siguiente.orientacion === 'horizontal' ? 'horizontal' : 'vertical'
  sesion.pagina.margen = MARGENES_PAGINA[siguiente.margen] ? siguiente.margen : 'normal'
  escribir('editor-pagina', JSON.stringify(sesion.pagina))
}

export const geometriaPagina = () => {
  const base = TAMANOS_PAGINA[sesion.pagina.tamano] || TAMANOS_PAGINA.carta
  const margen = (MARGENES_PAGINA[sesion.pagina.margen] || MARGENES_PAGINA.normal).px
  const horizontal = sesion.pagina.orientacion === 'horizontal'
  return {
    ancho: horizontal ? base.alto : base.ancho,
    alto: horizontal ? base.ancho : base.alto,
    margen
  }
}

export const dimensionesPagina = () => {
  const base = TAMANOS_PAGINA[sesion.pagina.tamano] || TAMANOS_PAGINA.carta
  const [a, b] = sesion.pagina.orientacion === 'horizontal' ? [base.cm[1], base.cm[0]] : base.cm
  return `${a.toFixed(1).replace('.', ',')} × ${b.toFixed(1).replace('.', ',')} cm`
}

export const alternarTema = () => {
  sesion.tema = sesion.tema === 'dark' ? 'light' : 'dark'
  escribir('editor-tema', sesion.tema)
  aplicarAspecto()
}

export const alternarCrt = () => {
  sesion.crt = sesion.crt === 'on' ? 'off' : 'on'
  escribir('editor-crt', sesion.crt)
  aplicarAspecto()
}

export const alternarSonido = () => {
  sesion.sonido = !sesion.sonido
  escribir('editor-sonido', sesion.sonido ? 'on' : 'off')
}

export const alternarZen = () => {
  sesion.zen = !sesion.zen
}

export const cambiarZoom = (delta) => {
  sesion.zoom = Math.min(160, Math.max(60, sesion.zoom + delta))
}

export const enlaceDocumento = () =>
  `${window.location.origin}${window.location.pathname}?doc=${sesion.documentoId}`

export const abrirDocumento = (id) => {
  window.location.search = `?doc=${id}`
}

export const crearDocumentoNuevo = () => abrirDocumento(generarId(8))

export const nombreDe = (id) => {
  if (!id) return ''
  const usuario = sesion.usuarios.find((u) => u.id === id)
  return usuario ? usuario.nombre : String(id).slice(0, 4).toUpperCase()
}

export const colorDe = (id) => {
  const usuario = id ? sesion.usuarios.find((u) => u.id === id) : null
  return usuario ? usuario.color : COLORES[0]
}