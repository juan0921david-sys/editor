const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

const pool = require('./db')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

// Identificador estable para evitar ejecuciones simultáneas.
const MIGRATION_LOCK_ID = 20261121

const calcularHash = (contenido) => {
  return crypto
    .createHash('sha256')
    .update(contenido, 'utf8')
    .digest('hex')
}

const ejecutarMigraciones = async () => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // El bloqueo se libera automáticamente al finalizar la transacción.
    await client.query('SELECT pg_advisory_xact_lock($1)', [
      MIGRATION_LOCK_ID
    ])

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const resultado = await client.query(
      'SELECT nombre, hash FROM schema_migrations'
    )

    const aplicadas = new Map(
      resultado.rows.map((fila) => [fila.nombre, fila.hash])
    )

    const archivos = (await fs.readdir(MIGRATIONS_DIR))
      .filter((archivo) => archivo.endsWith('.sql'))
      .sort()

    for (const archivo of archivos) {
      const ruta = path.join(MIGRATIONS_DIR, archivo)
      const contenido = await fs.readFile(ruta, 'utf8')
      const hashActual = calcularHash(contenido)
      const hashAplicado = aplicadas.get(archivo)

      if (hashAplicado) {
        if (hashAplicado !== hashActual) {
          throw new Error(
            `La migración ${archivo} fue modificada después de aplicarse`
          )
        }

        console.log(`Migración ya aplicada: ${archivo}`)
        continue
      }

      console.log(`Aplicando migración: ${archivo}`)

      await client.query(contenido)

      await client.query(
        'INSERT INTO schema_migrations (nombre, hash) VALUES ($1, $2)',
        [archivo, hashActual]
      )
    }

    await client.query('COMMIT')
    console.log('Migraciones completadas correctamente')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const main = async () => {
  try {
    await ejecutarMigraciones()
  } catch (error) {
    console.error('No se pudieron ejecutar las migraciones:', error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()