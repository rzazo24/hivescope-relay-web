import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useHiveLink } from './useHiveLink'

export function LinkScreen() {
  const { t } = useTranslation()
  const { keychainStatus, linkStatus, submitting, error, link } = useHiveLink()
  const [account, setAccount] = useState('')

  if (linkStatus.state === 'checking') {
    return <p className="text-sm text-muted">{t('link.checkingLink')}</p>
  }

  if (linkStatus.state === 'linked') {
    return (
      <div className="text-sm">
        <p className="text-muted">{t('link.whoami')}</p>
        <p className="mt-1 text-lg font-bold text-ink">@{linkStatus.account}</p>
        <p className="mt-2 text-xs text-success">{t('link.linkedOk')}</p>
      </div>
    )
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = account.trim().toLowerCase()
    if (trimmed) link(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="account" className="mb-1.5 block text-xs text-muted">
          {t('link.accountLabel')}
        </label>
        <input
          id="account"
          type="text"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder={t('link.accountPlaceholder')}
          autoComplete="off"
          spellCheck={false}
          disabled={submitting}
          className="w-full rounded-md border border-border bg-code px-3 py-2.5 text-sm text-ink caret-accent outline-none focus:border-accent disabled:opacity-60"
        />
      </div>

      <KeychainBanner status={keychainStatus} />

      <button
        type="submit"
        disabled={submitting || !account.trim()}
        className="rounded-md bg-accent px-4 py-3 text-sm font-bold text-accent-ink shadow-[0_0_20px_-4px_rgba(0,255,162,0.6)] transition disabled:opacity-40 disabled:shadow-none"
      >
        {submitting ? t('link.submitting') : t('link.submit')}
      </button>

      {error && <p className="rounded-md bg-error-bg px-3 py-2.5 text-xs text-error">! {error}</p>}
    </form>
  )
}

function KeychainBanner({ status }: { status: 'checking' | 'found' | 'not-found' }) {
  const { t } = useTranslation()

  if (status === 'checking') {
    return <p className="text-xs text-muted">{t('link.keychainChecking')}</p>
  }
  if (status === 'found') {
    return <p className="text-xs text-success">{t('link.keychainFound')}</p>
  }
  return <p className="rounded-md bg-error-bg px-3 py-2.5 text-xs text-error">{t('link.keychainNotFound')}</p>
}
