export const esRegistro = (
    valor: unknown
): valor is Record<string, unknown> =>
    typeof valor === 'object' &&
    valor !== null &&
    !Array.isArray(valor)

export const leerAccessToken = (valor: unknown): string =>
    esRegistro(valor) && typeof valor.accessToken === 'string'
        ? valor.accessToken
        : ''