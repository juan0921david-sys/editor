import { rgbAHex, nombreFuente } from './sanitizar'

import type {
  BloquePersistido,
  PaginaConfig,
  TipoBloque
} from '../types/editor'

import type {
  Alignment,
  CanvasElement,
  Content,
  ContentCanvas,
  ContentColumns,
  ContentTable,
  ContentStack,
  ContentText,
  Decoration,
  PageSize,
  Style,
  TDocumentDefinitions
} from 'pdfmake/interfaces'

import type {
  IParagraphOptions,
  IRunOptions,
  Paragraph
} from 'docx'

export type FormatoExportacion =
  | 'txt'
  | 'md'
  | 'html'
  | 'pdf'
  | 'docx'

export interface DatosExportacion {
  titulo: string
  autor?: string
  pagina: PaginaConfig
  bloques: BloquePersistido[]
}

interface EstiloTexto {
  negrita?: boolean
  cursiva?: boolean
  subrayado?: boolean
  tachado?: boolean
  color?: string
  fondo?: string
  fuente?: string
  tamano?: number
}

type Run =
  | (EstiloTexto & {
    texto: string
    salto?: false
  })
  | {
    salto: true
  }

interface Parrafo {
  alineacion: Alignment | null
  runs: Run[]
}

interface BloqueExportacion {
  tipo: TipoBloque
  hecho: boolean
  numero: number
  parrafos: Parrafo[]
  texto: string
}

const normalizarAlineacion = (
  valor: string | null
): Alignment =>
  valor === 'center' ||
    valor === 'right' ||
    valor === 'justify'
    ? valor
    : 'left'

const TIPOS_LISTA = ['lista', 'numerada', 'tarea']

const FUENTES_DOCX: Record<string, string> = {
  'IBM Plex Mono': 'Consolas',
  'Press Start 2P': 'Courier New',
  VT323: 'Courier New'
}

const PAGINAS: Record<
  PaginaConfig['tamano'],
  {
    pdf: PageSize
    pt: [number, number]
    twips: [number, number]
  }
> = {
  carta: {
    pdf: 'LETTER',
    pt: [612, 792],
    twips: [12240, 15840]
  },
  a4: {
    pdf: 'A4',
    pt: [595, 842],
    twips: [11906, 16838]
  },
  oficio: {
    pdf: {
      width: 612,
      height: 936
    },
    pt: [612, 936],
    twips: [12240, 18720]
  }
}

const MARGENES = {
  normal: {
    pt: 72,
    twips: 1440
  },
  estrecho: {
    pt: 36,
    twips: 720
  },
  amplio: {
    pt: 108,
    twips: 2160
  }
}

const configuracionPagina = (pagina: PaginaConfig) => {
  const tamano =
    pagina && PAGINAS[pagina.tamano]
      ? pagina.tamano
      : 'carta'

  const margen =
    pagina && MARGENES[pagina.margen]
      ? pagina.margen
      : 'normal'

  const horizontal =
    !!pagina && pagina.orientacion === 'horizontal'

  const base = PAGINAS[tamano]

  const anchoPt = horizontal
    ? base.pt[1]
    : base.pt[0]

  return {
    ...base,
    margen: MARGENES[margen],
    horizontal,
    anchoUtilPt: anchoPt - 2 * MARGENES[margen].pt
  }
}

const escaparHtml = (texto: string): string =>
  String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const nombreArchivo = (titulo: string): string =>
  (titulo || 'documento')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .slice(0, 80) || 'documento'

const descargar = (blob: Blob, nombre: string): void => {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')

  enlace.href = url
  enlace.download = nombre

  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()

  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const estiloDe = (
  el: HTMLElement,
  base: EstiloTexto
): EstiloTexto => {
  const nuevo = { ...base }
  const etiqueta = el.tagName

  if (etiqueta === 'B' || etiqueta === 'STRONG') {
    nuevo.negrita = true
  }

  if (etiqueta === 'I' || etiqueta === 'EM') {
    nuevo.cursiva = true
  }

  if (etiqueta === 'U') {
    nuevo.subrayado = true
  }

  if (etiqueta === 'S' || etiqueta === 'STRIKE') {
    nuevo.tachado = true
  }

  const estilo = el.style

  if (estilo) {
    const color = rgbAHex(estilo.color)
    const fondo = rgbAHex(estilo.backgroundColor)
    const fuente = nombreFuente(estilo.fontFamily)
    const px = parseFloat(estilo.fontSize)

    if (color) nuevo.color = color
    if (fondo) nuevo.fondo = fondo
    if (fuente) nuevo.fuente = fuente
    if (px) nuevo.tamano = px
  }

  return nuevo
}

const htmlAParrafos = (html: string): Parrafo[] => {
  const plantilla = document.createElement('template')

  plantilla.innerHTML = html || ''

  const parrafos: Parrafo[] = []
  let actual: Parrafo | null = null

  const abrir = (
    alineacion: Alignment | null
  ): Parrafo => {
    actual = {
      alineacion,
      runs: []
    }

    return actual
  }

  const cerrar = (): void => {
    if (actual) parrafos.push(actual)
    actual = null
  }

  const recorrer = (
    nodo: Node,
    estilo: EstiloTexto,
    alineacion: Alignment | null
  ): void => {
    nodo.childNodes.forEach((hijo) => {
      if (hijo.nodeType === 3) {
        const texto = (hijo.textContent || '')
          .replace(/\u00a0/g, ' ')

        if (!texto) return

        const parrafo = actual || abrir(alineacion)

        parrafo.runs.push({
          ...estilo,
          texto
        })

        return
      }

      if (!(hijo instanceof HTMLElement)) return

      const etiqueta = hijo.tagName

      if (etiqueta === 'BR') {
        const parrafo = actual || abrir(alineacion)

        parrafo.runs.push({
          salto: true
        })

        return
      }

      if (etiqueta === 'DIV' || etiqueta === 'P') {
        cerrar()

        const alin = hijo.style.textAlign
          ? normalizarAlineacion(hijo.style.textAlign)
          : alineacion

        abrir(alin)
        recorrer(hijo, estilo, alin)
        cerrar()

        return
      }

      recorrer(
        hijo,
        estiloDe(hijo, estilo),
        alineacion
      )
    })
  }

  recorrer(plantilla.content, {}, null)
  cerrar()

  return parrafos.map((parrafo) => {
    const runs = parrafo.runs.slice()

    if (runs.length && runs[runs.length - 1].salto) {
      runs.pop()
    }

    return {
      alineacion: parrafo.alineacion,
      runs
    }
  })
}

const runsATexto = (runs: Run[]): string =>
  runs
    .map((run) => run.salto ? '\n' : run.texto)
    .join('')

export const textoPlano = (html: string): string =>
  htmlAParrafos(html)
    .map((parrafo) => runsATexto(parrafo.runs))
    .join('\n')

const construirModelo = (
  bloques: BloquePersistido[]
): BloqueExportacion[] => {
  let numero = 0

  return bloques.map((bloque) => {
    numero = bloque.tipo === 'numerada'
      ? numero + 1
      : 0

    const parrafos = htmlAParrafos(bloque.contenido)

    return {
      tipo: bloque.tipo,
      hecho: !!bloque.hecho,
      numero,
      parrafos,
      texto: parrafos
        .map((parrafo) => runsATexto(parrafo.runs))
        .join('\n')
    }
  })
}

const unirBloques = (
  modelo: BloqueExportacion[],
  lineas: string[]
): string =>
  lineas.reduce((acumulado, linea, indice) => {
    if (indice === 0) return linea

    const mismaLista =
      TIPOS_LISTA.includes(modelo[indice].tipo) &&
      modelo[indice].tipo === modelo[indice - 1].tipo

    return `${acumulado}${mismaLista ? '\n' : '\n\n'}${linea}`
  }, '')

// --------------------------------------------------
// Exportación TXT
// --------------------------------------------------

const aTxt = (datos: DatosExportacion): string => {
  const modelo = construirModelo(datos.bloques)
    .filter((bloque) => bloque.tipo !== 'salto')

  const lineas = modelo.map((bloque) => {
    switch (bloque.tipo) {
      case 'lista':
        return `• ${bloque.texto}`

      case 'numerada':
        return `${bloque.numero}. ${bloque.texto}`

      case 'tarea':
        return `[${bloque.hecho ? 'x' : ' '}] ${bloque.texto}`

      case 'cita':
        return bloque.texto
          .split('\n')
          .map((linea) => `> ${linea}`)
          .join('\n')

      case 'codigo':
        return bloque.texto
          .split('\n')
          .map((linea) => `    ${linea}`)
          .join('\n')

      case 'divisor':
        return '----------------------------------------'

      default:
        return bloque.texto
    }
  })

  return `${unirBloques(modelo, lineas)}\n`
}

// --------------------------------------------------
// Exportación Markdown
// --------------------------------------------------

const runMd = (run: Run): string => {
  if (run.salto) return '  \n'

  const partes = run.texto.match(/^(\s*)([\s\S]*?)(\s*)$/)

  if (!partes) return run.texto

  let nucleo = partes[2]

  if (!nucleo) return run.texto

  if (run.tachado) nucleo = `~~${nucleo}~~`
  if (run.subrayado) nucleo = `<u>${nucleo}</u>`
  if (run.cursiva) nucleo = `*${nucleo}*`
  if (run.negrita) nucleo = `**${nucleo}**`

  return `${partes[1]}${nucleo}${partes[3]}`
}

const SALTO_HTML =
  '<div style="break-after:page;page-break-after:always"></div>'

const aMd = (datos: DatosExportacion): string => {
  const modelo = construirModelo(datos.bloques)

  const lineas = modelo.map((bloque) => {
    const texto = bloque.parrafos
      .map((parrafo) => parrafo.runs.map(runMd).join(''))
      .join('  \n')

    switch (bloque.tipo) {
      case 'h1':
        return `# ${texto}`

      case 'h2':
        return `## ${texto}`

      case 'h3':
        return `### ${texto}`

      case 'lista':
        return `- ${texto}`

      case 'numerada':
        return `${bloque.numero}. ${texto}`

      case 'tarea':
        return `- [${bloque.hecho ? 'x' : ' '}] ${texto}`

      case 'cita':
        return texto
          .split('\n')
          .map((linea) => `> ${linea}`)
          .join('\n')

      case 'codigo':
        return `\`\`\`\n${bloque.texto}\n\`\`\``

      case 'divisor':
        return '---'

      case 'salto':
        return SALTO_HTML

      default:
        return texto
    }
  })

  return `${unirBloques(modelo, lineas)}\n`
}

// --------------------------------------------------
// Exportación HTML
// --------------------------------------------------

const runHtml = (run: Run): string => {
  if (run.salto) return '<br>'

  let texto = escaparHtml(run.texto)
  const estilo: string[] = []

  if (run.color) {
    estilo.push(`color:${run.color}`)
  }

  if (run.fondo) {
    estilo.push(`background:${run.fondo}`)
  }

  if (run.fuente) {
    estilo.push(`font-family:'${run.fuente}'`)
  }

  if (run.tamano) {
    estilo.push(`font-size:${run.tamano}px`)
  }

  if (estilo.length) {
    texto = `<span style="${estilo.join(';')}">${texto}</span>`
  }

  if (run.tachado) texto = `<s>${texto}</s>`
  if (run.subrayado) texto = `<u>${texto}</u>`
  if (run.cursiva) texto = `<em>${texto}</em>`
  if (run.negrita) texto = `<strong>${texto}</strong>`

  return texto
}

const parrafoHtml = (parrafo: Parrafo): string =>
  `<div${parrafo.alineacion ? ` style="text-align:${parrafo.alineacion}"` : ''}>${parrafo.runs.map(runHtml).join('') || '<br>'}</div>`

const aHtml = (datos: DatosExportacion): string => {
  const modelo = construirModelo(datos.bloques)

  const cuerpo = modelo
    .map((bloque) => {
      const interior =
        bloque.parrafos.map(parrafoHtml).join('') || '<br>'

      switch (bloque.tipo) {
        case 'h1':
          return `<h1>${interior}</h1>`

        case 'h2':
          return `<h2>${interior}</h2>`

        case 'h3':
          return `<h3>${interior}</h3>`

        case 'lista':
          return `<div class="item"><span class="marca">&#9679;</span><div>${interior}</div></div>`

        case 'numerada':
          return `<div class="item"><span class="marca">${bloque.numero}.</span><div>${interior}</div></div>`

        case 'tarea':
          return `<div class="item${bloque.hecho ? ' hecho' : ''}"><span class="marca">${bloque.hecho ? '&#9745;' : '&#9744;'}</span><div>${interior}</div></div>`

        case 'cita':
          return `<blockquote>${interior}</blockquote>`

        case 'codigo':
          return `<pre>${escaparHtml(bloque.texto)}</pre>`

        case 'divisor':
          return '<hr>'

        case 'salto':
          return SALTO_HTML

        default:
          return `<div class="bloque">${interior}</div>`
      }
    })
    .join('\n')

  const titulo = escaparHtml(datos.titulo || 'Documento')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>
body{font-family:Georgia,serif;max-width:820px;margin:48px auto;padding:0 24px;line-height:1.7;color:#000}
h1,h2,h3{line-height:1.3}
.bloque{margin-bottom:10px}
.item{display:flex;gap:10px;margin-bottom:4px}
.marca{min-width:22px}
.hecho{opacity:.6;text-decoration:line-through}
blockquote{margin:14px 0;padding:4px 16px;border-left:4px solid #999;font-style:italic}
pre{background:#f3f3f3;border:1px solid #ccc;padding:14px;overflow:auto;font-family:Consolas,monospace}
hr{border:0;border-top:1px solid #999;margin:24px 0}
</style>
</head>
<body>
${cuerpo}
</body>
</html>`
}

// --------------------------------------------------
// Exportación PDF — pdfmake 0.3
// --------------------------------------------------

const aPdf = async (
  datos: DatosExportacion
): Promise<Blob> => {
  const [modPdf, modFuentes] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts')
  ])

  const pdfMake = modPdf.default

  pdfMake.addVirtualFileSystem(modFuentes.default)

  const pagina = configuracionPagina(datos.pagina)
  const modelo = construirModelo(datos.bloques)

  const runPdf = (run: Run): ContentText => {
    if (run.salto) return { text: '\n' }

    const resultado: ContentText = {
      text: run.texto
    }

    if (run.negrita) resultado.bold = true
    if (run.cursiva) resultado.italics = true

    const decoracion: Decoration[] = []

    if (run.subrayado) {
      decoracion.push('underline')
    }

    if (run.tachado) {
      decoracion.push('lineThrough')
    }

    if (decoracion.length) {
      resultado.decoration =
        decoracion.length === 1
          ? decoracion[0]
          : decoracion
    }

    if (run.color) {
      resultado.color = run.color
    }

    if (run.fondo) {
      resultado.background = run.fondo
    }

    if (run.tamano) {
      resultado.fontSize =
        Math.round((run.tamano / 16) * 11 * 10) / 10
    }

    return resultado
  }

  const lineasDe = (
    bloque: BloqueExportacion
  ): Parrafo[] =>
    bloque.parrafos.length
      ? bloque.parrafos
      : [{ alineacion: null, runs: [] }]

  const cuerpo = (
    bloque: BloqueExportacion,
    extra: Style = {}
  ): ContentStack => ({
    stack: lineasDe(bloque).map((parrafo) => ({
      text: parrafo.runs.length
        ? parrafo.runs.map(runPdf)
        : ' ',
      alignment: parrafo.alineacion || 'left',
      ...extra
    }))
  })

  const casilla = (
    hecho: boolean
  ): ContentCanvas & { width: number } => {
    const trazos: CanvasElement[] = [
      {
        type: 'rect',
        x: 0,
        y: 2,
        w: 10,
        h: 10,
        lineWidth: 1.2,
        lineColor: '#000000'
      }
    ]

    if (hecho) {
      trazos.push({
        type: 'line',
        x1: 2,
        y1: 7,
        x2: 4.5,
        y2: 10,
        lineWidth: 1.6,
        lineColor: '#000000'
      })

      trazos.push({
        type: 'line',
        x1: 4.5,
        y1: 10,
        x2: 9,
        y2: 3.5,
        lineWidth: 1.6,
        lineColor: '#000000'
      })
    }

    return {
      width: 18,
      canvas: trazos
    }
  }

  const bloquePdf = (
    bloque: BloqueExportacion
  ): ContentStack | ContentColumns | ContentTable | ContentCanvas => {
    switch (bloque.tipo) {
      case 'h1':
        return {
          ...cuerpo(bloque, {
            fontSize: 20,
            bold: true
          }),
          margin: [0, 14, 0, 6]
        }

      case 'h2':
        return {
          ...cuerpo(bloque, {
            fontSize: 16,
            bold: true
          }),
          margin: [0, 10, 0, 5]
        }

      case 'h3':
        return {
          ...cuerpo(bloque, {
            fontSize: 13,
            bold: true
          }),
          margin: [0, 8, 0, 4]
        }

      case 'lista':
        return {
          columns: [
            {
              width: 16,
              text: '•'
            },
            {
              width: '*',
              ...cuerpo(bloque)
            }
          ],
          margin: [8, 0, 0, 3]
        }

      case 'numerada':
        return {
          columns: [
            {
              width: 24,
              text: `${bloque.numero}.`
            },
            {
              width: '*',
              ...cuerpo(bloque)
            }
          ],
          margin: [8, 0, 0, 3]
        }

      case 'tarea':
        return {
          columns: [
            casilla(bloque.hecho),
            {
              width: '*',
              ...cuerpo(
                bloque,
                bloque.hecho
                  ? {
                    color: '#777777',
                    decoration: 'lineThrough'
                  }
                  : {}
              )
            }
          ],
          margin: [8, 0, 0, 3]
        }

      case 'cita':
        return {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  ...cuerpo(bloque, {
                    italics: true
                  }),
                  margin: [10, 3, 5, 3]
                }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: (indice) =>
              indice === 0 ? 3 : 0,
            vLineColor: () => '#999999'
          },
          margin: [0, 6, 0, 8]
        }

      case 'codigo':
        return {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  text: bloque.texto || ' ',
                  fontSize: 9.5,
                  preserveLeadingSpaces: true,
                  margin: [8, 6, 8, 6]
                }
              ]
            ]
          },
          layout: {
            hLineWidth: () => 0.7,
            vLineWidth: () => 0.7,
            hLineColor: () => '#CCCCCC',
            vLineColor: () => '#CCCCCC',
            fillColor: () => '#F3F3F3'
          },
          margin: [0, 6, 0, 8]
        }

      case 'divisor':
        return {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: pagina.anchoUtilPt,
              y2: 0,
              lineWidth: 0.8,
              lineColor: '#999999'
            }
          ],
          margin: [0, 10, 0, 10]
        }

      default:
        return {
          ...cuerpo(bloque),
          margin: [0, 0, 0, 6]
        }
    }
  }

  const contenido: Content[] = []
  let saltoPendiente = false

  modelo.forEach((bloque) => {
    if (bloque.tipo === 'salto') {
      saltoPendiente = true
      return
    }

    const nodo = bloquePdf(bloque)

    if (saltoPendiente) {
      nodo.pageBreak = 'before'
      saltoPendiente = false
    }

    contenido.push(nodo)
  })

  const margen = pagina.margen.pt

  const definicion: TDocumentDefinitions = {
    pageSize: pagina.pdf,
    pageOrientation: pagina.horizontal
      ? 'landscape'
      : 'portrait',
    pageMargins: [
      margen,
      margen,
      margen,
      margen
    ],
    info: {
      title: datos.titulo || 'Documento',
      ...(datos.autor
        ? { author: datos.autor }
        : {})
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11,
      lineHeight: 1.35,
      color: '#000000'
    },
    content: contenido.length
      ? contenido
      : [{ text: ' ' }]
  }

  const archivo = pdfMake.createPdf(definicion)

  return archivo.getBlob()
}

// --------------------------------------------------
// Exportación DOCX
// --------------------------------------------------

const aDocx = async (
  datos: DatosExportacion
): Promise<Blob> => {
  const docx = await import('docx')

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    UnderlineType,
    BorderStyle,
    ShadingType,
    PageOrientation,
    LevelFormat
  } = docx

  const ALIN = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
    justify: AlignmentType.JUSTIFIED
  }

  const pagina = configuracionPagina(datos.pagina)
  const modelo = construirModelo(datos.bloques)

  const referencias: string[] = []

  let grupo = 0
  let romperAntes = false

  const saltoExtra = () => {
    if (!romperAntes) return {}

    romperAntes = false

    return {
      pageBreakBefore: true
    }
  }

  const runDocx = (
    run: Run,
    base: IRunOptions = {}
  ) => {
    if (run.salto) {
      return new TextRun({
        break: 1
      })
    }

    const fuente = run.fuente
      ? FUENTES_DOCX[run.fuente] || run.fuente
      : base.font

    const tamano = run.tamano
      ? Math.round((run.tamano / 16) * 11 * 2)
      : base.size

    return new TextRun({
      text: run.texto,
      bold: run.negrita || base.bold || undefined,
      italics: run.cursiva || base.italics || undefined,
      underline: run.subrayado
        ? { type: UnderlineType.SINGLE }
        : undefined,
      strike: run.tachado || base.strike || undefined,
      color: run.color
        ? run.color.slice(1)
        : base.color,
      shading: run.fondo
        ? {
          type: ShadingType.CLEAR,
          fill: run.fondo.slice(1),
          color: 'auto'
        }
        : undefined,
      font: fuente,
      size: tamano
    })
  }

  const parrafosDe = (
    bloque: BloqueExportacion,
    base: IRunOptions,
    extra: IParagraphOptions
  ) => {
    const lineas: Parrafo[] = bloque.parrafos.length
      ? bloque.parrafos
      : [{ alineacion: null, runs: [] }]

    return lineas.map(
      (parrafo, indice) =>
        new Paragraph({
          ...extra,
          ...(indice === 0 ? saltoExtra() : {}),
          alignment: ALIN[parrafo.alineacion || 'left'],
          children: parrafo.runs.length
            ? parrafo.runs.map((run) => runDocx(run, base))
            : [
              new TextRun({
                text: ''
              })
            ]
        })
    )
  }

  const hijos: Paragraph[] = []

  modelo.forEach((bloque) => {
    switch (bloque.tipo) {
      case 'h1':
        hijos.push(
          ...parrafosDe(
            bloque,
            {
              bold: true,
              size: 36
            },
            {
              heading: HeadingLevel.HEADING_1,
              spacing: {
                before: 320,
                after: 120
              }
            }
          )
        )
        break

      case 'h2':
        hijos.push(
          ...parrafosDe(
            bloque,
            {
              bold: true,
              size: 30
            },
            {
              heading: HeadingLevel.HEADING_2,
              spacing: {
                before: 240,
                after: 100
              }
            }
          )
        )
        break

      case 'h3':
        hijos.push(
          ...parrafosDe(
            bloque,
            {
              bold: true,
              size: 26
            },
            {
              heading: HeadingLevel.HEADING_3,
              spacing: {
                before: 200,
                after: 80
              }
            }
          )
        )
        break

      case 'lista':
        hijos.push(
          ...parrafosDe(
            bloque,
            {},
            {
              bullet: {
                level: 0
              },
              spacing: {
                after: 60
              }
            }
          )
        )
        break

      case 'numerada':
        if (bloque.numero === 1) {
          grupo += 1
          referencias.push(`num-${grupo}`)
        }

        hijos.push(
          ...parrafosDe(
            bloque,
            {},
            {
              numbering: {
                reference: `num-${grupo}`,
                level: 0
              },
              spacing: {
                after: 60
              }
            }
          )
        )
        break

      case 'tarea': {
        if (!bloque.parrafos.length) {
          bloque.parrafos.push({
            alineacion: null,
            runs: []
          })
        }

        bloque.parrafos[0].runs.unshift({
          texto: bloque.hecho ? '☑ ' : '☐ ',
          fuente: 'Segoe UI Symbol'
        })

        const base: IRunOptions = bloque.hecho
          ? {
            strike: true,
            color: '777777'
          }
          : {}

        hijos.push(
          ...parrafosDe(
            bloque,
            base,
            {
              indent: {
                left: 360
              },
              spacing: {
                after: 60
              }
            }
          )
        )
        break
      }

      case 'cita':
        hijos.push(
          ...parrafosDe(
            bloque,
            {
              italics: true
            },
            {
              indent: {
                left: 360
              },
              border: {
                left: {
                  style: BorderStyle.SINGLE,
                  size: 18,
                  color: '999999',
                  space: 10
                }
              },
              spacing: {
                before: 120,
                after: 120
              }
            }
          )
        )
        break

      case 'codigo': {
        const lineas = (bloque.texto || ' ').split('\n')

        hijos.push(
          new Paragraph({
            ...saltoExtra(),
            children: lineas.map(
              (linea, indice) =>
                new TextRun({
                  text: linea,
                  font: 'Consolas',
                  size: 19,
                  break: indice === 0 ? 0 : 1
                })
            ),
            shading: {
              type: ShadingType.CLEAR,
              fill: 'F3F3F3',
              color: 'auto'
            },
            border: {
              top: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: 'CCCCCC',
                space: 4
              },
              bottom: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: 'CCCCCC',
                space: 4
              },
              left: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: 'CCCCCC',
                space: 4
              },
              right: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: 'CCCCCC',
                space: 4
              }
            },
            spacing: {
              before: 120,
              after: 160
            }
          })
        )
        break
      }

      case 'divisor':
        hijos.push(
          new Paragraph({
            ...saltoExtra(),
            children: [
              new TextRun({
                text: ''
              })
            ],
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: '999999',
                space: 1
              }
            },
            spacing: {
              before: 160,
              after: 160
            }
          })
        )
        break

      case 'salto':
        romperAntes = true
        break

      default:
        hijos.push(
          ...parrafosDe(
            bloque,
            {},
            {
              spacing: {
                after: 120
              }
            }
          )
        )
    }
  })

  const margen = pagina.margen.twips

  const documento = new Document({
    ...(datos.autor
      ? { creator: datos.autor }
      : {}),

    title: datos.titulo || 'Documento',

    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22
          }
        }
      }
    },

    numbering: {
      config: referencias.map((reference) => ({
        reference,
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: {
                  left: 720,
                  hanging: 360
                }
              }
            }
          }
        ]
      }))
    },

    sections: [
      {
        properties: {
          page: {
            size: {
              width: pagina.twips[0],
              height: pagina.twips[1],
              orientation: pagina.horizontal
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT
            },
            margin: {
              top: margen,
              bottom: margen,
              left: margen,
              right: margen
            }
          }
        },

        children: hijos.length
          ? hijos
          : [
            new Paragraph({
              children: [
                new TextRun({
                  text: ''
                })
              ]
            })
          ]
      }
    ]
  })

  return Packer.toBlob(documento)
}

// --------------------------------------------------
// Punto de entrada
// --------------------------------------------------

export const exportar = async (
  formato: FormatoExportacion,
  datos: DatosExportacion
): Promise<void> => {
  const base = nombreArchivo(datos.titulo)

  if (formato === 'txt') {
    descargar(
      new Blob(
        [aTxt(datos)],
        { type: 'text/plain;charset=utf-8' }
      ),
      `${base}.txt`
    )
  } else if (formato === 'md') {
    descargar(
      new Blob(
        [aMd(datos)],
        { type: 'text/markdown;charset=utf-8' }
      ),
      `${base}.md`
    )
  } else if (formato === 'html') {
    descargar(
      new Blob(
        [aHtml(datos)],
        { type: 'text/html;charset=utf-8' }
      ),
      `${base}.html`
    )
  } else if (formato === 'pdf') {
    descargar(
      await aPdf(datos),
      `${base}.pdf`
    )
  } else if (formato === 'docx') {
    descargar(
      await aDocx(datos),
      `${base}.docx`
    )
  }
}