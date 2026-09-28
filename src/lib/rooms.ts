import { Relay } from 'nostr-tools/relay'
import { RELAY_URL } from './config'
import { publishEvent } from './relay'

export const ROOM_D_PREFIX = 'room:'
export const ROOM_META_KIND = 30078

/**
 * Duraciones disponibles para una sala antes de expirar (NIP-40) -- quien
 * la crea o edita elige una de estas cada vez que publica sus metadatos
 * (crear, renombrar, delegar admin, o simplemente volver a guardarla sin
 * cambios), lo que también la "renueva" desde ese momento -- ver
 * NewRoomMetaPolicy/internal/roomsweep en hivescope-relay para el porqué
 * (un barrido propio del relé borra la sala al expirar y, después, sus
 * mensajes).
 *
 * El relé aplica la caducidad él mismo (internal/roomsweep, al arrancar y
 * cada 5 minutos), así que hasta 1h se cumple con unos minutos de margen.
 */
export const ROOM_LIFETIME_OPTIONS = [
  { label: '1h', seconds: 60 * 60 },
  { label: '24h', seconds: 24 * 60 * 60 },
  { label: '7d', seconds: 7 * 24 * 60 * 60 },
  { label: '30d', seconds: 30 * 24 * 60 * 60 },
  { label: '90d', seconds: 90 * 24 * 60 * 60 },
] as const
export const DEFAULT_ROOM_LIFETIME_SECONDS: (typeof ROOM_LIFETIME_OPTIONS)[number]['seconds'] = 30 * 24 * 60 * 60

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
  /** Unix seconds (NIP-40 "expiration" tag), o 0 si el evento no trae uno válido (no debería pasar para salas creadas después de que este tag se hizo obligatorio, pero datos viejos o malformados podrían no tenerlo). */
  expiresAt: number
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

  const expirationTag = event.tags.find((t) => t[0] === 'expiration')?.[1]
  const expiresAt = Number(expirationTag)

  return {
    slug,
    name,
    admin,
    ownerPubkey: event.pubkey,
    createdAt: event.created_at ?? 0,
    id: event.id ?? '',
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
  }
}

/**
 * Formatea cuánto le queda a una sala antes de expirar, redondeado a la
 * unidad más grande que tenga sentido ("3d", "5h", "12m") -- no es un
 * contador en vivo, solo una foto de lo que falta al momento de pedir la
 * lista de salas. Exportada para poder probarla directamente.
 */
export function formatTimeRemaining(expiresAt: number, now: number = Math.floor(Date.now() / 1000)): string | null {
  if (expiresAt <= 0) return null // sin dato de expiración (sala vieja, o evento malformado)

  const secondsLeft = expiresAt - now
  if (secondsLeft <= 0) return null // ya debería haber sido borrada; no mostrar un dato engañoso

  const days = Math.floor(secondsLeft / 86400)
  if (days >= 1) return `${days}d`
  const hours = Math.floor(secondsLeft / 3600)
  if (hours >= 1) return `${hours}h`
  const minutes = Math.max(1, Math.floor(secondsLeft / 60))
  return `${minutes}m`
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
 * `lifetimeSeconds` fija la nueva fecha de caducidad (NIP-40) a partir de
 * ahora, sea sala nueva o una que ya existía.
 */
export async function createRoom(
  slug: string,
  name: string,
  adminPubkey: string,
  secretKey: Uint8Array,
  lifetimeSeconds: number = DEFAULT_ROOM_LIFETIME_SECONDS,
) {
  const now = Math.floor(Date.now() / 1000)

  await publishEvent(
    {
      kind: ROOM_META_KIND,
      created_at: now,
      tags: [
        ['d', `${ROOM_D_PREFIX}${slug}`],
        ['name', name],
        ['admin', adminPubkey],
        ['expiration', String(now + lifetimeSeconds)],
      ],
      content: '',
    },
    secretKey,
  )
}

/**
 * Si el usuario debería ver el botón "editar" de una sala. Cuenta como
 * dueño/admin: el pubkey exacto, o cualquier otro pubkey (otro
 * navegador/dispositivo) vinculado a la MISMA cuenta Hive que el dueño o el
 * admin -- igual que decide el relé (sharesHiveAccount en roommeta.go); la
 * identidad real es la cuenta Hive, el pubkey de Nostr es solo la clave de
 * sesión de cada dispositivo. `accountsByPubkey` es lo que ya resolvió
 * useHiveAccountNames. Puramente cosmético: el relé es quien autoriza.
 */
export function canManageRoom(
  room: Pick<Room, 'ownerPubkey' | 'admin'>,
  publicKey: string,
  account: string,
  accountsByPubkey: ReadonlyMap<string, string>,
  isSuperadmin = false,
): boolean {
  if (isSuperadmin || publicKey === room.ownerPubkey || publicKey === room.admin) return true
  const mine = account.toLowerCase()
  if (!mine) return false
  return [room.ownerPubkey, room.admin].some((pk) => accountsByPubkey.get(pk)?.toLowerCase() === mine)
}

/**
 * Incorpora a la lista una versión de sala que llegó en vivo: la añade si es
 * nueva, reemplaza a la que ya estaba si es más reciente (mismo criterio que
 * listRooms), y devuelve la MISMA lista si no cambia nada (evita renders de
 * más). Exportada para poder probarla.
 */
export function mergeRoom(rooms: Room[], incoming: Room): Room[] {
  const i = rooms.findIndex((r) => r.slug === incoming.slug)
  if (i === -1) return [...rooms, incoming]
  if (!isNewerRoom(incoming, rooms[i])) return rooms
  const next = rooms.slice()
  next[i] = incoming
  return next
}

/**
 * ¿Ya pasó la caducidad de la sala? El relé la borra con su barrido (cada
 * pocos minutos) y ese borrado no se avisa a los clientes, así que la lista
 * las oculta por su cuenta en cuanto pasan. Sin dato de expiración (salas
 * anteriores a que existiera el tag) nunca se consideran caducadas.
 */
export function isRoomExpired(room: Pick<Room, 'expiresAt'>, now: number = Math.floor(Date.now() / 1000)): boolean {
  return room.expiresAt > 0 && room.expiresAt <= now
}
