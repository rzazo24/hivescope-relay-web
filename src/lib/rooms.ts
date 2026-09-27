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
  createdAt: number
  id: string
}

/** Exportada para poder probarla directamente: es la parte con más casos borde de listRooms. */
export function parseRoomEvent(event: {
  tags: string[][]
  pubkey: string
  created_at?: number
  id?: string
}): Room | null {
  const d = event.tags.find((t) => t[0] === 'd')?.[1]
  if (!d || !d.startsWith(ROOM_D_PREFIX)) return null

  const slug = d.slice(ROOM_D_PREFIX.length)
  const name = event.tags.find((t) => t[0] === 'name')?.[1]
  const admin = event.tags.find((t) => t[0] === 'admin')?.[1]
  if (!slug || !name || !admin) return null

  return { slug, name, admin, ownerPubkey: event.pubkey, createdAt: event.created_at ?? 0, id: event.id ?? '' }
}

/**
 * Compara dos versiones de la misma sala con el mismo criterio de empate que
 * usa el reemplazo NIP-33 del relé (eventstore/sqlite3.ReplaceEvent): mayor
 * created_at gana, y en empate el id mayor. Exportada para poder probarla
 * directamente, igual que parseRoomEvent.
 */
export function isNewerRoom(a: Room, b: Room): boolean {
  return a.createdAt > b.createdAt || (a.createdAt === b.createdAt && a.id > b.id)
}

/**
 * Trae todas las salas existentes. hivescope-relay (como cualquier relé
 * Nostr) no soporta filtrar por prefijo de tag "d" en el propio filtro, así
 * que pedimos todos los kind:30078 (que también incluyen los eventos
 * hive-link de cada usuario) y filtramos acá qué "d" empieza con "room:".
 *
 * El reemplazo NIP-33 del relé es por (pubkey, kind, d): una vez que se
 * delega la administración de una sala a otro pubkey, pueden quedar
 * guardadas legítimamente dos filas con el mismo "d" (la del dueño anterior
 * y la del admin delegado). Por eso acá se deduplica por slug quedándose
 * con la fila más nueva, igual que hace el relé en `findRoomOwnership`.
 */
export async function listRooms(): Promise<Room[]> {
  const relay = await Relay.connect(RELAY_URL)
  try {
    return await new Promise((resolve) => {
      const bySlug = new Map<string, Room>()

      const sub = relay.subscribe([{ kinds: [ROOM_META_KIND], limit: 500 }], {
        onevent(event) {
          const room = parseRoomEvent(event)
          if (!room) return
          const existing = bySlug.get(room.slug)
          if (!existing || isNewerRoom(room, existing)) bySlug.set(room.slug, room)
        },
        oneose() {
          sub.close()
          resolve([...bySlug.values()])
        },
      })
    })
  } finally {
    relay.close()
  }
}

/**
 * Crea una sala nueva, o actualiza sus metadatos si quien firma ya es su
 * dueña o su admin delegado. `adminPubkey` es explícito (en vez de siempre
 * derivarlo de `secretKey`) para poder editar una sala preservando su
 * `admin` actual sin reasignarlo silenciosamente a quien la está editando.
 */
export async function createRoom(slug: string, name: string, adminPubkey: string, secretKey: Uint8Array) {
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
