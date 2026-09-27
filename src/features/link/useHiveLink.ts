import { useCallback, useEffect, useMemo, useState } from 'react'
import { linkChallenge, requestHiveSignature, waitForKeychain } from '../../lib/hiveKeychain'
import { getOrCreateIdentity } from '../../lib/nostrIdentity'
import { findHiveLink, publishEvent } from '../../lib/relay'

export type KeychainStatus = 'checking' | 'found' | 'not-found'

export type LinkStatus = { state: 'checking' } | { state: 'unlinked' } | { state: 'linked'; account: string }

export function useHiveLink() {
  const identity = useMemo(() => getOrCreateIdentity(), [])

  const [keychainStatus, setKeychainStatus] = useState<KeychainStatus>('checking')
  const [linkStatus, setLinkStatus] = useState<LinkStatus>({ state: 'checking' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    waitForKeychain().then((found) => setKeychainStatus(found ? 'found' : 'not-found'))
  }, [])

  useEffect(() => {
    findHiveLink(identity.publicKey)
      .then((link) => setLinkStatus(link ? { state: 'linked', account: link.account } : { state: 'unlinked' }))
      .catch(() => setLinkStatus({ state: 'unlinked' }))
  }, [identity.publicKey])

  const link = useCallback(
    async (account: string) => {
      setSubmitting(true)
      setError(null)
      try {
        const challenge = linkChallenge(identity.publicKey)
        const hiveSig = await requestHiveSignature(account, challenge)

        await publishEvent(
          {
            kind: 30078,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ['d', 'hive-link'],
              ['hive_account', account],
              ['hive_sig', hiveSig],
              ['hive_key_type', 'posting'],
            ],
            content: '',
          },
          identity.secretKey,
        )

        setLinkStatus({ state: 'linked', account })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setSubmitting(false)
      }
    },
    [identity],
  )

  return { identity, keychainStatus, linkStatus, submitting, error, link }
}
