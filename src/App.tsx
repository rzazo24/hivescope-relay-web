import { LinkScreen } from './features/link/LinkScreen'

function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <div>
        <p className="text-xs font-bold tracking-widest text-accent uppercase">hivescope</p>
        <h1 className="mt-1 text-2xl font-extrabold text-balance">Vinculá tu cuenta de Hive</h1>
        <p className="mt-2 text-sm text-muted">
          Firmá con Hive Keychain para demostrar que controlás tu cuenta. Nunca compartimos ni vemos tu clave
          privada.
        </p>
      </div>

      <LinkScreen />
    </main>
  )
}

export default App
