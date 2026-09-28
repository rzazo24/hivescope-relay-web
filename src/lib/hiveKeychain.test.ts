import { afterEach, describe, expect, it } from 'vitest'
import { linkChallenge, requestHiveBroadcast, requestHiveSignature, waitForKeychain } from './hiveKeychain'

afterEach(() => {
  delete window.hive_keychain
})

/** No-op para completar HiveKeychainApi en fixtures que no ejercitan requestBroadcast. */
function noopRequestBroadcast() {}

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
    window.hive_keychain = { requestSignBuffer: () => {}, requestBroadcast: noopRequestBroadcast }
    await expect(waitForKeychain(1000, 10)).resolves.toBe(true)
  })

  it('resolves true if hive_keychain appears while polling', async () => {
    setTimeout(() => {
      window.hive_keychain = { requestSignBuffer: () => {}, requestBroadcast: noopRequestBroadcast }
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
      requestBroadcast: noopRequestBroadcast,
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
      requestBroadcast: noopRequestBroadcast,
    }

    await expect(requestHiveSignature('rzazo24', 'msg')).rejects.toThrow('user cancelled')
  })
})

describe('requestHiveBroadcast', () => {
  it('rejects immediately if hive_keychain is not available', async () => {
    await expect(requestHiveBroadcast('rzazo24', [])).rejects.toThrow(/not available|disponible/i)
  })

  it('calls requestBroadcast with the account, operations and "Posting", and resolves on success', async () => {
    const calls: Array<[string, unknown, string]> = []
    window.hive_keychain = {
      requestSignBuffer: () => {},
      requestBroadcast(account, operations, keyType, callback) {
        calls.push([account, operations, keyType])
        callback({ success: true })
      },
    }
    const ops: Array<[string, Record<string, unknown>]> = [['comment', { body: 'hi' }]]

    await expect(requestHiveBroadcast('rzazo24', ops)).resolves.toBeUndefined()
    expect(calls).toEqual([['rzazo24', ops, 'Posting']])
  })

  it('rejects with the message Keychain returned when the broadcast fails', async () => {
    window.hive_keychain = {
      requestSignBuffer: () => {},
      requestBroadcast(_account, _operations, _keyType, callback) {
        callback({ success: false, message: 'user cancelled' })
      },
    }
    await expect(requestHiveBroadcast('rzazo24', [])).rejects.toThrow('user cancelled')
  })
})
