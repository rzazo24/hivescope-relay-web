function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <p className="text-xs font-bold tracking-widest text-accent uppercase">
        hivescope
      </p>
      <h1 className="text-2xl font-extrabold text-balance">
        Chat descentralizado vinculado a Hive
      </h1>
      <p className="text-sm text-muted">
        Base del proyecto lista: Vite + React + TypeScript + Tailwind, con
        los tokens de diseño de hivescope-relay ya cableados.
      </p>
      <div className="rounded-xl border border-border bg-surface p-4 font-mono text-xs text-muted">
        wss://relay.hivescope.xyz
      </div>
    </main>
  )
}

export default App
