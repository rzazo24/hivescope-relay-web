import { useCallback, useEffect, useState } from 'react'
import { createRoom, listRooms, type Room } from '../../lib/rooms'

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
  }, [refresh])

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const create = useCallback(
    async (slug: string, name: string, adminPubkey: string, secretKey: Uint8Array, lifetimeDays: number) => {
      setCreating(true)
      setCreateError(null)
      try {
        await createRoom(slug, name, adminPubkey, secretKey, lifetimeDays)
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
    async (slug: string, name: string, adminPubkey: string, secretKey: Uint8Array, lifetimeDays: number) => {
      setUpdating(true)
      setUpdateError(null)
      try {
        await createRoom(slug, name, adminPubkey, secretKey, lifetimeDays)
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

  return { rooms, error, refresh, creating, createError, create, updating, updateError, update }
}
