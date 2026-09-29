import { splitMentions } from './mentions'

/** Máximo de caracteres de un mensaje; el relé lo impone igual (MaxChatMessageLength en hivescope-relay). */
export const MAX_MESSAGE_LENGTH = 2000

export type MessagePiece = { text: string; account?: string; url?: string }

const URL_RE = /https?:\/\/[^\s<>"']+/gi
// Puntuación que casi siempre es del texto y no de la URL ("mira https://x.com.").
const TRAILING = /[.,;:!?)\]}]+$/

/**
 * Parte un mensaje en texto, menciones (@cuenta) y enlaces http(s). Los enlaces se
 * separan primero para que un "@algo" dentro de una URL no cuente como mención.
 * Solo http/https: nada de javascript: ni otros esquemas.
 */
export function splitMessage(text: string): MessagePiece[] {
  const pieces: MessagePiece[] = []
  let last = 0
  const pushPlain = (chunk: string) => {
    if (chunk) pieces.push(...splitMentions(chunk))
  }
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0
    const raw = m[0]
    const url = raw.replace(TRAILING, '')
    let valid = false
    try {
      const u = new URL(url)
      valid = (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.')
    } catch {
      valid = false
    }
    if (!valid) continue
    pushPlain(text.slice(last, start))
    pieces.push({ text: url, url })
    last = start + url.length
  }
  pushPlain(text.slice(last))
  return pieces
}
