import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { OnlinePerson } from '../lib/presence'

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-3.6 3.1-6 7-6s7 2.4 7 6z" />
      <circle cx="17" cy="9" r="3" />
      <path d="M17.6 14.2c3 .3 5.4 2.2 5.4 5.3V20h-5.3c-.1-2.2-.9-4-2.3-5.3.6-.4 1.4-.6 2.2-.5z" />
    </svg>
  )
}

function shortKey(key: string) {
  return `${key.slice(0, 8)}…`
}

/**
 * Icono de personas + número de cuentas en línea. Sin `people` es solo una
 * etiqueta (filas de la lista de salas, que ya son un botón). Con `people`,
 * al pulsarlo se despliega la lista de quién está conectado; `showRooms`
 * añade en qué sala está cada uno (útil en el total, no dentro de una sala).
 */
export function OnlineBadge({
  count,
  people,
  myAccount = '',
  showRooms = false,
}: {
  count: number
  people?: OnlinePerson[]
  myAccount?: string
  showRooms?: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const label = t('presence.online', { count })

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

  const content = (
    <>
      <UsersIcon />
      {count}
    </>
  )

  if (!people) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent" title={label} aria-label={label}>
        {content}
      </span>
    )
  }

  const me = myAccount.toLowerCase()
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded text-xs text-accent transition hover:brightness-125"
      >
        {content}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-full z-10 mt-2 w-56 rounded-md border border-border bg-surface p-2 text-xs shadow-[0_0_30px_-8px_rgba(0,255,162,0.35)]"
        >
          <p className="px-1 pb-1.5 text-muted">{label}</p>
          {people.length === 0 ? (
            <p className="px-1 py-1 text-muted">{t('presence.empty')}</p>
          ) : (
            <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
              {people.map((p) => (
                <li key={p.key} className="flex items-baseline justify-between gap-2 rounded px-1 py-0.5 hover:bg-surface-2">
                  <span className="truncate text-ink">
                    {p.account ? `@${p.account}` : shortKey(p.key)}
                    {p.account !== null && p.account === me && <span className="text-muted"> ({t('presence.you')})</span>}
                  </span>
                  {showRooms && p.rooms.length > 0 && <span className="shrink-0 truncate text-muted">{p.rooms.join(', ')}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
