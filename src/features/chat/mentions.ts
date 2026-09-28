import { insertAtCursor } from '../../lib/emojis'

// Menciones (@cuenta) y respuestas de los mensajes de chat. Todo va dentro del
// propio kind:9, sin tocar el relé: la mención es texto y la respuesta son tags
// NIP-10 (`e` con marcador "reply" + `p` con el autor citado).

const ACCOUNT = '[a-z][a-z0-9-]{1,15}(?:\\.[a-z][a-z0-9-]{1,15})*'
const MENTION_RE = new RegExp(`(^|[^\\w@.-])@(${ACCOUNT})`, 'gi')

export type Piece = { text: string; account?: string }

/** Parte el texto en trozos, marcando con `account` (en minúsculas) los que son una mención. */
export function splitMentions(text: string): Piece[] {
  const pieces: Piece[] = []
  let last = 0
  for (const m of text.matchAll(MENTION_RE)) {
    const start = (m.index ?? 0) + m[1].length
    if (start > last) pieces.push({ text: text.slice(last, start) })
    pieces.push({ text: `@${m[2]}`, account: m[2].toLowerCase() })
    last = start + m[2].length + 1
  }
  if (last < text.length) pieces.push({ text: text.slice(last) })
  return pieces
}

/** ¿El mensaje menciona (@) a esta cuenta Hive? Sin distinguir mayúsculas. */
export function mentionsAccount(content: string, account: string): boolean {
  if (!account) return false
  const a = account.toLowerCase()
  return splitMentions(content).some((p) => p.account === a)
}

/** Si el cursor está escribiendo una mención, dónde empieza (el @) y lo escrito tras ella. */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|[^\w@.-])@([a-z0-9.-]*)$/i.exec(text.slice(0, caret))
  if (!m) return null
  return { start: caret - m[2].length - 1, query: m[2].toLowerCase() }
}

/** Sustituye la mención a medio escribir por `@account ` y devuelve el texto y la posición del cursor. */
export function applyMention(text: string, start: number, caret: number, account: string) {
  const insert = `@${account} `
  return { text: text.slice(0, start) + insert + text.slice(caret), caret: start + insert.length }
}

/** Inserta `@account ` en el cursor (o sobre la selección), separándolo con un espacio del texto previo si hace falta. */
export function insertMention(text: string, start: number, end: number, account: string) {
  const s = Math.max(0, Math.min(start, text.length))
  const before = s > 0 && !/\s/.test(text[s - 1]) ? ' ' : ''
  return insertAtCursor(text, start, end, `${before}@${account} `)
}

/** Cuentas que empiezan por `query`, sin repetir ni incluir la propia; máximo `limit`. */
export function mentionCandidates(accounts: string[], query: string, me: string, limit = 5): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of [...accounts].sort()) {
    const k = a.toLowerCase()
    if (k === me.toLowerCase() || seen.has(k) || !k.startsWith(query)) continue
    seen.add(k)
    out.push(a)
    if (out.length >= limit) break
  }
  return out
}

/** Tags de un mensaje que responde a `parent`. */
export function replyTags(parent: { id: string; pubkey: string }): string[][] {
  return [
    ['e', parent.id, '', 'reply'],
    ['p', parent.pubkey],
  ]
}

/** Id del mensaje al que responde este evento (o null). */
export function parseReplyTo(tags: string[][]): string | null {
  const marked = tags.find((t) => t[0] === 'e' && t[3] === 'reply')
  return marked?.[1] ?? null
}

/** ¿Es una respuesta a un mensaje de este pubkey? (tag p) */
export function repliesToPubkey(tags: string[][], pubkey: string): boolean {
  return parseReplyTo(tags) !== null && tags.some((t) => t[0] === 'p' && t[1] === pubkey)
}

/** Recorte de una cita para la vista previa. */
export function quoteSnippet(content: string, max = 80): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/** ¿Este mensaje va dirigido a mí? (me menciona o responde a un mensaje mío) */
export function isForMe(event: { tags: string[][]; content: string }, account: string, pubkey: string): boolean {
  return mentionsAccount(event.content, account) || repliesToPubkey(event.tags, pubkey)
}
