import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../lib/theme'

const THEMES: { value: Theme; key: string }[] = [
  { value: 'dark', key: 'theme.dark' },
  { value: 'light', key: 'theme.light' },
]

export function ThemeSwitcher() {
  const { t } = useTranslation()
  const [theme, setTheme] = useTheme()

  return (
    <div className="flex items-center gap-1 text-xs text-muted">
      <span>{t('theme.prompt')}</span>
      {THEMES.map(({ value, key }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          className={
            theme === value
              ? 'rounded bg-accent px-1.5 py-0.5 font-bold text-accent-ink'
              : 'rounded px-1.5 py-0.5 text-muted hover:text-ink'
          }
        >
          {t(key)}
        </button>
      ))}
    </div>
  )
}
