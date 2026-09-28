import { describe, expect, it } from 'vitest'
import { hiveAvatarUrl } from './hiveAvatar'

describe('hiveAvatarUrl', () => {
  it('construye la URL en minúsculas', () => {
    expect(hiveAvatarUrl('RZazo24')).toBe('https://images.hive.blog/u/rzazo24/avatar/small')
    expect(hiveAvatarUrl('peak.snaps')).toBe('https://images.hive.blog/u/peak.snaps/avatar/small')
  })
  it('rechaza lo que no es una cuenta Hive', () => {
    for (const bad of ['', 'a', '../x', 'a/b', 'x y', '1abc', 'a'.repeat(40)]) expect(hiveAvatarUrl(bad)).toBeNull()
  })
})
