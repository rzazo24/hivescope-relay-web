import { afterEach, describe, expect, it } from 'vitest'
import { clearIdentity, getOrCreateIdentity } from './nostrIdentity'

afterEach(() => {
  localStorage.clear()
})

describe('getOrCreateIdentity', () => {
  it('generates a valid-looking keypair on first call (empty localStorage)', () => {
    const identity = getOrCreateIdentity()

    expect(identity.secretKey).toBeInstanceOf(Uint8Array)
    expect(identity.secretKey).toHaveLength(32)
    expect(identity.publicKey).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same identity on a second call (persisted, not regenerated)', () => {
    const first = getOrCreateIdentity()
    const second = getOrCreateIdentity()

    expect(second.publicKey).toBe(first.publicKey)
    expect(second.secretKey).toEqual(first.secretKey)
  })

  it('persists something to localStorage so a later page load can reuse it', () => {
    expect(localStorage.length).toBe(0)
    getOrCreateIdentity()
    expect(localStorage.length).toBeGreaterThan(0)
  })

  it('generates a different identity per "browser" (fresh storage each time)', () => {
    const first = getOrCreateIdentity()
    localStorage.clear()
    const second = getOrCreateIdentity()

    expect(second.publicKey).not.toBe(first.publicKey)
  })
})

describe('clearIdentity', () => {
  it('makes the next getOrCreateIdentity() call generate a new, different identity (this is the "logout" button)', () => {
    const before = getOrCreateIdentity()
    clearIdentity()
    const after = getOrCreateIdentity()

    expect(after.publicKey).not.toBe(before.publicKey)
  })
})
