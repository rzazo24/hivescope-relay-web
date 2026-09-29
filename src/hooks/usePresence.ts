import { finalizeEvent } from 'nostr-tools/pure'
import type { Relay } from 'nostr-tools/relay'
import type { Subscription } from 'nostr-tools/abstract-relay'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { NostrIdentity } from '../lib/nostrIdentity'
import {
  countOnline,
  HEARTBEAT_MS,
  type OnlineCounts,
  PRESENCE_KIND,
  pruneStale,
  type PresenceBook,
  recordBeat,
  recordTyping,
  TYPING_THROTTLE_MS,
  type TypingBook,
  typingByRoom,
} from '../lib/presence'
import { resolveHiveAccounts } from '../lib/relay'
import { getRelay } from '../lib/sharedRelay'

// No contestar a una llegada si acabamos de latir hace menos de esto. Tiene que ser
// corto: nuestro último latido pudo salir justo ANTES de que el recién llegado
// se suscribiera, y entonces no lo ha visto.
const RESPOND_GUARD_MS = 1000
// Cuánto esperar antes de volver a pedir la cuenta de un pubkey que no se resolvió.
const RETRY_MS = 15_000

type Typers = Map<string, { account: string; at: number }[]>

/** Presencia + quién está escribiendo en cada sala + cómo avisar de que tú escribes. */
export type Online = OnlineCounts & {
  typing: Typers
  /** Avisa (con freno) de que estás escribiendo en la sala actual. */
  notifyTyping: () => void
}

const NO_TYPERS: Typers = new Map()
const EMPTY: Online = { total: 0, byRoom: new Map(), people: [], typing: NO_TYPERS, notifyTyping: () => {} }
const OnlineContext = createContext<Online>(EMPTY)
export const OnlineProvider = OnlineContext.Provider

/** Quién está en línea (total y por sala), tal como lo calcula usePresence en App. */
export function useOnline(): Online {
  return useContext(OnlineContext)
}

/**
 * Presencia en tiempo real sin servidor de presencia: mientras `enabled`,
 * publica un latido efímero (kind 20078, que el relé reenvía pero no guarda)
 * cada HEARTBEAT_MS con la sala en la que estás (tag "t"; ninguno = lista de
 * salas), y cuenta las cuentas Hive distintas con un latido reciente en los
 * de los demás. Solo los pubkeys vinculados pueden publicar latidos, así que
 * los que no se han vinculado no aparecen (ni cuentan).
 *
 * Una pestaña que llega no conoce a los demás hasta su próximo latido, así que
 * cuando alguien nuevo aparece cada cliente contesta con un latido propio tras
 * un retraso aleatorio corto: en un par de segundos se conocen todos, sin
 * esperar 25 s ni hacer que el relé guarde nada.
 */
export function usePresence(identity: NostrIdentity, slug: string | null, enabled: boolean): Online {
  const [counts, setCounts] = useState<OnlineCounts>(EMPTY)
  const [typing, setTyping] = useState<Typers>(NO_TYPERS)
  const notifyRef = useRef<() => void>(() => {})
  const notifyTyping = useCallback(() => notifyRef.current(), [])
  const slugRef = useRef(slug)
  const beatRef = useRef<(left?: boolean) => void>(() => {})
  const connectedRef = useRef(false)

  useEffect(() => {
    slugRef.current = slug
    // al cambiar de sala se anuncia al momento, sin esperar al siguiente latido
    if (connectedRef.current) beatRef.current()
  }, [slug])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let relay: Relay | null = null
    const book: PresenceBook = new Map()
    const accounts = new Map<string, string>()
    const askedAt = new Map<string, number>()
    const typingBook: TypingBook = new Map()
    let lastTypingSent = 0
    let typingKey = ''
    let lastBeatAt = 0
    let respondTimer: ReturnType<typeof setTimeout> | undefined

    const recompute = () => {
      const now = Date.now()
      pruneStale(book, now)
      setCounts(countOnline(book, now, (pk) => accounts.get(pk) || undefined))
      // resuelve en segundo plano las cuentas que faltan (una consulta en lote,
      // con caché); al llegar, se recuenta para fusionar dispositivos de una
      // cuenta. Un pubkey sin resolver se reintenta pasado RETRY_MS: la consulta
      // puede haber fallado (rate limit, corte) y no debe quedarse como
      // "desconocido" toda la sesión.
      const missing = [...book.keys()].filter((pk) => !accounts.get(pk) && now - (askedAt.get(pk) ?? 0) > RETRY_MS)
      if (missing.length > 0) {
        for (const pk of missing) askedAt.set(pk, now)
        void resolveHiveAccounts(missing)
          .then((found) => {
            if (cancelled) return
            for (const pk of missing) if (found.has(pk)) accounts.set(pk, found.get(pk)!)
            setCounts(countOnline(book, Date.now(), (pk) => accounts.get(pk) || undefined))
          })
          .catch(() => {})
      }
    }

    const refreshTyping = () => {
      const next = typingByRoom(typingBook, Date.now(), (pk) => accounts.get(pk) || undefined)
      const key = JSON.stringify([...next])
      if (key === typingKey) return
      typingKey = key
      setTyping(next.size === 0 ? NO_TYPERS : next)
    }

    const beat = (left = false, isTyping = false) => {
      if (!relay) return
      const now = Date.now()
      lastBeatAt = now
      const tags: string[][] = []
      if (slugRef.current) tags.push(['t', slugRef.current])
      if (left) tags.push(['left'])
      if (isTyping && slugRef.current) tags.push(['typing'])
      recordBeat(book, identity.publicKey, slugRef.current, now, left)
      recompute()
      // un latido perdido no importa (rate limit, corte...): llegará el siguiente
      relay
        .publish(finalizeEvent({ kind: PRESENCE_KIND, created_at: Math.floor(now / 1000), tags, content: '' }, identity.secretKey))
        .catch(() => {})
    }
    beatRef.current = beat
    notifyRef.current = () => {
      if (!slugRef.current || Date.now() - lastTypingSent < TYPING_THROTTLE_MS) return
      lastTypingSent = Date.now()
      beat(false, true)
    }

    let sub: Subscription | null = null
    getRelay()
      .then((r) => {
        if (cancelled) return
        relay = r
        connectedRef.current = true
        sub = r.subscribe([{ kinds: [PRESENCE_KIND], limit: 0 }], {
          onevent(event) {
            const room = event.tags.find((t) => t[0] === 't')?.[1] ?? null
            const left = event.tags.some((t) => t[0] === 'left')
            if (event.tags.some((t) => t[0] === 'typing') && room && event.pubkey !== identity.publicKey) {
              recordTyping(typingBook, event.pubkey, room, Date.now())
              refreshTyping()
            }
            const arrival = recordBeat(book, event.pubkey, room, Date.now(), left)
            recompute()
            if (arrival && event.pubkey !== identity.publicKey && Date.now() - lastBeatAt > RESPOND_GUARD_MS) {
              clearTimeout(respondTimer)
              respondTimer = setTimeout(() => beat(), 300 + Math.random() * 1700)
            }
          },
        })
        beat()
      })
      .catch(() => {
        // sin conexión no hay presencia; el resto de la app sigue igual
      })

    const heartbeat = setInterval(() => beat(), HEARTBEAT_MS)
    const tick = setInterval(recompute, 5000)
    const typingTick = setInterval(refreshTyping, 1000)
    const onHide = () => beat(true)
    window.addEventListener('pagehide', onHide)

    return () => {
      cancelled = true
      connectedRef.current = false
      beatRef.current = () => {}
      clearInterval(heartbeat)
      clearInterval(tick)
      clearInterval(typingTick)
      notifyRef.current = () => {}
      clearTimeout(respondTimer)
      window.removeEventListener('pagehide', onHide)
      sub?.close()
    }
  }, [enabled, identity])

  return useMemo(() => (enabled ? { ...counts, typing, notifyTyping } : EMPTY), [enabled, counts, typing, notifyTyping])
}
