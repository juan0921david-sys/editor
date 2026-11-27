const { test } = require('node:test')
const assert = require('node:assert/strict')
const { adquirirBloqueo } = require('../src/services/blockLockService')

const escenario = () => {
    const sala = {
        bloques: [{ id: 'a' }, { id: 'b' }],
        bloqueos: new Map()
    }

    const eventos = []

    const tomar = (usuario, bloque, ahora = 0) =>
        adquirirBloqueo(sala, usuario, bloque, {
            ahora,
            ttl: 60_000,

            liberar: (id) => {
                sala.bloqueos.delete(id)
                eventos.push(['liberado', id])
            },

            aprobar: (id, userId) => {
                eventos.push(['aprobado', id, userId])
            }
        })

    return { sala, eventos, tomar }
}

test('dos solicitudes concurrentes tienen un solo propietario', async () => {
    const { sala, tomar } = escenario()

    const resultados = await Promise.all(
        ['uno', 'dos'].map((usuario) =>
            Promise.resolve().then(() => tomar(usuario, 'a'))
        )
    )

    assert.deepEqual(resultados, [true, false])
    assert.equal(sala.bloqueos.get('a').userId, 'uno')
})

test('un ID inexistente no crea bloqueos ni libera el bloque activo', () => {
    const { sala, eventos, tomar } = escenario()

    tomar('uno', 'a')

    assert.equal(tomar('uno', 'inexistente'), false)
    assert.deepEqual([...sala.bloqueos.keys()], ['a'])
    assert.equal(eventos.length, 1)
})

test('el vencimiento permite adquirir en el límite exacto sin esperar el barrido', () => {
    const { sala, eventos, tomar } = escenario()

    tomar('uno', 'a')

    assert.equal(tomar('dos', 'a', 59_999), false)
    assert.equal(tomar('dos', 'a', 60_000), true)
    assert.equal(sala.bloqueos.get('a').userId, 'dos')

    assert.deepEqual(eventos.slice(1), [
        ['liberado', 'a'],
        ['aprobado', 'a', 'dos']
    ])
})

test('renovar conserva propietario y extiende el vencimiento', () => {
    const { sala, eventos, tomar } = escenario()

    tomar('uno', 'a')

    assert.equal(tomar('uno', 'a', 50_000), true)
    assert.equal(tomar('dos', 'a', 60_000), false)
    assert.equal(sala.bloqueos.get('a').t, 50_000)
    assert.equal(eventos.length, 1)
})

test('cambiar de bloque libera el anterior del mismo usuario', () => {
    const { sala, tomar } = escenario()

    tomar('uno', 'a')

    assert.equal(tomar('uno', 'b'), true)
    assert.deepEqual([...sala.bloqueos.keys()], ['b'])
})

test('una adquisición rechazada conserva el bloqueo previo del solicitante', () => {
    const { sala, tomar } = escenario()

    tomar('uno', 'a')
    tomar('dos', 'b')

    assert.equal(tomar('uno', 'b'), false)
    assert.equal(sala.bloqueos.get('a').userId, 'uno')
    assert.equal(sala.bloqueos.get('b').userId, 'dos')
})

test('los bloqueos de documentos diferentes están aislados', () => {
    const primera = escenario()
    const segunda = escenario()

    assert.equal(primera.tomar('uno', 'a'), true)
    assert.equal(segunda.tomar('dos', 'a'), true)
})