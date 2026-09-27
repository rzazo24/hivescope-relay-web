import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { TerminalWindow } from './components/TerminalWindow'
import { LinkScreen } from './features/link/LinkScreen'

function App() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <p className="cursor-blink text-xs text-muted">{t('link.prompt')}</p>
        <LanguageSwitcher />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-ink text-balance drop-shadow-[0_0_12px_rgba(0,255,162,0.35)]">
          {t('link.title')}
        </h1>
        <p className="mt-2 text-sm text-muted">{t('link.subtitle')}</p>
      </div>

      <TerminalWindow title={t('link.windowTitle')}>
        <LinkScreen />
      </TerminalWindow>
    </main>
  )
}

export default App
