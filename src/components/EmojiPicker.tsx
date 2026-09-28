import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EMOJIS } from '../lib/emojis'

function SmileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  )
}

/**
 * Botón + panel de emojis para el chat. Solo se muestra con puntero fino
 * (ratón): en móvil/tablet ya está el selector del teclado del dispositivo,
 * y un panel propio solo estorbaría. Se queda abierto al elegir (es habitual
 * poner varios seguidos) y se cierra con Escape, clic fuera o el propio botón.
 */
export function EmojiPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative hidden pointer-fine:block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('chat.emoji')}
        title={t('chat.emoji')}
        aria-expanded={open}
        className="flex h-full items-center rounded-md border border-border bg-code px-2.5 text-muted transition hover:border-accent hover:text-ink disabled:opacity-40"
      >
        <SmileIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('chat.emoji')}
          className="absolute bottom-full right-0 z-10 mb-2 w-72 rounded-md border border-border bg-surface p-2 shadow-[0_0_30px_-8px_rgba(0,255,162,0.35)]"
        >
          <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                className="rounded p-1 text-lg leading-none transition hover:bg-surface-2"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
