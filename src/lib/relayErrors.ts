// El relé responde con motivos en inglés pensados para cualquier cliente Nostr
// (NIP-01). Aquí se reconocen los que un usuario puede provocar de verdad y se
// devuelve la clave i18n de un texto más claro; el resto se muestra tal cual.

const KNOWN: { test: RegExp; key: string }[] = [
  { test: /^rate-limited/i, key: 'errors.rateLimited' },
  { test: /message too long/i, key: 'errors.tooLong' },
  { test: /hasn't linked a hive account/i, key: 'errors.notLinked' },
  { test: /(?:^|[^a-z])(?:websocket|connection)[^]*(?:closed|failed|error)|failed to fetch|networkerror|timed? ?out/i, key: 'errors.offline' },
]

/** Clave i18n para el motivo de rechazo/fallo del relé, o null si no se reconoce. */
export function relayErrorKey(message: string): string | null {
  return KNOWN.find((k) => k.test.test(message))?.key ?? null
}

/** Texto para mostrar: el traducido si se reconoce el motivo, o el original. */
export function describeRelayError(message: string, t: (key: string) => string): string {
  const key = relayErrorKey(message)
  return key ? t(key) : message
}
