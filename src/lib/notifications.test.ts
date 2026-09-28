import { describe, expect, it } from 'vitest'
import { shouldNotify } from './notifications'

describe('shouldNotify', () => {
  it('solo con preferencia, permiso concedido y app en segundo plano', () => {
    expect(shouldNotify(true, 'granted', true)).toBe(true)
    expect(shouldNotify(false, 'granted', true)).toBe(false)
    expect(shouldNotify(true, 'denied', true)).toBe(false)
    expect(shouldNotify(true, 'default', true)).toBe(false)
    expect(shouldNotify(true, 'granted', false)).toBe(false)
  })
})
