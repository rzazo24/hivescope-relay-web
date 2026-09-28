import { describe, expect, it } from 'vitest'
import { pathForSlug, roomUrl, slugFromPath } from './roomRoute'

describe('slugFromPath', () => {
  it('extracts the slug from /r/<slug>, with or without a trailing slash', () => {
    expect(slugFromPath('/r/general')).toBe('general')
    expect(slugFromPath('/r/sala-rzazo24-test/')).toBe('sala-rzazo24-test')
  })

  it('returns null for anything that is not a room path', () => {
    for (const p of ['/', '', '/r', '/r/', '/r/a/b', '/x/general', '/r/Mayus', '/r/con espacio', '/r/ñu']) {
      expect(slugFromPath(p)).toBeNull()
    }
  })
})

describe('pathForSlug / roomUrl', () => {
  it('round-trips', () => {
    expect(slugFromPath(pathForSlug('mi-sala-1'))).toBe('mi-sala-1')
  })

  it('builds an absolute link and tolerates a trailing slash on the origin', () => {
    expect(roomUrl('https://chat.hivescope.xyz', 'general')).toBe('https://chat.hivescope.xyz/r/general')
    expect(roomUrl('https://chat.hivescope.xyz/', 'general')).toBe('https://chat.hivescope.xyz/r/general')
  })
})
