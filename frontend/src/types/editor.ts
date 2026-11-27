export type TipoBloque = 'parrafo' | 'h1' | 'h2' | 'h3' | 'lista' | 'numerada' | 'tarea' | 'cita' | 'codigo' | 'divisor' | 'salto'

export interface Bloque {
  id: string
  contenido: string
  tipo: TipoBloque
  hecho: boolean
  bloqueadoPor: string | null
}

export interface Usuario {
  id: string
  uid: string
  nombre: string
  color: string
}

export interface PaginaConfig {
  tamano: 'carta' | 'a4' | 'oficio'
  orientacion: 'vertical' | 'horizontal'
  margen: 'normal' | 'estrecho' | 'amplio'
}

export type BloquePersistido = Omit<Bloque, 'bloqueadoPor'>
export interface CambioContenido { id: string; contenido: string }
export interface CambioTipo { index: number; tipo: TipoBloque }
export interface Movimiento { index: number; dir: number }
export interface DestinoArrastre { index: number; despues: boolean }
export interface Punto { x: number; y: number }
export interface PegadoBloques { index: number; lineas: string[] }
export type EstadoGuardado = 'guardado' | 'guardando' | 'error'
export interface Bloqueo { blockId: string; userId: string }
export interface EstadoInicial {
  titulo: string
  bloques: BloquePersistido[]
  bloqueos: Bloqueo[]
}
export type RespuestaContenido =
  | { ok: true }
  | { ok: false; motivo: 'sin_sala' | 'bloqueado' | 'inexistente' }

export interface EventosServidor {
  estado_inicial: (estado: EstadoInicial) => void
  presencia: (usuarios: Usuario[]) => void
  estado_guardado: (estado: EstadoGuardado) => void
  titulo_actualizado: (titulo: string) => void
  bloqueo_aprobado: (bloqueo: Bloqueo) => void
  bloqueo_rechazado: (bloqueo: Bloqueo & { contenido?: string }) => void
  bloque_liberado: (id: string) => void
  contenido_actualizado: (datos: { blockId: string; contenido: string }) => void
  estructura_actualizada: (bloques: BloquePersistido[]) => void
  error_servidor: () => void
}

export interface EventosCliente {
  unirse: (datos: { documentoId: string; uid: string; nombre: string; color: string }) => void
  cambiar_titulo: (titulo: string) => void
  solicitar_bloqueo: (id: string) => void
  liberar_bloqueo: (id: string) => void
  estructura_actualizada: (bloques: BloquePersistido[]) => void
  actualizar_contenido: (
    datos: { blockId: string; contenido: string },
    ack: (respuesta: RespuestaContenido) => void
  ) => void
}

