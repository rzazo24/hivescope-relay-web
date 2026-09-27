import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpModal } from './components/HelpModal'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { TerminalWindow } from './components/TerminalWindow'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { LinkScreen } from './features/link/LinkScreen'
import { useHiveLink } from './features/link/useHiveLink'
import { RoomList } from './features/rooms/RoomList'

function App() {
  const { t } = useTranslation()
  const { identity, keychainStatus, linkStatus, submitting, error, link } = useHiveLink()
  const linked = linkStatus.state === 'linked'
  const [helpOpen, setHelpOpen] = useState(false)

  // La pantalla de vinculación es solo un formulario chico: no hace falta
  // que crezca mucho. Salas/chat sí se benefician de más ancho en pantallas
  // grandes (lista de salas, mensajes), así que su tope crece más.
  const widthClass = linked
    ? 'max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl'
    : 'max-w-md sm:max-w-lg'

  return (
    // En móvil el contenido arranca cerca del borde superior (con poco
    // padding), en vez de quedar centrado en todo el alto de la pantalla:
    // centrado, en una vista corta como la de salas, dejaba más de la mitad
    // de la pantalla vacía arriba y abajo. Desde `sm` para arriba sí se
    // centra, que es donde sobra espacio de verdad.
    <main
      className={`mx-auto flex min-h-svh w-full ${widthClass} flex-col justify-start gap-4 px-4 py-4 transition-[max-width] sm:justify-center sm:py-8`}
    >
      {/* En la pantalla de vinculación la marca es el título grande (logo +
          "HiveScope Chat"), así que no hace falta repetirla arriba también:
          esa fila chica solo aparece una vez vinculado, cuando ya no hay
          ningún h1 haciendo de marca en la pantalla. */}
      {linked && (
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-5 w-5 rounded" />
          <span className="text-sm font-bold tracking-wide text-ink">HiveScope Chat</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <p className="cursor-blink text-xs text-muted">{linked ? t('rooms.prompt') : t('link.prompt')}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="text-xs text-muted underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            {t('help.trigger')}
          </button>
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {!linked && (
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt=""
              className="h-10 w-10 shrink-0 rounded-md drop-shadow-[0_0_12px_rgba(0,255,162,0.35)]"
            />
            <h1 className="text-2xl font-bold text-ink text-balance drop-shadow-[0_0_12px_rgba(0,255,162,0.35)]">
              {t('link.title')}
            </h1>
          </div>
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
