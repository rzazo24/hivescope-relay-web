import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from './components/ConfirmModal'
import { HelpModal } from './components/HelpModal'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { TerminalWindow } from './components/TerminalWindow'
import { OnlineBadge } from './components/OnlineBadge'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { LinkScreen } from './features/link/LinkScreen'
import { useHiveLink } from './features/link/useHiveLink'
import { RoomList } from './features/rooms/RoomList'
import { OnlineProvider, usePresence } from './hooks/usePresence'
import { useNotifyState } from './hooks/useNotifyState'
import { setNotifyEnabled } from './lib/notifications'
import { useRoomRoute } from './hooks/useRoomRoute'

function App() {
  const { t } = useTranslation()
  const { identity, keychainStatus, linkStatus, submitting, error, link, logout } = useHiveLink()
  const linked = linkStatus.state === 'linked'
  const [helpOpen, setHelpOpen] = useState(false)
  // Presencia: mientras estás vinculado, anuncias en qué sala estás y ves cuántas
  // cuentas hay en línea (en total, por sala en la lista y en la cabecera).
  const { slug: currentRoom } = useRoomRoute()
  const online = usePresence(identity, currentRoom, linked)
  const notify = useNotifyState()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  // La pantalla de vinculación es solo un formulario chico: no hace falta
  // que crezca mucho. Salas/chat sí se benefician de más ancho en pantallas
  // grandes (lista de salas, mensajes), así que su tope crece más.
  const widthClass = linked
    ? 'max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-screen-2xl'
    : 'max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl'

  return (
    // El contenido siempre arranca pegado arriba (móvil y escritorio): centrado
    // verticalmente dejaba mucho hueco vacío arriba y abajo en vistas cortas
    // como la lista de salas. En pantallas grandes el contenedor crece con el
    // ancho para no dejar tanto margen lateral.
    <OnlineProvider value={online}>
    <main
      className={`mx-auto flex min-h-svh w-full ${widthClass} flex-col justify-start gap-4 px-4 py-4 transition-[max-width] sm:px-6 sm:py-6`}
    >
      {/* En la pantalla de vinculación la marca es el título grande (logo +
          "HiveScope Chat"), así que no hace falta repetirla arriba también:
          esa fila chica solo aparece una vez vinculado, cuando ya no hay
          ningún h1 haciendo de marca en la pantalla. */}
      {linked && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-5 w-5 rounded" />
            <span className="text-sm font-bold tracking-wide text-ink">HiveScope Chat</span>
          </div>
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="text-xs text-muted underline decoration-dotted underline-offset-2 hover:text-error"
          >
            {t('link.logout')}
          </button>
        </div>
      )}

      {logoutConfirmOpen && (
        <ConfirmModal
          title={`$ ${t('link.logout')}`}
          message={t('link.logoutConfirm', { account: linkStatus.state === 'linked' ? linkStatus.account : '' })}
          confirmLabel={t('link.logoutConfirmButton')}
          cancelLabel={t('link.logoutCancel')}
          onConfirm={logout}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
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
          {linked && notify !== 'unsupported' && (
            <button
              type="button"
              onClick={() => void setNotifyEnabled(notify !== 'on')}
              disabled={notify === 'blocked'}
              aria-pressed={notify === 'on'}
              title={notify === 'blocked' ? t('notify.blocked') : t('notify.title')}
              className={`text-xs underline decoration-dotted underline-offset-2 disabled:no-underline disabled:opacity-50 ${notify === 'on' ? 'text-accent' : 'text-muted hover:text-ink'}`}
            >
              {notify === 'on' ? t('notify.on') : t('notify.off')}
            </button>
          )}
          {linked && (
            <OnlineBadge
              count={online.total}
              people={online.people}
              myAccount={linkStatus.state === 'linked' ? linkStatus.account : ''}
              showRooms
            />
          )}
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
    </OnlineProvider>
  )
}

export default App
