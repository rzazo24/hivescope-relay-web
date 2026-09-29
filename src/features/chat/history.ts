import type { ChatMessage } from './useChatRoom'
import { parseReplyTo } from './mentions'

/** Mensajes que se piden al entrar en una sala. */
export const INITIAL_PAGE = 200
/** Mensajes que se piden cada vez que se sube a por más historial. */
export const OLDER_PAGE = 100

/** Evento kind:9 -> mensaje de la UI. */
export function toChatMessage(event: { id: string; pubkey: string; content: string; created_at: number; tags: string[][] }): ChatMessage {
  return {
    id: event.id,
    pubkey: event.pubkey,
    content: event.content,
    createdAt: event.created_at,
    replyTo: parseReplyTo(event.tags),
    mentioned: event.tags.filter((t) => t[0] === 'p').map((t) => t[1]),
  }
}

/**
 * Mezcla mensajes nuevos con los que ya hay: sin repetidos (por id) y por fecha
 * (el id desempata para que el orden sea estable). Devuelve la misma lista si no
 * aporta nada, para no provocar renders de más.
 */
export function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const known = new Set(prev.map((m) => m.id))
  const fresh = incoming.filter((m) => !known.has(m.id) && known.add(m.id))
  if (fresh.length === 0) return prev
  return [...prev, ...fresh].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
}

/** ¿Puede haber más historial? Una página llena sugiere que sí; una a medias, que no. */
export function mayHaveMore(received: number, pageSize: number): boolean {
  return received >= pageSize
}
