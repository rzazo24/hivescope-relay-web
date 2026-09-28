import { describe, expect, it } from 'vitest'
import { countOnline, peopleInRoom, pruneStale, type PresenceBook, recordBeat, STALE_MS } from './presence'

const none = () => undefined

describe('recordBeat', () => {
  it('reports a pubkey it had not seen as new, and later beats as not new', () => {
    const book: PresenceBook = new Map()
    expect(recordBeat(book, 'a', 'general', 1000)).toBe(true)
    expect(recordBeat(book, 'a', 'general', 2000)).toBe(false)
  })

  it('moves a pubkey to the room of its latest beat', () => {
    const book: PresenceBook = new Map()
    recordBeat(book, 'a', 'general', 1000)
    recordBeat(book, 'a', null, 2000)
    expect(book.get('a')).toEqual({ slug: null, at: 2000 })
  })

  it('removes the pubkey on "left" and does not report it as an arrival', () => {
    const book: PresenceBook = new Map()
    recordBeat(book, 'a', 'general', 1000)
    expect(recordBeat(book, 'a', 'general', 1500, true)).toBe(false)
    expect(book.has('a')).toBe(false)
  })
})

describe('pruneStale', () => {
  it('drops only entries older than STALE_MS', () => {
    const book: PresenceBook = new Map([
      ['old', { slug: null, at: 0 }],
      ['fresh', { slug: null, at: STALE_MS }],
    ])
    pruneStale(book, STALE_MS + 1)
    expect([...book.keys()]).toEqual(['fresh'])
  })
})

describe('countOnline', () => {
  const now = 100_000

  it('counts distinct people in total and per room', () => {
    const book: PresenceBook = new Map([
      ['a', { slug: 'general', at: now }],
      ['b', { slug: 'general', at: now }],
      ['c', { slug: 'otra', at: now }],
      ['d', { slug: null, at: now }],
    ])
    const { total, byRoom } = countOnline(book, now, none)
    expect(total).toBe(4)
    expect(byRoom.get('general')).toBe(2)
    expect(byRoom.get('otra')).toBe(1)
    expect(byRoom.has('null')).toBe(false)
  })

  it('counts two devices of the same Hive account once (case-insensitive)', () => {
    const book: PresenceBook = new Map([
      ['phone', { slug: 'general', at: now }],
      ['pc', { slug: 'general', at: now }],
    ])
    const accounts: Record<string, string> = { phone: 'Ana', pc: 'ana' }
    const { total, byRoom } = countOnline(book, now, (pk) => accounts[pk])
    expect(total).toBe(1)
    expect(byRoom.get('general')).toBe(1)
  })

  it('counts a person in each room where one of their devices is, but once in total', () => {
    const book: PresenceBook = new Map([
      ['phone', { slug: 'a', at: now }],
      ['pc', { slug: 'b', at: now }],
    ])
    const { total, byRoom } = countOnline(book, now, () => 'ana')
    expect(total).toBe(1)
    expect([byRoom.get('a'), byRoom.get('b')]).toEqual([1, 1])
  })

  it('ignores stale beats', () => {
    const book: PresenceBook = new Map([['a', { slug: 'general', at: now - STALE_MS - 1 }]])
    expect(countOnline(book, now, none).total).toBe(0)
  })
})

describe('countOnline people list', () => {
  const now = 100_000

  it('lists each person once with their accounts sorted, unresolved pubkeys last', () => {
    const book: PresenceBook = new Map([
      ['pk-z', { slug: null, at: now }],
      ['b1', { slug: 'general', at: now }],
      ['a1', { slug: 'general', at: now }],
      ['a2', { slug: 'otra', at: now }],
    ])
    const accounts: Record<string, string> = { a1: 'Ana', a2: 'ana', b1: 'bea' }
    const { people, total } = countOnline(book, now, (pk) => accounts[pk])
    expect(total).toBe(3)
    expect(people.map((p) => p.account)).toEqual(['ana', 'bea', null])
    expect(people[0].rooms).toEqual(['general', 'otra'])
    expect(people[2].key).toBe('pk-z')
  })

  it('peopleInRoom returns only those with a device in that room', () => {
    const book: PresenceBook = new Map([
      ['a', { slug: 'general', at: now }],
      ['b', { slug: 'otra', at: now }],
      ['c', { slug: null, at: now }],
    ])
    const { people } = countOnline(book, now, (pk) => ({ a: 'ana', b: 'bea', c: 'carla' })[pk])
    expect(peopleInRoom(people, 'general').map((p) => p.account)).toEqual(['ana'])
    expect(peopleInRoom(people, 'nada')).toEqual([])
  })
})
