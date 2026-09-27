import { type FormEvent, useState } from 'react'
import { useHiveLink } from './useHiveLink'

export function LinkScreen() {
  const { keychainStatus, linkStatus, submitting, error, link } = useHiveLink()
  const [account, setAccount] = useState('')

  if (linkStatus.state === 'checking') {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
        Comprobando si ya estás vinculado…
      </div>
    )
  }

  if (linkStatus.state === 'linked') {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">Vinculado con la cuenta Hive</p>
        <p className="mt-1 text-xl font-bold text-ink">@{linkStatus.account}</p>
      </div>
    )
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = account.trim().toLowerCase()
    if (trimmed) link(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div>
        <label htmlFor="account" className="mb-1.5 block text-xs font-semibold text-muted">
          Cuenta de Hive
        </label>
        <input
          id="account"
          type="text"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="tu-usuario"
          autoComplete="off"
          spellCheck={false}
          disabled={submitting}
          className="w-full rounded-lg border border-border bg-code px-3 py-2.5 font-mono text-sm text-ink outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        />
      </div>

      <KeychainBanner status={keychainStatus} />

      <button
        type="submit"
        disabled={submitting || !account.trim()}
        className="rounded-lg bg-accent px-4 py-3 text-sm font-bold text-accent-ink transition disabled:opacity-50"
      >
        {submitting ? 'Esperando a Keychain…' : 'Vincular con Hive Keychain'}
      </button>

      {error && (
        <p className="rounded-lg bg-error-bg px-3 py-2.5 text-sm text-error">{error}</p>
      )}
    </form>
  )
}

function KeychainBanner({ status }: { status: 'checking' | 'found' | 'not-found' }) {
  if (status === 'checking') {
    return <p className="text-xs text-muted">🔎 Buscando Hive Keychain…</p>
  }
  if (status === 'found') {
    return <p className="text-xs text-success">✅ Hive Keychain detectado.</p>
  }
  return (
    <p className="rounded-lg bg-error-bg px-3 py-2.5 text-xs text-error">
      ⚠️ No se detectó Hive Keychain todavía. Si tenés la extensión o la app instalada, probá igual — a veces
      tarda en inyectarse.
    </p>
  )
}
