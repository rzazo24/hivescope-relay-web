import { useCallback, useEffect, useState } from 'react'
import { Relay } from 'nostr-tools/relay'
import { RELAY_URL } from '../../lib/config'
import { countMessagesByRoom, createRoom, isRoomExpired, listRooms, mergeRoom, parseRoomEvent, ROOM_META_KIND, type Room } from '../../lib/rooms'

// Cada cuánto se vuelve a pedir la lista completa. Las altas y ediciones llegan
// en vivo por la suscripción, pero cuando el relé borra una sala caducada no
// avisa a nadie, así que hay que releer para que desaparezca de verdad.
const REFRESH_MS = 60_000
// Cada cuánto se re-evalúa qué salas ya han caducado (sin ir al relé).
const EXPIRY_TICK_MS = 30_000

export function useRooms() {
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

  // Mensajes por sala: se recuentan al cambiar el conjunto de salas y cada
  // REFRESH_MS (también recoge los borrados); entre medias suben en vivo.
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const slugsKey = rooms === null ? null : rooms.map((r) => r.slug).sort().join('\n')
  useEffect(() => {
    if (slugsKey === null) return
    const slugs = slugsKey ? slugsKey.split('\n') : []
    let cancelled = false
    const load = () =>
      countMessagesByRoom(slugs)
        .then((c) => !cancelled && setCounts(c))
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
            if (slug) setCounts((prev) => new Map(prev).set(slug, (prev.get(slug) ?? 0) + 1))
          },
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      clearInterval(id)
      relay?.close()
    }
  }, [slugsKey])

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

  return { rooms: visibleRooms, counts, error, refresh, creating, createError, create, updating, updateError, update }
}
