/** Un evento kind 5 (NIP-09) tal como llega del relé, en lo que nos importa. */
export interface DeletionEvent {
  pubkey: string
  tags: string[][]
}

/**
 * ¿Es un mensaje "mío"? Lo es si lo envió este mismo pubkey o cualquier otro
 * pubkey vinculado a mi misma cuenta Hive (otro navegador/dispositivo): el
 * relé deja borrarlo en ambos casos. `accountsByPubkey` viene de
 * useHiveAccountNames. Solo decide si mostrar el botón; autoriza el relé.
 */
export function isOwnMessage(
  messagePubkey: string,
  myPubkey: string,
  myAccount: string,
  accountsByPubkey: ReadonlyMap<string, string>,
): boolean {
  if (messagePubkey === myPubkey) return true
  const mine = myAccount.toLowerCase()
  return mine !== '' && accountsByPubkey.get(messagePubkey)?.toLowerCase() === mine
}

/**
 * Aplica una petición de borrado NIP-09 a la lista de mensajes: quita los que
 * apunta con tags "e" SOLO si el autor del mensaje es quien pide el borrado
 * (`sameAuthor`: por defecto el mismo pubkey; el hook lo amplía a "misma cuenta
 * Hive" con las cuentas ya resueltas).
 * El relé ya lo exige (khatru compara pubkeys), pero un cliente no debe fiarse
 * de que todos los relés lo hagan. Devuelve la misma lista si no cambia nada,
 * para no provocar renders de más.
 */
export function applyDeletion<T extends { id: string; pubkey: string }>(
  messages: T[],
  deletion: DeletionEvent,
  sameAuthor: (messagePubkey: string, requesterPubkey: string) => boolean = (a, b) => a === b,
): T[] {
  const targets = new Set(deletion.tags.filter((t) => t[0] === 'e' && t[1]).map((t) => t[1]))
  if (targets.size === 0) return messages
  const next = messages.filter((m) => !(targets.has(m.id) && sameAuthor(m.pubkey, deletion.pubkey)))
  return next.length === messages.length ? messages : next
}
