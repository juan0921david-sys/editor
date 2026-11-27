export const FUENTES = [
  'IBM Plex Mono',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Press Start 2P',
  'VT323'
]

const ETIQUETAS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'STRIKE',
  'BR',
  'DIV',
  'P',
  'SPAN'
])

const PELIGROSAS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'LINK',
  'META',
  'TEMPLATE',
  'SVG',
  'MATH'
])

const ALINEACIONES = [
  'left',
  'center',
  'right',
  'justify'
]

const REGEX_COLOR =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)|transparent)$/i

export const nombreFuente = (
  valor: string | null | undefined
): string | null => {
  const primera = (valor || '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim()
    .toLowerCase()

  return FUENTES.find(
    (fuente) => fuente.toLowerCase() === primera
  ) || null
}

export const rgbAHex = (
  valor: string | null | undefined
): string | null => {
  if (!valor) return null

  if (valor.startsWith('#')) {
    if (valor.length === 4) {
      return `#${valor
        .slice(1)
        .split('')
        .map((caracter) => caracter + caracter)
        .join('')}`
    }

    return valor.slice(0, 7)
  }

  const coincidencia = valor.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
  )

  if (!coincidencia) return null

  return `#${[
    coincidencia[1],
    coincidencia[2],
    coincidencia[3]
  ]
    .map((numero) =>
      Math.min(255, Number(numero))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

const tamanoValido = (valor: string): boolean => {
  if (!/^\d{1,2}(\.\d+)?px$/.test(valor || '')) {
    return false
  }

  const px = parseFloat(valor)

  return px >= 8 && px <= 72
}

const aplicarEstilos = (el: HTMLElement): void => {
  const origen = el.style
  const alineacion = origen.textAlign
  const color = origen.color
  const fondo = origen.backgroundColor
  const fuente = nombreFuente(origen.fontFamily)
  const tamano = origen.fontSize

  Array.from(el.attributes).forEach((atributo) => {
    el.removeAttribute(atributo.name)
  })

  if (ALINEACIONES.includes(alineacion)) {
    el.style.textAlign = alineacion
  }

  if (color && REGEX_COLOR.test(color)) {
    el.style.color = color
  }

  if (fondo && REGEX_COLOR.test(fondo)) {
    el.style.backgroundColor = fondo
  }

  if (fuente) {
    el.style.fontFamily = `"${fuente}"`
  }

  if (tamanoValido(tamano)) {
    el.style.fontSize = tamano
  }
}

export const sanitizar = (html: string): string => {
  const plantilla = document.createElement('template')

  plantilla.innerHTML = html || ''

  const recorrer = (nodo: Node): void => {
    Array.from(nodo.childNodes).forEach((hijo) => {
      if (hijo.nodeType === 3) return

      if (!(hijo instanceof HTMLElement)) {
        hijo.remove()
        return
      }

      if (PELIGROSAS.has(hijo.tagName)) {
        hijo.remove()
        return
      }

      if (!ETIQUETAS.has(hijo.tagName)) {
        recorrer(hijo)
        hijo.replaceWith(...Array.from(hijo.childNodes))
        return
      }

      aplicarEstilos(hijo)
      recorrer(hijo)
    })
  }

  recorrer(plantilla.content)

  return plantilla.innerHTML
}