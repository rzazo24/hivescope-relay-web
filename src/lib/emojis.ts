/** Selección corta de emojis de uso común para el selector de escritorio (en móvil se usa el teclado del dispositivo). */
export const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
  '😋', '😜', '🤪', '😎', '🤓', '🤔', '🤨', '😐', '😶', '🙄', '😏', '😴', '🤤', '😬', '🤯', '😳',
  '😢', '😭', '😤', '😡', '🥺', '😱', '😨', '🤗', '🤫', '🤭', '🫡', '🫠', '😈', '💀', '👻', '🤖',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👌', '✌️', '🤞', '🤝', '👋', '🫶', '👀', '🧠', '💯', '🔥',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💖', '✨', '⭐', '🌟', '⚡', '🎉', '🎊',
  '🚀', '💡', '📌', '📎', '🔒', '🔑', '💻', '⌨️', '🖥️', '📱', '🔧', '⚙️', '🔗', '📈', '🐝', '🍯',
  '🐶', '🐱', '🦊', '🐻', '🐼', '🦁', '🐸', '🐧', '🦄', '🌈', '☀️', '🌙', '🌍', '🌱', '🍀', '🌸',
  '🍕', '🍔', '🍟', '🍺', '🍷', '☕', '🍰', '🍎', '🏆', '⚽', '🎮', '🎧', '🎵', '✅', '❌', '❗',
] as const

/**
 * Inserta `insert` en `text` reemplazando la selección [start, end) y devuelve
 * el texto nuevo y dónde debe quedar el cursor (justo después de lo insertado).
 * Pura, para poder probarla sin DOM.
 */
export function insertAtCursor(text: string, start: number, end: number, insert: string) {
  const s = Math.max(0, Math.min(start, text.length))
  const e = Math.max(s, Math.min(end, text.length))
  return { text: text.slice(0, s) + insert + text.slice(e), caret: s + insert.length }
}
