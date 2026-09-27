import { afterEach, describe, expect, it } from 'vitest'
import { linkChallenge, requestHiveSignature, waitForKeychain } from './hiveKeychain'

afterEach(() => {
  delete window.hive_keychain
})

describe('linkChallenge', () => {
  it('matches the exact format expected by hivescope-relay (LinkChallenge in hivelink.go)', () => {
    // Cualquier cambio acá rompe todas las vinculaciones ya firmadas por
    // usuarios reales -- este test existe justamente para que un cambio así
    // sea intencional, no accidental.
    expect(linkChallenge('abc123')).toBe('hivescope-relay-link:abc123')
  })
})

describe('waitForKeychain', () => {
  it('resolves true immediately if window.hive_keychain is already present', async () => {
    window.hive_keychain = { requestSignBuffer: () => {} }
    await expect(waitForKeychain(1000, 10)).resolves.toBe(true)
  })

  it('resolves true if hive_keychain appears while polling', async () => {
    setTimeout(() => {
      window.hive_keychain = { requestSignBuffer: () => {} }
    }, 20)
    await expect(waitForKeychain(1000, 10)).resolves.toBe(true)
  })

  it('resolves false if hive_keychain never appears before the timeout', async () => {
    await expect(waitForKeychain(50, 10)).resolves.toBe(false)
  })
})

describe('requestHiveSignature', () => {
  it('rejects immediately if hive_keychain is not available', async () => {
    await expect(requestHiveSignature('rzazo24', 'msg')).rejects.toThrow(/not available|disponible/i)
  })

  it('calls requestSignBuffer with the account, message and "Posting", and resolves with the signature', async () => {
    const calls: Array<[string, string, string]> = []
    window.hive_keychain = {
      requestSignBuffer(account, message, keyType, callback) {
        calls.push([account, message, keyType])
        callback({ success: true, result: 'deadbeef'.repeat(8) })
      },
    }

    const sig = await requestHiveSignature('rzazo24', 'hivescope-relay-link:abc')

    expect(sig).toBe('deadbeef'.repeat(8))
    expect(calls).toEqual([['rzazo24', 'hivescope-relay-link:abc', 'Posting']])
  })

  it('rejects with the message Keychain returned when the request fails', async () => {
    window.hive_keychain = {
      requestSignBuffer(_account, _message, _keyType, callback) {
        callback({ success: false, message: 'user cancelled' })
      },
    }

    await expect(requestHiveSignature('rzazo24', 'msg')).rejects.toThrow('user cancelled')
  })
})
