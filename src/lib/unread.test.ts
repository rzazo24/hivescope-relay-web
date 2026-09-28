import { describe, expect, it } from 'vitest'
import { markSeen, tallyUnread, titleWithUnread, withBaseline } from './unread'

const ev = (slug: string, pubkey: string, created_at: number) => ({ tags: [['t', slug]], pubkey, created_at })

describe('unread', () => {
  it('cuenta solo mensajes ajenos posteriores a la marca', () => {
    const u = tallyUnread([ev('a', 'x', 11), ev('a', 'x', 10), ev('a', 'me', 20), ev('b', 'x', 5)], { a: 10, b: 9 }, 'me')
    expect(u.get('a')).toBe(1)
    expect(u.get('b')).toBeUndefined()
  })
  it('sala sin marca no genera no leídos', () => {
    expect(tallyUnread([ev('a', 'x', 99)], {}, 'me').size).toBe(0)
  })
  it('withBaseline solo añade las salas nuevas', () => {
    expect(withBaseline({ a: 1 }, ['a', 'b'], 50)).toEqual({ a: 1, b: 50 })
    const s = { a: 1 }
    expect(withBaseline(s, ['a'], 50)).toBe(s)
  })
  it('markSeen nunca retrocede', () => {
    const s = { a: 10 }
    expect(markSeen(s, 'a', 5)).toBe(s)
    expect(markSeen(s, 'a', 12)).toEqual({ a: 12 })
  })
  it('título con total', () => {
    expect(titleWithUnread('X', 0)).toBe('X')
    expect(titleWithUnread('X', 3)).toBe('(3) X')
    expect(titleWithUnread('X', 150)).toBe('(99+) X')
  })
})
