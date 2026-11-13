import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Usuario, PaginaConfig } from '../types/editor'

export const COLORES: string[] = ['#B9A9E8', '#8B7BE0', '#6F6BD9', '#E8A9D6', '#7FE0C3', '#F2C66D']

export const TAMANOS_PAGINA: Record<string, { etiqueta: string; ancho: number; alto: number; cm: [number, number] }> = {
  carta: { etiqueta: 'CARTA', ancho: 816, alto: 1056, cm: [21.6, 27.9] },
  a4: { etiqueta: 'A4', ancho: 794, alto: 1123, cm: [21.0, 29.7] },
  oficio: { etiqueta: 'OFICIO', ancho: 816, alto: 1248, cm: [21.6, 33.0] }
}

export const MARGENES_PAGINA: Record<string, { etiqueta: string; px: number; cm: string }> = {
  normal: { etiqueta: 'NORMAL', px: 96, cm: '2,54 cm' },
  estrecho: { etiqueta: 'ESTRECHO', px: 48, cm: '1,27 cm' },
  amplio: { etiqueta: 'AMPLIO', px: 144, cm: '3,81 cm' }
}

export const ESPACIO_ENTRE_PAGINAS = 32

const leer = (clave: string, defecto: string): string => {
  try {
    const valor = localStorage.getItem(clave)
    return valor === null ? defecto : valor
  } catch {
    return defecto
  }
}

const escribir = (clave: string, valor: string): void => {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    return
  }
}

export const generarId = (largo: number = 6): string => {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(largo)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}

export const useSesionStore = defineStore('sesion', () => {
  const uid = ref<string>(leer('editor-uid', '') || generarId(6))
  escribir('editor-uid', uid.value)

  const accessToken = ref<string>('')

  const leerJugador = (): { nombre: string; color: string } | null => {
    try {
      const dato = JSON.parse(leer('editor-jugador', 'null'))
      return dato && typeof dato.nombre === 'string' ? dato : null
    } catch {
      return null
    }
  }

  const leerPagina = (): PaginaConfig | null => {
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

  const listo = ref<boolean>(!!guardadoDatos && guardadoDatos.nombre.trim().length >= 2)  const nombre = ref<string>(guardadoDatos ? guardadoDatos.nombre : '')
  const color = ref<string>(guardadoDatos && COLORES.includes(guardadoDatos.color) ? guardadoDatos.color : COLORES[0])
  const miId = ref<string>('')
  const usuarios = ref<Usuario[]>([])
  const documentoId = ref<string>((new URLSearchParams(window.location.search).get('doc') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'principal')
  const titulo = ref<string>('')
  const pagina = ref<PaginaConfig>(leerPagina() || { tamano: 'carta', orientacion: 'vertical', margen: 'normal' })
  const sincronizado = ref<boolean>(false)
  const estadoGuardado = ref<'guardado' | 'guardando' | 'error'>('guardado')
  const activo = ref<{ id: string; tipo: string } | null>(null)
  const tema = ref<string>(leer('editor-tema', prefiereOscuro ? 'dark' : 'light'))
  const crt = ref<string>(leer('editor-crt', 'on'))
  const sonido = ref<boolean>(leer('editor-sonido', 'on') === 'on')
  const zoom = ref<number>(Number(leer('editor-zoom', '100')) || 100)
  const zen = ref<boolean>(false)
  const aviso = ref<string>('')

  let temporizadorAviso: ReturnType<typeof setTimeout> | null = null

  const aplicarAspecto = (): void => {
    document.documentElement.dataset.theme = tema.value
    document.documentElement.dataset.crt = crt.value
  }

  aplicarAspecto()

  watch(zoom, (valor) => escribir('editor-zoom', String(valor)))

  const mostrarAviso = (texto: string): void => {
    aviso.value = texto
    if (temporizadorAviso) clearTimeout(temporizadorAviso)
    temporizadorAviso = setTimeout(() => {
      aviso.value = ''
    }, 2400)
  }

  const iniciarSesion = async (n: string, c: string): Promise<void> => {
    nombre.value = n.trim().slice(0, 16)
    color.value = COLORES.includes(c) ? c : COLORES[0]
    try {
      const apiHost = import.meta.env.VITE_API_URL || import.meta.env.VITE_URL_SERVIDOR || 'http://localhost:3000'
      const respuesta = await fetch(`${apiHost}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.value, uid: uid.value }),
        credentials: 'include'
      })
      if (respuesta.ok) {
        const datos = await respuesta.json()
        accessToken.value = datos.accessToken || ''
      }
    } catch {
      // Modo de sesion local resiliente
    }
    escribir('editor-jugador', JSON.stringify({ nombre: nombre.value, color: color.value }))
    listo.value = true
  }

  const cambiarJugador = (): void => {
    listo.value = false
    zen.value = false
    usuarios.value = []
    miId.value = ''
    activo.value = null
    sincronizado.value = false
    estadoGuardado.value = 'guardado'
    accessToken.value = ''
  }

  const configurarPagina = (cambios: Partial<PaginaConfig>): void => {
    const siguiente = { ...pagina.value, ...cambios }
    pagina.value.tamano = TAMANOS_PAGINA[siguiente.tamano!] ? siguiente.tamano! : 'carta'
    pagina.value.orientacion = siguiente.orientacion === 'horizontal' ? 'horizontal' : 'vertical'
    pagina.value.margen = MARGENES_PAGINA[siguiente.margen!] ? siguiente.margen! : 'normal'
    escribir('editor-pagina', JSON.stringify(pagina.value))
  }

  const geometriaPagina = (): { ancho: number; alto: number; margen: number } => {
    const base = TAMANOS_PAGINA[pagina.value.tamano] || TAMANOS_PAGINA.carta
    const margenVal = (MARGENES_PAGINA[pagina.value.margen] || MARGENES_PAGINA.normal).px
    const horizontal = pagina.value.orientacion === 'horizontal'
    return {
      ancho: horizontal ? base.alto : base.ancho,
      alto: horizontal ? base.ancho : base.alto,
      margen: margenVal
    }
  }

  const dimensionesPagina = (): string => {
    const base = TAMANOS_PAGINA[pagina.value.tamano] || TAMANOS_PAGINA.carta
    const [a, b] = pagina.value.orientacion === 'horizontal' ? [base.cm[1], base.cm[0]] : base.cm
    return `${a.toFixed(1).replace('.', ',')} × ${b.toFixed(1).replace('.', ',')} cm`
  }

  const alternarTema = (): void => {
    tema.value = tema.value === 'dark' ? 'light' : 'dark'
    escribir('editor-tema', tema.value)
    aplicarAspecto()
  }

  const alternarCrt = (): void => {
    crt.value = crt.value === 'on' ? 'off' : 'on'
    escribir('editor-crt', crt.value)
    aplicarAspecto()
  }

  const alternarSonido = (): void => {
    sonido.value = !sonido.value
    escribir('editor-sonido', sonido.value ? 'on' : 'off')
  }

  const alternarZen = (): void => {
    zen.value = !zen.value
  }

  const cambiarZoom = (delta: number): void => {
    zoom.value = Math.min(160, Math.max(60, zoom.value + delta))
  }

  const enlaceDocumento = (): string => `${window.location.origin}${window.location.pathname}?doc=${documentoId.value}`

  const abrirDocumento = (id: string): void => {
    window.location.search = `?doc=${id}`
  }

  const crearDocumentoNuevo = (): void => abrirDocumento(generarId(8))

  const nombreDe = (id: string | null): string => {
    if (!id) return ''
    const usuario = usuarios.value.find((u) => u.id === id)
    return usuario ? usuario.nombre : String(id).slice(0, 4).toUpperCase()
  }

  const colorDe = (id: string | null): string => {
    const usuario = id ? usuarios.value.find((u) => u.id === id) : null
    return usuario ? usuario.color : COLORES[0]
  }

  return {
    uid,
    accessToken,
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
