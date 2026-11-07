import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

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

export const useSesionStore = defineStore('sesion', () => {
  const uid = ref(leer('editor-uid', '') || generarId(6))
  escribir('editor-uid', uid.value)

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

  const guardadoDatos = leerJugador()
  const prefiereOscuro = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const listo = ref(false)
  const nombre = ref(guardadoDatos ? guardadoDatos.nombre : '')
  const color = ref(guardadoDatos && COLORES.includes(guardadoDatos.color) ? guardadoDatos.color : COLORES[0])
  const miId = ref('')
  const usuarios = ref([])
  const documentoId = ref((new URLSearchParams(window.location.search).get('doc') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'principal')
  const titulo = ref('')
  const pagina = ref(leerPagina() || { tamano: 'carta', orientacion: 'vertical', margen: 'normal' })
  const sincronizado = ref(false)
  const estadoGuardado = ref('guardado')
  const activo = ref(null)
  const tema = ref(leer('editor-tema', prefiereOscuro ? 'dark' : 'light'))
  const crt = ref(leer('editor-crt', 'on'))
  const sonido = ref(leer('editor-sonido', 'on') === 'on')
  const zoom = ref(Number(leer('editor-zoom', '100')) || 100)
  const zen = ref(false)
  const aviso = ref('')

  let temporizadorAviso = null

  const aplicarAspecto = () => {
    document.documentElement.dataset.theme = tema.value
    document.documentElement.dataset.crt = crt.value
  }

  aplicarAspecto()

  watch(zoom, (valor) => escribir('editor-zoom', String(valor)))

  const mostrarAviso = (texto) => {
    aviso.value = texto
    clearTimeout(temporizadorAviso)
    temporizadorAviso = setTimeout(() => {
      aviso.value = ''
    }, 2400)
  }

  const iniciarSesion = (n, c) => {
    nombre.value = n.trim().slice(0, 16)
    color.value = COLORES.includes(c) ? c : COLORES[0]
    escribir('editor-jugador', JSON.stringify({ nombre: nombre.value, color: color.value }))
    listo.value = true
  }

  const cambiarJugador = () => {
    listo.value = false
    zen.value = false
    usuarios.value = []
    miId.value = ''
    activo.value = null
    sincronizado.value = false
    estadoGuardado.value = 'guardado'
  }

  const configurarPagina = (cambios) => {
    const siguiente = { ...pagina.value, ...cambios }
    pagina.value.tamano = TAMANOS_PAGINA[siguiente.tamano] ? siguiente.tamano : 'carta'
    pagina.value.orientacion = siguiente.orientacion === 'horizontal' ? 'horizontal' : 'vertical'
    pagina.value.margen = MARGENES_PAGINA[siguiente.margen] ? siguiente.margen : 'normal'
    escribir('editor-pagina', JSON.stringify(pagina.value))
  }

  const geometriaPagina = () => {
    const base = TAMANOS_PAGINA[pagina.value.tamano] || TAMANOS_PAGINA.carta
    const margenVal = (MARGENES_PAGINA[pagina.value.margen] || MARGENES_PAGINA.normal).px
    const horizontal = pagina.value.orientacion === 'horizontal'
    return {
      ancho: horizontal ? base.alto : base.ancho,
      alto: horizontal ? base.ancho : base.alto,
      margen: margenVal
    }
  }

  const dimensionesPagina = () => {
    const base = TAMANOS_PAGINA[pagina.value.tamano] || TAMANOS_PAGINA.carta
    const [a, b] = pagina.value.orientacion === 'horizontal' ? [base.cm[1], base.cm[0]] : base.cm
    return `${a.toFixed(1).replace('.', ',')} × ${b.toFixed(1).replace('.', ',')} cm`
  }

  const alternarTema = () => {
    tema.value = tema.value === 'dark' ? 'light' : 'dark'
    escribir('editor-tema', tema.value)
    aplicarAspecto()
  }

  const alternarCrt = () => {
    crt.value = crt.value === 'on' ? 'off' : 'on'
    escribir('editor-crt', crt.value)
    aplicarAspecto()
  }

  const alternarSonido = () => {
    sonido.value = !sonido.value
    escribir('editor-sonido', sonido.value ? 'on' : 'off')
  }

  const alternarZen = () => {
    zen.value = !zen.value
  }

  const cambiarZoom = (delta) => {
    zoom.value = Math.min(160, Math.max(60, zoom.value + delta))
  }

  const enlaceDocumento = () => `${window.location.origin}${window.location.pathname}?doc=${documentoId.value}`

  const abrirDocumento = (id) => {
    window.location.search = `?doc=${id}`
  }

  const crearDocumentoNuevo = () => abrirDocumento(generarId(8))

  const nombreDe = (id) => {
    if (!id) return ''
    const usuario = usuarios.value.find((u) => u.id === id)
    return usuario ? usuario.nombre : String(id).slice(0, 4).toUpperCase()
  }

  const colorDe = (id) => {
    const usuario = id ? usuarios.value.find((u) => u.id === id) : null
    return usuario ? usuario.color : COLORES[0]
  }

  return {
    uid,
    listo,
    nombre,
    color,
    miId,
    usuarios,
    documentoId,
    titulo,
    pagina,
    sincronizado,
    estadoGuardado,
    activo,
    tema,
    crt,
    sonido,
    zoom,
    zen,
    aviso,
    mostrarAviso,
    iniciarSesion,
    cambiarJugador,
    configurarPagina,
    geometriaPagina,
    dimensionesPagina,
    alternarTema,
    alternarCrt,
    alternarSonido,
    alternarZen,
    cambiarZoom,
    enlaceDocumento,
    abrirDocumento,
    crearDocumentoNuevo,
    nombreDe,
    colorDe
  }
})