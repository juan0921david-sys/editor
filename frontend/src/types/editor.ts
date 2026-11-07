export type TipoBloque = 'parrafo' | 'titulo1' | 'titulo2' | 'titulo3' | 'lista' | 'numerada' | 'tarea' | 'cita' | 'codigo' | 'divisor' | 'salto'

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