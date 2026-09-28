/** Kind efímero del latido de presencia (ver PresenceKind en hivescope-relay). */
export const PRESENCE_KIND = 20078
/** Cada cuánto anuncia su presencia cada cliente. */
export const HEARTBEAT_MS = 25_000
/** Sin latido en este tiempo (algo más de dos latidos perdidos) se considera desconectado. */
export const STALE_MS = 70_000

/** Último latido de un pubkey: en qué sala (null = lista de salas) y cuándo lo recibimos (ms). */
export interface Beat {
  slug: string | null
  at: number
}
export type PresenceBook = Map<string, Beat>

/**
 * Anota un latido. `at` es la hora LOCAL de recepción, no el created_at del
 * evento, para no depender de que los relojes de los demás estén en hora.
 * `left` (tag "left") retira la presencia al instante. Devuelve true si es un
 * pubkey que no estaba anotado (una llegada nueva).
 */
export function recordBeat(book: PresenceBook, pubkey: string, slug: string | null, at: number, left = false): boolean {
  const isNew = !book.has(pubkey)
  if (left) book.delete(pubkey)
  else book.set(pubkey, { slug, at })
  return isNew && !left
}

export function pruneStale(book: PresenceBook, now: number): void {
  for (const [pubkey, beat] of book) {
    if (now - beat.at > STALE_MS) book.delete(pubkey)
  }
}

export interface OnlineCounts {
  /** Cuentas distintas en línea en total. */
  total: number
  /** Cuentas distintas en línea en cada sala. */
  byRoom: Map<string, number>
}

/**
 * Cuenta personas, no pestañas ni dispositivos: dos pubkeys de la misma
 * cuenta Hive (móvil y PC) cuentan una vez, y si están en salas distintas
 * cuentan en cada una. `accountOf` resuelve pubkey -> cuenta; mientras un
 * pubkey no se haya resuelto cuenta como una persona propia.
 */
export function countOnline(
  book: PresenceBook,
  now: number,
  accountOf: (pubkey: string) => string | undefined,
): OnlineCounts {
  const all = new Set<string>()
  const rooms = new Map<string, Set<string>>()
  for (const [pubkey, beat] of book) {
    if (now - beat.at > STALE_MS) continue
    const person = accountOf(pubkey)?.toLowerCase() ?? `pk:${pubkey}`
    all.add(person)
    if (beat.slug) {
      if (!rooms.has(beat.slug)) rooms.set(beat.slug, new Set())
      rooms.get(beat.slug)!.add(person)
    }
  }
  return { total: all.size, byRoom: new Map([...rooms].map(([slug, people]) => [slug, people.size])) }
}
