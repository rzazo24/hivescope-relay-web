import { useTranslation } from 'react-i18next'

const LANGS = [
  { code: 'en', label: 'en' },
  { code: 'es', label: 'es' },
] as const

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="flex items-center gap-1 text-xs text-muted" aria-label="language">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => i18n.changeLanguage(code)}
          aria-pressed={current === code}
          className={
            current === code
              ? 'rounded bg-accent px-1.5 py-0.5 font-bold text-accent-ink'
              : 'rounded px-1.5 py-0.5 text-muted hover:text-ink'
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
}
