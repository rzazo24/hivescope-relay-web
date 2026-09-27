import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { TerminalWindow } from './components/TerminalWindow'
import { LinkScreen } from './features/link/LinkScreen'
import { useHiveLink } from './features/link/useHiveLink'
import { RoomList } from './features/rooms/RoomList'

function App() {
  const { t } = useTranslation()
  const { identity, keychainStatus, linkStatus, submitting, error, link } = useHiveLink()
  const linked = linkStatus.state === 'linked'

  // La pantalla de vinculación es solo un formulario chico: no hace falta
  // que crezca mucho. Salas/chat sí se benefician de más ancho en pantallas
  // grandes (lista de salas, mensajes), así que su tope crece más.
  const widthClass = linked
    ? 'max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl'
    : 'max-w-md sm:max-w-lg'

  return (
    <main className={`mx-auto flex min-h-svh w-full ${widthClass} flex-col justify-center gap-4 px-4 py-8 transition-[max-width]`}>
      <div className="flex items-start justify-between gap-3">
        <p className="cursor-blink text-xs text-muted">{linked ? t('rooms.prompt') : t('link.prompt')}</p>
        <LanguageSwitcher />
      </div>

      {!linked && (
        <div>
          <h1 className="text-2xl font-bold text-ink text-balance drop-shadow-[0_0_12px_rgba(0,255,162,0.35)]">
            {t('link.title')}
          </h1>
          <p className="mt-2 text-sm text-muted">{t('link.subtitle')}</p>
        </div>
      )}

      <TerminalWindow title={t('link.windowTitle')}>
        {linked ? (
          <RoomList identity={identity} account={linkStatus.account} />
        ) : (
          <LinkScreen
            checking={linkStatus.state === 'checking'}
            keychainStatus={keychainStatus}
            submitting={submitting}
            error={error}
            onLink={link}
          />
        )}
      </TerminalWindow>
    </main>
  )
}

export default App
