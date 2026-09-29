// Reacciones (NIP-25, kind 7): un emoji de una lista cerrada sobre un mensaje.
// Quitarla es un borrado NIP-09 de ese evento. Las reacciones cuentan por cuenta
// Hive (dos dispositivos de una cuenta = una), igual que la presencia.

export const REACTION_KIND = 7
/** Idéntica a ReactionEmojis en hivescope-relay: si cambias una, cambia la otra. */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢'] as const

export interface Reaction {
  id: string
  pubkey: string
  emoji: string
  /** Id del mensaje al que reacciona. */
  target: string
}

/** Reacción a partir de un evento kind:7, o null si no es una válida (emoji fuera de lista, sin destino). */
export function parseReaction(event: { id: string; pubkey: string; content: string; tags: string[][] }): Reaction | null {
  if (!(REACTION_EMOJIS as readonly string[]).includes(event.content)) return null
  const target = event.tags.find((t) => t[0] === 'e')?.[1]
  return target ? { id: event.id, pubkey: event.pubkey, emoji: event.content, target } : null
}

/** Añade una reacción sin duplicar por id. Devuelve la misma lista si ya estaba. */
export function addReaction(list: Reaction[], r: Reaction): Reaction[] {
  return list.some((x) => x.id === r.id) ? list : [...list, r]
}

/** Quita las reacciones cuyos ids se borraron. Devuelve la misma lista si no cambia nada. */
export function removeReactions(list: Reaction[], ids: Set<string>): Reaction[] {
  return list.some((r) => ids.has(r.id)) ? list.filter((r) => !ids.has(r.id)) : list
}

export interface ReactionChip {
  emoji: string
  count: number
  /** Cuentas (o pubkeys sin resolver) que reaccionaron, para el tooltip. */
  who: string[]
  mine: boolean
}

/**
 * Agrupa las reacciones de un mensaje por emoji, contando cuentas distintas.
 * `accountOf` resuelve pubkey -> cuenta Hive (minúsculas); `isMine` dice si un
 * pubkey es mío o de otro dispositivo de mi cuenta. El orden de los emojis es el de
 * REACTION_EMOJIS, estable entre renders.
 */
export function chipsFor(
  reactions: Reaction[],
  target: string,
  accountOf: (pubkey: string) => string | undefined,
  isMine: (pubkey: string) => boolean,
): ReactionChip[] {
  const chips: ReactionChip[] = []
  for (const emoji of REACTION_EMOJIS) {
    const people = new Map<string, string>() // clave de persona -> etiqueta
    let mine = false
    for (const r of reactions) {
      if (r.target !== target || r.emoji !== emoji) continue
      const account = accountOf(r.pubkey)?.toLowerCase()
      people.set(account ?? r.pubkey, account ? `@${account}` : `${r.pubkey.slice(0, 8)}…`)
      if (isMine(r.pubkey)) mine = true
    }
    if (people.size > 0) chips.push({ emoji, count: people.size, who: [...people.values()].sort(), mine })
  }
  return chips
}

/** Ids de MIS reacciones (de cualquier dispositivo de mi cuenta) con ese emoji sobre ese mensaje: lo que hay que borrar para quitarla. */
export function myReactionIds(reactions: Reaction[], target: string, emoji: string, isMine: (pubkey: string) => boolean): string[] {
  return reactions.filter((r) => r.target === target && r.emoji === emoji && isMine(r.pubkey)).map((r) => r.id)
}
