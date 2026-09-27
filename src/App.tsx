import { TerminalWindow } from './components/TerminalWindow'
import { LinkScreen } from './features/link/LinkScreen'

function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <div>
        <p className="cursor-blink text-xs text-muted">$ whoami --hive</p>
        <h1 className="mt-2 text-2xl font-bold text-ink text-balance drop-shadow-[0_0_12px_rgba(0,255,162,0.35)]">
          Vinculá tu cuenta de Hive
        </h1>
        <p className="mt-2 text-sm text-muted">
          // Firmá con Hive Keychain para demostrar que controlás tu cuenta. Nunca compartimos ni vemos tu clave
          privada.
        </p>
      </div>

      <TerminalWindow title="hivescope@relay:~$">
        <LinkScreen />
      </TerminalWindow>
    </main>
  )
}

export default App
