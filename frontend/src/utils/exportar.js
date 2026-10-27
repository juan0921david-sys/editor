import { rgbAHex, nombreFuente } from './sanitizar'

const TIPOS_LISTA = ['lista', 'numerada', 'tarea']
const ALIN_PDF = { left: 'left', center: 'center', right: 'right', justify: 'justify' }
const FUENTES_DOCX = { 'IBM Plex Mono': 'Consolas', 'Press Start 2P': 'Courier New', VT323: 'Courier New' }

const escaparHtml = (texto) =>
  String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const nombreArchivo = (titulo) =>
  (titulo || 'documento').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'documento'

const descargar = (blob, nombre) => {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const estiloDe = (el, base) => {
  const nuevo = { ...base }
  const etiqueta = el.tagName
  if (etiqueta === 'B' || etiqueta === 'STRONG') nuevo.negrita = true
  if (etiqueta === 'I' || etiqueta === 'EM') nuevo.cursiva = true
  if (etiqueta === 'U') nuevo.subrayado = true
  if (etiqueta === 'S' || etiqueta === 'STRIKE') nuevo.tachado = true
  const s = el.style
  if (s) {
    const color = rgbAHex(s.color)
    const fondo = rgbAHex(s.backgroundColor)
    const fuente = nombreFuente(s.fontFamily)
    const px = parseFloat(s.fontSize)
    if (color) nuevo.color = color
    if (fondo) nuevo.fondo = fondo
    if (fuente) nuevo.fuente = fuente
    if (px) nuevo.tamano = px
  }
  return nuevo
}

const htmlAParrafos = (html) => {
  const plantilla = document.createElement('template')
  plantilla.innerHTML = html || ''
  const parrafos = []
  let actual = null

  const abrir = (alineacion) => {
    actual = { alineacion, runs: [] }
  }

  const cerrar = () => {
    if (actual) parrafos.push(actual)
    actual = null
  }

  const recorrer = (nodo, estilo, alineacion) => {
    nodo.childNodes.forEach((hijo) => {
      if (hijo.nodeType === 3) {
        if (!hijo.textContent) return
        if (!actual) abrir(alineacion)
        actual.runs.push({ ...estilo, texto: hijo.textContent })
        return
      }
      if (hijo.nodeType !== 1) return
      
      // Sanitización estricta: saltarse botones o inputs que no son texto
      const etiqueta = hijo.tagName
      if (['BUTTON', 'INPUT', 'SCRIPT', 'STYLE'].includes(etiqueta)) return
      
      if (etiqueta === 'BR') {
        if (!actual) abrir(alineacion)
        actual.runs.push({ salto: true })
        return
      }
      if (etiqueta === 'DIV' || etiqueta === 'P') {
        cerrar()
        const alin = hijo.style && hijo.style.textAlign ? hijo.style.textAlign : alineacion
        abrir(alin)
        recorrer(hijo, estilo, alin)
        cerrar()
        return
      }
      recorrer(hijo, estiloDe(hijo, estilo), alineacion)
    })
  }

  recorrer(plantilla.content, {}, null)
  cerrar()
  return parrafos.map((p) => {
    const runs = p.runs.slice()
    if (runs.length && runs[runs.length - 1].salto) runs.pop()
    return { alineacion: p.alineacion, runs }
  })
}

const runsATexto = (runs) => runs.map((r) => (r.salto ? '\n' : r.texto)).join('')

export const textoPlano = (html) =>
  htmlAParrafos(html)
    .map((p) => runsATexto(p.runs))
    .join('\n')

const construirModelo = (bloques) => {
  let n = 0
  return bloques.map((b) => {
    n = b.tipo === 'numerada' ? n + 1 : 0
    const parrafos = htmlAParrafos(b.contenido)
    return {
      tipo: b.tipo,
      hecho: !!b.hecho,
      numero: n,
      parrafos,
      texto: parrafos.map((p) => runsATexto(p.runs)).join('\n')
    }
  })
}

const unirBloques = (modelo, lineas) =>
  lineas.reduce((acumulado, linea, i) => {
    if (i === 0) return linea
    const mismaLista = TIPOS_LISTA.includes(modelo[i].tipo) && modelo[i].tipo === modelo[i - 1].tipo
    return `${acumulado}${mismaLista ? '\n' : '\n\n'}${linea}`
  }, '')

const aTxt = (datos) => {
  const modelo = construirModelo(datos.bloques)
  const lineas = modelo.map((b) => {
    switch (b.tipo) {
      case 'h1':
        return b.texto.toUpperCase()
      case 'lista':
        return `• ${b.texto}`
      case 'numerada':
        return `${b.numero}. ${b.texto}`
      case 'tarea':
        return `[${b.hecho ? 'x' : ' '}] ${b.texto}`
      case 'cita':
        return b.texto
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n')
      case 'codigo':
        return b.texto
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')
      case 'divisor':
        return '----------------------------------------'
      default:
        return b.texto
    }
  })
  return `${unirBloques(modelo, lineas)}\n`
}

const runMd = (r) => {
  if (r.salto) return '  \n'
  const partes = r.texto.match(/^(\s*)([\s\S]*?)(\s*)$/)
  let nucleo = partes[2]
  if (!nucleo) return r.texto
  if (r.tachado) nucleo = `~~${nucleo}~~`
  if (r.subrayado) nucleo = `<u>${nucleo}</u>`
  if (r.cursiva) nucleo = `*${nucleo}*`
  if (r.negrita) nucleo = `**${nucleo}**`
  return `${partes[1]}${nucleo}${partes[3]}`
}

const aMd = (datos) => {
  const modelo = construirModelo(datos.bloques)
  const lineas = modelo.map((b) => {
    const texto = b.parrafos.map((p) => p.runs.map(runMd).join('')).join('  \n')
    switch (b.tipo) {
      case 'h1':
        return `# ${texto}`
      case 'h2':
        return `## ${texto}`
      case 'h3':
        return `### ${texto}`
      case 'lista':
        return `- ${texto}`
      case 'numerada':
        return `${b.numero}. ${texto}`
      case 'tarea':
        return `- [${b.hecho ? 'x' : ' '}] ${texto}`
      case 'cita':
        return texto
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n')
      case 'codigo':
        return `\`\`\`\n${b.texto}\n\`\`\``
      case 'divisor':
        return '---'
      default:
        return texto
    }
  })
  return `${unirBloques(modelo, lineas)}\n`
}

const runHtml = (r) => {
  if (r.salto) return '<br>'
  let t = escaparHtml(r.texto)
  const estilo = []
  if (r.color) estilo.push(`color:${r.color}`)
  if (r.fondo) estilo.push(`background:${r.fondo}`)
  if (r.fuente) estilo.push(`font-family:'${r.fuente}'`)
  if (r.tamano) estilo.push(`font-size:${r.tamano}px`)
  if (estilo.length) t = `<span style="${estilo.join(';')}">${t}</span>`
  if (r.tachado) t = `<s>${t}</s>`
  if (r.subrayado) t = `<u>${t}</u>`
  if (r.cursiva) t = `<em>${t}</em>`
  if (r.negrita) t = `<strong>${t}</strong>`
  return t
}

const parrafoHtml = (p) =>
  `<div${p.alineacion ? ` style="text-align:${p.alineacion}"` : ''}>${p.runs.map(runHtml).join('') || '<br>'}</div>`

const aHtml = (datos) => {
  const modelo = construirModelo(datos.bloques)
  const cuerpo = modelo
    .map((b) => {
      const interior = b.parrafos.map(parrafoHtml).join('') || '<br>'
      switch (b.tipo) {
        case 'h1':
          return `<h1>${interior}</h1>`
        case 'h2':
          return `<h2>${interior}</h2>`
        case 'h3':
          return `<h3>${interior}</h3>`
        case 'lista':
          return `<div class="item"><span class="marca">&#9632;</span><div>${interior}</div></div>`
        case 'numerada':
          return `<div class="item"><span class="marca">${b.numero}.</span><div>${interior}</div></div>`
        case 'tarea':
          return `<div class="item${b.hecho ? ' hecho' : ''}"><span class="marca">${b.hecho ? '&#9745;' : '&#9744;'}</span><div>${interior}</div></div>`
        case 'cita':
          return `<blockquote>${interior}</blockquote>`
        case 'codigo':
          return `<pre>${escaparHtml(b.texto)}</pre>`
        case 'divisor':
          return '<hr>'
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
body{font-family:Georgia,serif;max-width:820px;margin:48px auto;padding:0 24px;line-height:1.7;color:#1b1740}
h1,h2,h3{color:#2b2563;line-height:1.3}
.bloque{margin-bottom:10px}
.item{display:flex;gap:10px;margin-bottom:4px}
.marca{color:#2b2563;min-width:22px}
.hecho{opacity:.55;text-decoration:line-through}
blockquote{margin:14px 0;padding:8px 16px;border-left:5px solid #b9a9e8;background:#f4f1fd;font-style:italic}
pre{background:#f1eefb;border:2px solid #2b2563;padding:14px;overflow:auto;font-family:Consolas,monospace}
hr{border:0;border-top:3px dotted #2b2563;margin:24px 0}
</style>
</head>
<body>
${cuerpo}
</body>
</html>`
}

const aPdf = async (datos) => {
  const [modPdf, modFuentes] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  const pdfMake = modPdf.default || modPdf
  const fuentes = modFuentes.default || modFuentes
  const vfs = (fuentes.pdfMake && fuentes.pdfMake.vfs) || fuentes.vfs || fuentes
  if (typeof pdfMake.addVirtualFileSystem === 'function') pdfMake.addVirtualFileSystem(vfs)
  else pdfMake.vfs = vfs

  const modelo = construirModelo(datos.bloques)

  const runPdf = (r) => {
    if (r.salto) return { text: '\n' }
    const o = { text: r.texto }
    if (r.negrita) o.bold = true
    if (r.cursiva) o.italics = true
    const decoracion = []
    if (r.subrayado) decoracion.push('underline')
    if (r.tachado) decoracion.push('lineThrough')
    if (decoracion.length) o.decoration = decoracion.length === 1 ? decoracion[0] : decoracion
    if (r.color) o.color = r.color
    if (r.fondo) o.background = r.fondo
    if (r.tamano) o.fontSize = Math.round((r.tamano / 16) * 11 * 10) / 10
    return o
  }

  const lineasDe = (b) => (b.parrafos.length ? b.parrafos : [{ alineacion: null, runs: [] }])

  const cuerpo = (b, extra = {}) => ({
    stack: lineasDe(b).map((p) => ({
      text: p.runs.length ? p.runs.map(runPdf) : ' ',
      alignment: ALIN_PDF[p.alineacion] || 'left',
      ...extra
    }))
  })

  const casilla = (hecho) => {
    const trazos = [{ type: 'rect', x: 0, y: 2, w: 10, h: 10, lineWidth: 1.2, lineColor: '#2B2563' }]
    if (hecho) {
      trazos.push({ type: 'line', x1: 2, y1: 7, x2: 4.5, y2: 10, lineWidth: 1.6, lineColor: '#2B2563' })
      trazos.push({ type: 'line', x1: 4.5, y1: 10, x2: 9, y2: 3.5, lineWidth: 1.6, lineColor: '#2B2563' })
    }
    return { width: 18, canvas: trazos }
  }

  const bloquePdf = (b) => {
    switch (b.tipo) {
      case 'h1':
        return { ...cuerpo(b, { fontSize: 20, bold: true, color: '#2B2563' }), margin: [0, 14, 0, 6] }
      case 'h2':
        return { ...cuerpo(b, { fontSize: 16, bold: true, color: '#2B2563' }), margin: [0, 10, 0, 5] }
      case 'h3':
        return { ...cuerpo(b, { fontSize: 13, bold: true, color: '#2B2563' }), margin: [0, 8, 0, 4] }
      case 'lista':
        return {
          columns: [{ width: 16, text: '•', bold: true, color: '#2B2563' }, { width: '*', ...cuerpo(b) }],
          margin: [8, 0, 0, 3]
        }
      case 'numerada':
        return {
          columns: [{ width: 24, text: `${b.numero}.`, color: '#2B2563' }, { width: '*', ...cuerpo(b) }],
          margin: [8, 0, 0, 3]
        }
      case 'tarea':
        return {
          columns: [
            casilla(b.hecho),
            { width: '*', ...cuerpo(b, b.hecho ? { color: '#8A85B5', decoration: 'lineThrough' } : {}) }
          ],
          margin: [8, 0, 0, 3]
        }
      case 'cita':
        return {
          table: { widths: ['*'], body: [[{ ...cuerpo(b, { italics: true, color: '#4A4580' }), margin: [10, 5, 5, 5] }]] },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: (i) => (i === 0 ? 3 : 0),
            vLineColor: () => '#B9A9E8',
            fillColor: () => '#F4F1FD'
          },
          margin: [0, 6, 0, 8]
        }
      case 'codigo':
        return {
          table: {
            widths: ['*'],
            body: [[{ text: b.texto || ' ', fontSize: 9.5, color: '#2B2563', preserveLeadingSpaces: true, margin: [8, 6, 8, 6] }]]
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#B9A9E8',
            vLineColor: () => '#B9A9E8',
            fillColor: () => '#F1EEFB'
          },
          margin: [0, 6, 0, 8]
        }
      case 'divisor':
        return {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 1.2, lineColor: '#B9A9E8', dash: { length: 4 } }],
          margin: [0, 10, 0, 10]
        }
      default:
        return { ...cuerpo(b), margin: [0, 0, 0, 6] }
    }
  }

  const titulo = datos.titulo || 'Documento'

  const definicion = {
    pageSize: 'A4',
    pageMargins: [56, 64, 56, 64],
    info: { title: titulo, author: datos.autor || 'Editor_Docs', creator: 'Editor_Docs' },
    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.35, color: '#1B1740' },
    content: [
      ...modelo.map(bloquePdf)
    ],
    footer: (pagina, total) => ({
      text: `${titulo}  ·  ${pagina} / ${total}`,
      alignment: 'center',
      fontSize: 8,
      color: '#8A85B5',
      margin: [0, 18, 0, 0]
    })
  }

  const archivo = pdfMake.createPdf(definicion)
  const blob = await new Promise((resolve, reject) => {
    try {
      const resultado = archivo.getBlob(resolve)
      if (resultado && typeof resultado.then === 'function') resultado.then(resolve, reject)
    } catch (error) {
      reject(error)
    }
  })
  return blob
}

const aDocx = async (datos) => {
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
    Footer,
    PageNumber,
    LevelFormat
  } = docx

  const ALIN = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
    justify: AlignmentType.JUSTIFIED
  }

  const modelo = construirModelo(datos.bloques)
  const referencias = []
  let grupo = 0

  const runDocx = (r, base = {}) => {
    if (r.salto) return new TextRun({ break: 1 })
    const fuente = r.fuente ? FUENTES_DOCX[r.fuente] || r.fuente : base.font
    const tamano = r.tamano ? Math.round((r.tamano / 16) * 11 * 2) : base.size
    return new TextRun({
      text: r.texto,
      bold: r.negrita || base.bold || undefined,
      italics: r.cursiva || base.italics || undefined,
      underline: r.subrayado ? { type: UnderlineType.SINGLE } : undefined,
      strike: r.tachado || base.strike || undefined,
      color: r.color ? r.color.slice(1) : base.color,
      shading: r.fondo ? { type: ShadingType.CLEAR, fill: r.fondo.slice(1), color: 'auto' } : undefined,
      font: fuente,
      size: tamano
    })
  }

  const parrafosDe = (b, base, extra) => {
    const lineas = b.parrafos.length ? b.parrafos : [{ alineacion: null, runs: [] }]
    return lineas.map(
      (p) =>
        new Paragraph({
          ...extra,
          alignment: ALIN[p.alineacion] || AlignmentType.LEFT,
          children: p.runs.length ? p.runs.map((r) => runDocx(r, base)) : [new TextRun({ text: '' })]
        })
    )
  }

  const hijos = []

  modelo.forEach((b) => {
    switch (b.tipo) {
      case 'h1':
        hijos.push(
          ...parrafosDe(b, { bold: true, size: 36, color: '2B2563' }, {
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 320, after: 120 }
          })
        )
        break
      case 'h2':
        hijos.push(
          ...parrafosDe(b, { bold: true, size: 30, color: '2B2563' }, {
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 }
          })
        )
        break
      case 'h3':
        hijos.push(
          ...parrafosDe(b, { bold: true, size: 26, color: '2B2563' }, {
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 80 }
          })
        )
        break
      case 'lista':
        hijos.push(...parrafosDe(b, {}, { bullet: { level: 0 }, spacing: { after: 60 } }))
        break
      case 'numerada':
        if (b.numero === 1) {
          grupo += 1
          referencias.push(`num-${grupo}`)
        }
        hijos.push(...parrafosDe(b, {}, { numbering: { reference: `num-${grupo}`, level: 0 }, spacing: { after: 60 } }))
        break
      case 'tarea': {
        if (!b.parrafos.length) b.parrafos.push({ alineacion: null, runs: [] })
        b.parrafos[0].runs.unshift({ texto: b.hecho ? '☑ ' : '☐ ', fuente: 'Segoe UI Symbol' })
        const base = b.hecho ? { strike: true, color: '8A85B5' } : {}
        hijos.push(...parrafosDe(b, base, { indent: { left: 360 }, spacing: { after: 60 } }))
        break
      }
      case 'cita':
        hijos.push(
          ...parrafosDe(b, { italics: true, color: '4A4580' }, {
            indent: { left: 360 },
            border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'B9A9E8', space: 10 } },
            shading: { type: ShadingType.CLEAR, fill: 'F4F1FD', color: 'auto' },
            spacing: { before: 120, after: 120 }
          })
        )
        break
      case 'codigo': {
        const lineas = (b.texto || ' ').split('\n')
        hijos.push(
          new Paragraph({
            children: lineas.map((linea, i) => new TextRun({ text: linea, font: 'Consolas', size: 19, break: i === 0 ? 0 : 1 })),
            shading: { type: ShadingType.CLEAR, fill: 'F1EEFB', color: 'auto' },
            border: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'B9A9E8', space: 4 },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B9A9E8', space: 4 },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'B9A9E8', space: 4 },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'B9A9E8', space: 4 }
            },
            spacing: { before: 120, after: 160 }
          })
        )
        break
      }
      case 'divisor':
        hijos.push(
          new Paragraph({
            children: [new TextRun({ text: '' })],
            border: { bottom: { style: BorderStyle.DOTTED, size: 8, color: 'B9A9E8', space: 1 } },
            spacing: { before: 160, after: 160 }
          })
        )
        break
      default:
        hijos.push(...parrafosDe(b, {}, { spacing: { after: 120 } }))
    }
  })

  const documento = new Document({
    creator: datos.autor || 'Editor_Docs',
    title: datos.titulo || 'Documento',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: referencias.map((reference) => ({
        reference,
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }
        ]
      }))
    },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1247, right: 1247 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '8A85B5'
                  })
                ]
              })
            ]
          })
        },
        children: hijos
      }
    ]
  })

  return Packer.toBlob(documento)
}

export const exportar = async (formato, datos) => {
  const base = nombreArchivo(datos.titulo)
  if (formato === 'txt') {
    descargar(new Blob([aTxt(datos)], { type: 'text/plain;charset=utf-8' }), `${base}.txt`)
  } else if (formato === 'md') {
    descargar(new Blob([aMd(datos)], { type: 'text/markdown;charset=utf-8' }), `${base}.md`)
  } else if (formato === 'html') {
    descargar(new Blob([aHtml(datos)], { type: 'text/html;charset=utf-8' }), `${base}.html`)
  } else if (formato === 'pdf') {
    descargar(await aPdf(datos), `${base}.pdf`)
  } else if (formato === 'docx') {
    descargar(await aDocx(datos), `${base}.docx`)
  }
} 