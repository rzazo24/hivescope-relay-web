import { describe, expect, it } from 'vitest'
import { relayErrorKey } from './relayErrors'

describe('relayErrorKey', () => {
  it('reconoce los motivos habituales', () => {
    expect(relayErrorKey('rate-limited: slow down, please')).toBe('errors.rateLimited')
    expect(relayErrorKey('invalid: message too long (2001 characters, the maximum is 2000)')).toBe('errors.tooLong')
    expect(relayErrorKey("invalid: this pubkey hasn't linked a hive account yet (missing kind 30078 d=hive-link event)")).toBe('errors.notLinked')
    expect(relayErrorKey('WebSocket connection closed')).toBe('errors.offline')
  })
  it('deja pasar lo que no conoce', () => {
    expect(relayErrorKey('invalid: missing "t" tag')).toBeNull()
    expect(relayErrorKey('')).toBeNull()
  })
})
