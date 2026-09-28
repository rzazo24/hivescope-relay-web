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

/** Una persona en línea (una cuenta Hive, aunque tenga varios dispositivos). */
export interface OnlinePerson {
  /** Cuenta Hive en minúsculas, o null mientras no se ha resuelto (entonces `key` es el pubkey). */
  account: string | null
  key: string
  /** Salas en las que está (uno de sus dispositivos en cada una); vacío = solo en la lista de salas. */
  rooms: string[]
}

export interface OnlineCounts {
  /** Cuentas distintas en línea en total. */
  total: number
  /** Cuentas distintas en línea en cada sala. */
  byRoom: Map<string, number>
  /** Quién es cada una, ordenadas por cuenta (las no resueltas al final). */
  people: OnlinePerson[]
}

/** Las personas que están en `slug`. */
export function peopleInRoom(people: OnlinePerson[], slug: string): OnlinePerson[] {
  return people.filter((p) => p.rooms.includes(slug))
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
  const people = new Map<string, OnlinePerson>()
  const rooms = new Map<string, Set<string>>()
  for (const [pubkey, beat] of book) {
    if (now - beat.at > STALE_MS) continue
    const account = accountOf(pubkey)?.toLowerCase() ?? null
    const key = account ?? `pk:${pubkey}`
    const person = people.get(key) ?? { account, key: account ?? pubkey, rooms: [] }
    people.set(key, person)
    if (beat.slug) {
      if (!person.rooms.includes(beat.slug)) person.rooms.push(beat.slug)
      if (!rooms.has(beat.slug)) rooms.set(beat.slug, new Set())
      rooms.get(beat.slug)!.add(key)
    }
  }
  const list = [...people.values()].sort(
    (a, b) => Number(a.account === null) - Number(b.account === null) || a.key.localeCompare(b.key),
  )
  list.forEach((p) => p.rooms.sort())
  return { total: list.length, byRoom: new Map([...rooms].map(([slug, set]) => [slug, set.size])), people: list }
}

/** Cuánto dura "está escribiendo" sin un nuevo aviso. */
export const TYPING_MS = 5_000
/** Cada cuánto como máximo se avisa de que estás escribiendo (cuida el límite de latidos del relé). */
export const TYPING_THROTTLE_MS = 4_000

/** Último aviso "está escribiendo" de un pubkey: en qué sala y cuándo lo recibimos (ms). */
export type TypingBook = Map<string, { slug: string; at: number }>

export function recordTyping(book: TypingBook, pubkey: string, slug: string, at: number): void {
  book.set(pubkey, { slug, at })
}

/** Quien escribe en cada sala ahora mismo: cuenta (minúsculas) y desde cuándo. Descarta los caducados y los sin cuenta resuelta. */
export function typingByRoom(
  book: TypingBook,
  now: number,
  accountOf: (pubkey: string) => string | undefined,
): Map<string, { account: string; at: number }[]> {
  const out = new Map<string, { account: string; at: number }[]>()
  for (const [pubkey, { slug, at }] of book) {
    if (now - at > TYPING_MS) {
      book.delete(pubkey)
      continue
    }
    const account = accountOf(pubkey)?.toLowerCase()
    if (!account) continue
    const list = out.get(slug) ?? []
    const existing = list.find((x) => x.account === account)
    if (existing) existing.at = Math.max(existing.at, at)
    else list.push({ account, at })
    out.set(slug, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.account.localeCompare(b.account))
  return out
}
