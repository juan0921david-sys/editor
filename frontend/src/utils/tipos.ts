import type { TipoBloque } from '../types/editor'

interface OpcionTipo {
  id: TipoBloque
  etiqueta: string
  descripcion: string
  icono: string
  claves: string[]
}

export const TIPOS: OpcionTipo[] = [
  {
    id: 'parrafo',
    etiqueta: 'Texto',
    descripcion: 'Párrafo normal',
    icono: 'T',
    claves: ['texto', 'parrafo', 'p']
  },
  {
    id: 'h1',
    etiqueta: 'Título 1',
    descripcion: 'Encabezado grande',
    icono: 'H1',
    claves: ['titulo', 'h1', 'heading']
  },
  {
    id: 'h2',
    etiqueta: 'Título 2',
    descripcion: 'Encabezado mediano',
    icono: 'H2',
    claves: ['titulo', 'h2', 'subtitulo']
  },
  {
    id: 'h3',
    etiqueta: 'Título 3',
    descripcion: 'Encabezado pequeño',
    icono: 'H3',
    claves: ['titulo', 'h3']
  },
  {
    id: 'lista',
    etiqueta: 'Lista',
    descripcion: 'Lista con viñetas',
    icono: '■',
    claves: ['lista', 'vineta', 'bullet', 'ul']
  },
  {
    id: 'numerada',
    etiqueta: 'Lista numerada',
    descripcion: 'Elementos en orden',
    icono: '1.',
    claves: ['numerada', 'numero', 'ol']
  },
  {
    id: 'tarea',
    etiqueta: 'Tarea',
    descripcion: 'Casilla por completar',
    icono: '[ ]',
    claves: ['tarea', 'check', 'todo', 'pendiente']
  },
  {
    id: 'cita',
    etiqueta: 'Cita',
    descripcion: 'Texto destacado',
    icono: '"',
    claves: ['cita', 'quote']
  },
  {
    id: 'codigo',
    etiqueta: 'Código',
    descripcion: 'Bloque monoespaciado',
    icono: '</>',
    claves: ['codigo', 'code']
  },
  {
    id: 'divisor',
    etiqueta: 'Divisor',
    descripcion: 'Línea separadora',
    icono: '--',
    claves: ['divisor', 'linea', 'hr']
  },
  {
    id: 'salto',
    etiqueta: 'Salto de página',
    descripcion: 'Empieza una página nueva',
    icono: 'PG',
    claves: ['salto', 'pagina', 'page', 'break']
  }
]

export const TIPOS_CON_ENTER_BLOQUE: TipoBloque[] = [
  'h1',
  'h2',
  'h3',
  'lista',
  'numerada',
  'tarea'
]

export const TIPOS_SIN_TEXTO: TipoBloque[] = [
  'divisor',
  'salto'
]

const sinTildes = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const tipoValido = (id: unknown): id is TipoBloque =>
  TIPOS.some((tipo) => tipo.id === id)

export const normalizarTipo = (
  id: unknown,
  defecto: TipoBloque = 'parrafo'
): TipoBloque => tipoValido(id) ? id : defecto

export const etiquetaDeTipo = (id: string): string =>
  (TIPOS.find((tipo) => tipo.id === id) || TIPOS[0]).etiqueta

export const filtrarTipos = (filtro: string): OpcionTipo[] => {
  const texto = sinTildes(filtro || '').trim()

  if (!texto) return TIPOS

  return TIPOS.filter(
    (tipo) =>
      sinTildes(tipo.etiqueta).includes(texto) ||
      tipo.claves.some((clave) => clave.includes(texto))
  )
}