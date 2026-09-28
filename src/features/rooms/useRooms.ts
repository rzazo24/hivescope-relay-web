import { useCallback, useEffect, useState } from 'react'
import { Relay } from 'nostr-tools/relay'
import { RELAY_URL } from '../../lib/config'
import { createRoom, isRoomExpired, listRooms, mergeRoom, parseRoomEvent, ROOM_META_KIND, type Room } from '../../lib/rooms'

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

  return { rooms: visibleRooms, error, refresh, creating, createError, create, updating, updateError, update }
}
