import { useTranslation } from 'react-i18next'

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

/** Icono de personas + número de cuentas en línea. */
export function OnlineBadge({ count }: { count: number }) {
  const { t } = useTranslation()
  const label = t('presence.online', { count })
  return (
    <span className="inline-flex items-center gap-1 text-xs text-accent" title={label} aria-label={label}>
      <UsersIcon />
      {count}
    </span>
  )
}
