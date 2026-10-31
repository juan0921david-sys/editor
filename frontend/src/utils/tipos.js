export const TIPOS = [
  { id: 'parrafo', etiqueta: 'Texto', descripcion: 'Párrafo normal', icono: 'T', claves: ['texto', 'parrafo', 'p'] },
  { id: 'h1', etiqueta: 'Título 1', descripcion: 'Encabezado grande', icono: 'H1', claves: ['titulo', 'h1', 'heading'] },
  { id: 'h2', etiqueta: 'Título 2', descripcion: 'Encabezado mediano', icono: 'H2', claves: ['titulo', 'h2', 'subtitulo'] },
  { id: 'h3', etiqueta: 'Título 3', descripcion: 'Encabezado pequeño', icono: 'H3', claves: ['titulo', 'h3'] },
  { id: 'lista', etiqueta: 'Lista', descripcion: 'Lista con viñetas', icono: '■', claves: ['lista', 'vineta', 'bullet', 'ul'] },
  { id: 'numerada', etiqueta: 'Lista numerada', descripcion: 'Elementos en orden', icono: '1.', claves: ['numerada', 'numero', 'ol'] },
  { id: 'tarea', etiqueta: 'Tarea', descripcion: 'Casilla por completar', icono: '[ ]', claves: ['tarea', 'check', 'todo', 'pendiente'] },
  { id: 'cita', etiqueta: 'Cita', descripcion: 'Texto destacado', icono: '"', claves: ['cita', 'quote'] },
  { id: 'codigo', etiqueta: 'Código', descripcion: 'Bloque monoespaciado', icono: '</>', claves: ['codigo', 'code'] },
  { id: 'divisor', etiqueta: 'Divisor', descripcion: 'Línea separadora', icono: '--', claves: ['divisor', 'linea', 'hr'] },
  { id: 'salto', etiqueta: 'Salto de página', descripcion: 'Empieza una página nueva', icono: 'PG', claves: ['salto', 'pagina', 'page', 'break'] }
]

export const TIPOS_CON_ENTER_BLOQUE = ['h1', 'h2', 'h3', 'lista', 'numerada', 'tarea']

export const TIPOS_SIN_TEXTO = ['divisor', 'salto']

const sinTildes = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export const tipoValido = (id) => TIPOS.some((t) => t.id === id)

export const normalizarTipo = (id, defecto = 'parrafo') => (tipoValido(id) ? id : defecto)

export const etiquetaDeTipo = (id) => (TIPOS.find((t) => t.id === id) || TIPOS[0]).etiqueta

export const filtrarTipos = (filtro) => {
  const f = sinTildes(filtro || '').trim()
  if (!f) return TIPOS
  return TIPOS.filter((t) => sinTildes(t.etiqueta).includes(f) || t.claves.some((c) => c.includes(f)))
}