/** Marca de "leído hasta" por sala (unix, segundos), guardada por dispositivo. */
export type LastSeen = Record<string, number>

const STORAGE_KEY = 'hivescope:last-seen'

export function loadLastSeen(): LastSeen {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: LastSeen = {}
    for (const [slug, ts] of Object.entries(raw)) if (typeof ts === 'number' && Number.isFinite(ts)) out[slug] = ts
    return out
  } catch {
    return {}
  }
}

export function saveLastSeen(seen: LastSeen) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen))
  } catch {
    // sin almacenamiento: los no leídos solo duran lo que dure la sesión
  }
}

/**
 * Las salas que nunca has visto arrancan "leídas hasta ahora": si no, la
 * primera vez que abrieras la app todos sus mensajes históricos serían nuevos.
 * Devuelve el mismo objeto si no hay nada que añadir.
 */
export function withBaseline(seen: LastSeen, slugs: string[], now: number): LastSeen {
  let out = seen
  for (const slug of slugs) {
    if (out[slug] === undefined) out = { ...out, [slug]: now }
  }
  return out
}

/** Marca `slug` como leída hasta `ts` (nunca retrocede). */
export function markSeen(seen: LastSeen, slug: string, ts: number): LastSeen {
  return (seen[slug] ?? 0) >= ts ? seen : { ...seen, [slug]: ts }
}

/** Mensajes ajenos posteriores a la marca de leído, por sala. */
export function tallyUnread(
  events: { tags: string[][]; pubkey: string; created_at: number; content?: string }[],
  seen: LastSeen,
  myPubkey: string,
  /** Si se da, solo cuentan los mensajes que la cumplen (p. ej. "va dirigido a mí"). */
  only?: (event: { tags: string[][]; content: string }) => boolean,
): Map<string, number> {
  const unread = new Map<string, number>()
  for (const event of events) {
    const slug = event.tags.find((t) => t[0] === 't')?.[1]
    if (!slug || event.pubkey === myPubkey) continue
    const since = seen[slug]
    if (since === undefined || event.created_at <= since) continue
    if (only && !only({ tags: event.tags, content: event.content ?? '' })) continue
    unread.set(slug, (unread.get(slug) ?? 0) + 1)
  }
  return unread
}

/** Título de la pestaña con el total de no leídos, p. ej. "(3) HiveScope Chat". */
export function titleWithUnread(base: string, total: number): string {
  return total > 0 ? `(${total > 99 ? '99+' : total}) ${base}` : base
}
