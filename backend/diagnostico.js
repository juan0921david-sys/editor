require('dotenv').config()
const pool = require('./src/config/db')
const modelo = require('./src/models/document.model')

const ID_PRUEBA = 'diagnostico_prueba'
const LIMITE_MS = 10000
let fallos = 0

const conTiempo = (promesa) =>
  Promise.race([
    promesa,
    new Promise((resolver, rechazar) => {
      setTimeout(() => rechazar(new Error(`sin respuesta tras ${LIMITE_MS / 1000} s`)), LIMITE_MS)
    })
  ])

const paso = async (nombre, funcion) => {
  try {
    if (typeof funcion !== 'function') throw new Error('esta función no existe en tu document.model.js')
    const resultado = await conTiempo(funcion())
    console.log(`\nOK     ${nombre}`)
    if (resultado !== undefined) console.log(JSON.stringify(resultado, null, 2))
  } catch (error) {
    fallos += 1
    console.log(`\nFALLA  ${nombre}`)
    console.log(`       código: ${error.code || 'sin código'}`)
    console.log(`       mensaje: ${error.message || String(error)}`)
    if (error.detail) console.log(`       detalle: ${error.detail}`)
    if (error.hint) console.log(`       sugerencia: ${error.hint}`)
  }
}

const consulta = async (texto, valores) => (await pool.query(texto, valores)).rows

const datosConexion = () => {
  const url = process.env.DATABASE_URL
  if (!url) return { problema: 'DATABASE_URL no está definida en el .env' }
  try {
    const partes = new URL(url)
    return {
      host: partes.hostname,
      puerto: partes.port || '5432',
      base: partes.pathname.replace('/', ''),
      usuario: partes.username,
      parametros: partes.search || 'ninguno'
    }
  } catch {
    return { problema: 'DATABASE_URL no tiene un formato válido' }
  }
}

const correr = async () => {
  console.log('Diagnóstico del editor colaborativo')
  console.log(`Node ${process.version}`)
  console.log(`Funciones del modelo: ${Object.keys(modelo).join(', ') || 'ninguna'}`)

  await paso('Variables de conexión', async () => datosConexion())

  await paso('Conexión y usuario', async () =>
    (
      await consulta(
        `SELECT NOW() AS ahora, current_database() AS base, current_user AS usuario,
                current_setting('server_version') AS version_postgres`
      )
    )[0]
  )

  await paso('Estructura real de la tabla documentos', () =>
    consulta(
      `SELECT a.attname AS columna, format_type(a.atttypid, a.atttypmod) AS tipo, a.attnotnull AS obligatoria
       FROM pg_attribute a
       WHERE a.attrelid = to_regclass('documentos') AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum`
    )
  )

  await paso('Dueño de la tabla y permisos del usuario', () =>
    consulta(
      `SELECT tableowner AS dueno,
              has_table_privilege(current_user, 'documentos', 'SELECT') AS puede_leer,
              has_table_privilege(current_user, 'documentos', 'INSERT') AS puede_insertar,
              has_table_privilege(current_user, 'documentos', 'UPDATE') AS puede_actualizar,
              has_table_privilege(current_user, 'documentos', 'DELETE') AS puede_borrar
       FROM pg_tables WHERE tablename = 'documentos'`
    )
  )

  await paso('Índices y claves de documentos', () =>
    consulta("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'documentos'")
  )

  await paso('Ids repetidos en documentos', () =>
    consulta('SELECT id, COUNT(*) AS veces FROM documentos GROUP BY id HAVING COUNT(*) > 1')
  )

  await paso('Cantidad de documentos guardados', async () => (await consulta('SELECT COUNT(*) AS total FROM documentos'))[0])

  await paso('asegurarTabla', modelo.asegurarTabla)

  await paso('obtenerDocumento (crea o lee)', modelo.obtenerDocumento && (() => modelo.obtenerDocumento(ID_PRUEBA)))

  await paso('actualizarTituloBD', modelo.actualizarTituloBD && (() => modelo.actualizarTituloBD(ID_PRUEBA, 'Título de prueba')))

  await paso(
    'actualizarEstructuraBD',
    modelo.actualizarEstructuraBD &&
      (() =>
        modelo.actualizarEstructuraBD(ID_PRUEBA, [{ id: '1', contenido: 'texto de prueba', tipo: 'parrafo', hecho: false }]))
  )

  await paso('Lectura final', async () => (await consulta('SELECT titulo, bloques FROM documentos WHERE id = $1', [ID_PRUEBA]))[0])

  await paso('Limpieza del documento de prueba', async () => {
    await pool.query('DELETE FROM documentos WHERE id = $1', [ID_PRUEBA])
  })

  console.log(fallos === 0 ? '\nRESULTADO: todo en orden' : `\nRESULTADO: ${fallos} paso(s) con fallo`)
  process.exit(fallos === 0 ? 0 : 1)
}

correr()