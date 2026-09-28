import { useCallback, useEffect, useRef, useState } from 'react'
import { Relay } from 'nostr-tools/relay'
import { RELAY_URL } from '../../lib/config'
import { isForMe } from '../chat/mentions'
import { loadLastSeen, markSeen, saveLastSeen, tallyUnread, withBaseline, type LastSeen } from '../../lib/unread'
import { createRoom, fetchRoomMessages, isRoomExpired, listRooms, mergeRoom, parseRoomEvent, ROOM_META_KIND, tallyMessages, lastActivityByRoom, type Room } from '../../lib/rooms'

// Cada cuánto se vuelve a pedir la lista completa. Las altas y ediciones llegan
// en vivo por la suscripción, pero cuando el relé borra una sala caducada no
// avisa a nadie, así que hay que releer para que desaparezca de verdad.
const REFRESH_MS = 60_000
// Cada cuánto se re-evalúa qué salas ya han caducado (sin ir al relé).
const EXPIRY_TICK_MS = 30_000

export function useRooms(
  myPubkey: string,
  myAccount: string,
  currentSlug: string | null,
  /** Se llama con cada mensaje nuevo (en vivo) que te menciona o responde a uno tuyo. */
  onDirected?: (event: { pubkey: string; content: string; slug: string }) => void,
) {
  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    listRooms()
      .then((r) => {
        setRooms(r)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Suscripción en vivo: una sala creada o editada (desde cualquier
  // dispositivo) aparece sin recargar. limit: 0 = solo lo nuevo; el estado
  // inicial ya lo trae listRooms. Mientras esa primera lista no ha llegado
  // (rooms === null) se ignora el evento: la lista lo incluirá o la siguiente
  // relectura lo recogerá.
  useEffect(() => {
    let cancelled = false
    let relay: Relay | null = null
    Relay.connect(RELAY_URL, { enableReconnect: true })
      .then((r) => {
        if (cancelled) {
          r.close()
          return
        }
        relay = r
        r.subscribe([{ kinds: [ROOM_META_KIND], limit: 0 }], {
          onevent(event) {
            const room = parseRoomEvent(event)
            if (room) setRooms((prev) => (prev === null ? prev : mergeRoom(prev, room)))
          },
        })
      })
      .catch(() => {
        // sin conexión en vivo seguimos con la relectura periódica
      })
    return () => {
      cancelled = true
      relay?.close()
    }
  }, [])

  // Mensajes por sala y no leídos: se recuentan al cambiar el conjunto de salas
  // y cada REFRESH_MS (también recoge los borrados); entre medias suben en vivo.
  // "Leído" = marca por sala guardada en este dispositivo; la sala abierta (con
  // la pestaña visible) se va marcando sola.
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  // Hora del último mensaje de cada sala (para ordenar por actividad).
  const [activity, setActivity] = useState<Map<string, number>>(new Map())
  const [unread, setUnread] = useState<Map<string, number>>(new Map())
  // De los no leídos, cuántos van dirigidos a mí (mención o respuesta).
  const [directed, setDirected] = useState<Map<string, number>>(new Map())
  const onDirectedRef = useRef(onDirected)
  useEffect(() => {
    onDirectedRef.current = onDirected
  }, [onDirected])
  const accountRef = useRef(myAccount)
  useEffect(() => {
    accountRef.current = myAccount
  }, [myAccount])
  const seenRef = useRef<LastSeen>(loadLastSeen())
  const currentRef = useRef(currentSlug)
  useEffect(() => {
    currentRef.current = currentSlug
  }, [currentSlug])

  const markRead = useCallback((slug: string, ts = Math.floor(Date.now() / 1000)) => {
    const next = markSeen(seenRef.current, slug, ts)
    if (next !== seenRef.current) {
      seenRef.current = next
      saveLastSeen(next)
    }
    const drop = (prev: Map<string, number>) => {
      if (!prev.has(slug)) return prev
      const m = new Map(prev)
      m.delete(slug)
      return m
    }
    setUnread(drop)
    setDirected(drop)
  }, [])

  // La sala abierta se marca leída al entrar, al volver a la pestaña y al salir.
  // (Al entrar el estado `unread` no se toca: la sala abierta se oculta al devolverlo;
  // se limpia de verdad al salir.)
  useEffect(() => {
    if (!currentSlug) return
    const stamp = () => {
      seenRef.current = markSeen(seenRef.current, currentSlug, Math.floor(Date.now() / 1000))
      saveLastSeen(seenRef.current)
    }
    stamp()
    const onVisible = () => {
      if (document.visibilityState === 'visible') markRead(currentSlug)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      markRead(currentSlug)
    }
  }, [currentSlug, markRead])

  const slugsKey = rooms === null ? null : rooms.map((r) => r.slug).sort().join('\n')
  useEffect(() => {
    if (slugsKey === null) return
    const slugs = slugsKey ? slugsKey.split('\n') : []
    let cancelled = false
    const load = () =>
      fetchRoomMessages(slugs)
        .then((events) => {
          if (cancelled) return
          const now = Math.floor(Date.now() / 1000)
          const baselined = withBaseline(seenRef.current, slugs, now)
          if (baselined !== seenRef.current) {
            seenRef.current = baselined
            saveLastSeen(baselined)
          }
          const cur = currentRef.current
          if (cur && document.visibilityState === 'visible') markRead(cur, now)
          setCounts(tallyMessages(events))
          setActivity(lastActivityByRoom(events))
          const u = tallyUnread(events, seenRef.current, myPubkey)
          const d = tallyUnread(events, seenRef.current, myPubkey, (e) => isForMe(e, accountRef.current, myPubkey))
          if (cur && document.visibilityState === 'visible') {
            u.delete(cur)
            d.delete(cur)
          }
          setUnread(u)
          setDirected(d)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, REFRESH_MS)
    let relay: Relay | null = null
    Relay.connect(RELAY_URL, { enableReconnect: true })
      .then((r) => {
        if (cancelled) return r.close()
        relay = r
        r.subscribe([{ kinds: [9], limit: 0 }], {
          onevent(event) {
            const slug = event.tags.find((t) => t[0] === 't')?.[1]
            if (!slug) return
            setCounts((prev) => new Map(prev).set(slug, (prev.get(slug) ?? 0) + 1))
            setActivity((prev) => new Map(prev).set(slug, Math.max(prev.get(slug) ?? 0, event.created_at)))
            if (event.pubkey === myPubkey) return
            if (isForMe(event, accountRef.current, myPubkey)) onDirectedRef.current?.({ pubkey: event.pubkey, content: event.content, slug })
            if (slug === currentRef.current && document.visibilityState === 'visible') {
              markRead(slug, event.created_at)
            } else if (seenRef.current[slug] !== undefined) {
              setUnread((prev) => new Map(prev).set(slug, (prev.get(slug) ?? 0) + 1))
              if (isForMe(event, accountRef.current, myPubkey)) {
                setDirected((prev) => new Map(prev).set(slug, (prev.get(slug) ?? 0) + 1))
              }
            }
          },
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      clearInterval(id)
      relay?.close()
    }
  }, [slugsKey, myPubkey, markRead])

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), EXPIRY_TICK_MS)
    return () => clearInterval(id)
  }, [])
  const visibleRooms = rooms === null ? null : rooms.filter((r) => !isRoomExpired(r, now))

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const create = useCallback(
    async (slug: string, name: string, adminPubkey: string, secretKey: Uint8Array, lifetimeSeconds: number) => {
      setCreating(true)
      setCreateError(null)
      try {
        await createRoom(slug, name, adminPubkey, secretKey, lifetimeSeconds)
        refresh()
        return true
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : String(err))
        return false
      } finally {
        setCreating(false)
      }
    },
    [refresh],
  )

  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  /** Igual que create, pero con estado propio para no pisar el del formulario de alta de sala. */
  const update = useCallback(
    async (slug: string, name: string, adminPubkey: string, secretKey: Uint8Array, lifetimeSeconds: number) => {
      setUpdating(true)
      setUpdateError(null)
      try {
        await createRoom(slug, name, adminPubkey, secretKey, lifetimeSeconds)
        refresh()
        return true
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : String(err))
        return false
      } finally {
        setUpdating(false)
      }
    },
    [refresh],
  )

  const shownUnread = (() => {
    if (!currentSlug || !unread.has(currentSlug)) return unread
    const m = new Map(unread)
    m.delete(currentSlug)
    return m
  })()

  return { rooms: visibleRooms, counts, activity, unread: shownUnread, directed, error, refresh, creating, createError, create, updating, updateError, update }
}
