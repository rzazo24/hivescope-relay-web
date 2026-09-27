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
    async (slug: string, name: string, secretKey: Uint8Array) => {
      setCreating(true)
      setCreateError(null)
      try {
        await createRoom(slug, name, secretKey)
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

  return { rooms, error, refresh, creating, createError, create }
}
