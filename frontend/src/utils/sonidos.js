import { sesion } from '../stores/sesion'

let contexto = null

const obtener = () => {
  if (!contexto) {
    const Clase = window.AudioContext || window.webkitAudioContext
    if (!Clase) return null
    contexto = new Clase()
  }
  if (contexto.state === 'suspended') contexto.resume()
  return contexto
}

const tono = (frecuencia, duracion, opciones = {}) => {
  const { tipo = 'square', volumen = 0.035, inicio = 0, hasta = null } = opciones
  const ctx = obtener()
  if (!ctx) return
  const t0 = ctx.currentTime + inicio
  const osc = ctx.createOscillator()
  const ganancia = ctx.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(frecuencia, t0)
  if (hasta) osc.frequency.exponentialRampToValueAtTime(hasta, t0 + duracion)
  ganancia.gain.setValueAtTime(volumen, t0)
  ganancia.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion)
  osc.connect(ganancia)
  ganancia.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duracion + 0.03)
}

const reproducir = (secuencia) => () => {
  if (sesion.sonido) secuencia()
}

export const sonidos = {
  clic: reproducir(() => tono(720, 0.04)),
  agregar: reproducir(() => {
    tono(523, 0.05)
    tono(784, 0.07, { inicio: 0.05 })
  }),
  eliminar: reproducir(() => tono(330, 0.1, { hasta: 150 })),
  mover: reproducir(() => {
    tono(440, 0.04)
    tono(587, 0.05, { inicio: 0.04 })
  }),
  error: reproducir(() => tono(150, 0.2, { tipo: 'sawtooth', hasta: 80, volumen: 0.05 })),
  entrar: reproducir(() => {
    tono(523, 0.07)
    tono(659, 0.07, { inicio: 0.07 })
    tono(784, 0.09, { inicio: 0.14 })
  }),
  salir: reproducir(() => {
    tono(784, 0.07)
    tono(523, 0.09, { inicio: 0.07 })
  }),
  inicio: reproducir(() => {
    tono(392, 0.09)
    tono(523, 0.09, { inicio: 0.08 })
    tono(659, 0.09, { inicio: 0.16 })
    tono(784, 0.16, { inicio: 0.24 })
  })
}