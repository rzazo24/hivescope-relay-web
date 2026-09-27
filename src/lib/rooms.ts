import { getPublicKey } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { RELAY_URL } from './config'
import { publishEvent } from './relay'

export const ROOM_D_PREFIX = 'room:'
export const ROOM_META_KIND = 30078

/** Normaliza un nombre de sala a un slug válido para el tag "d": minúsculas, sin espacios. */
export function slugifyRoom(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export interface Room {
  slug: string
  name: string
  admin: string
  ownerPubkey: string
}

function parseRoomEvent(event: { tags: string[][]; pubkey: string }): Room | null {
  const d = event.tags.find((t) => t[0] === 'd')?.[1]
  if (!d || !d.startsWith(ROOM_D_PREFIX)) return null

  const slug = d.slice(ROOM_D_PREFIX.length)
  const name = event.tags.find((t) => t[0] === 'name')?.[1]
  const admin = event.tags.find((t) => t[0] === 'admin')?.[1]
  if (!slug || !name || !admin) return null

  return { slug, name, admin, ownerPubkey: event.pubkey }
}

/**
 * Trae todas las salas existentes. hivescope-relay (como cualquier relé
 * Nostr) no soporta filtrar por prefijo de tag "d" en el propio filtro, así
 * que pedimos todos los kind:30078 (que también incluyen los eventos
 * hive-link de cada usuario) y filtramos acá qué "d" empieza con "room:".
 */
export async function listRooms(): Promise<Room[]> {
  const relay = await Relay.connect(RELAY_URL)
  try {
    return await new Promise((resolve) => {
      const rooms: Room[] = []

      const sub = relay.subscribe([{ kinds: [ROOM_META_KIND], limit: 500 }], {
        onevent(event) {
          const room = parseRoomEvent(event)
          if (room) rooms.push(room)
        },
        oneose() {
          sub.close()
          resolve(rooms)
        },
      })
    })
  } finally {
    relay.close()
  }
}

/** Crea (o actualiza, si ya sos su dueño) una sala. */
export async function createRoom(slug: string, name: string, secretKey: Uint8Array) {
  const adminPubkey = getPublicKey(secretKey)

  await publishEvent(
    {
      kind: ROOM_META_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', `${ROOM_D_PREFIX}${slug}`],
        ['name', name],
        ['admin', adminPubkey],
      ],
      content: '',
    },
    secretKey,
  )
}
