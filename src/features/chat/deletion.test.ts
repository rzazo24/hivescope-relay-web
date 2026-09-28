import { describe, expect, it } from 'vitest'
import { applyDeletion, isOwnMessage } from './deletion'

const msgs = [
  { id: 'a', pubkey: 'ana' },
  { id: 'b', pubkey: 'bea' },
  { id: 'c', pubkey: 'ana' },
]

describe('applyDeletion', () => {
  it('removes the targeted messages when the requester is their author', () => {
    const out = applyDeletion(msgs, { pubkey: 'ana', tags: [['e', 'a'], ['e', 'c'], ['k', '9']] })
    expect(out.map((m) => m.id)).toEqual(['b'])
  })

  it("ignores a request for someone else's message", () => {
    const out = applyDeletion(msgs, { pubkey: 'ana', tags: [['e', 'b']] })
    expect(out).toBe(msgs)
  })

  it('returns the same array (no re-render) when nothing matches or there are no "e" tags', () => {
    expect(applyDeletion(msgs, { pubkey: 'ana', tags: [['e', 'zzz']] })).toBe(msgs)
    expect(applyDeletion(msgs, { pubkey: 'ana', tags: [['k', '9']] })).toBe(msgs)
    expect(applyDeletion(msgs, { pubkey: 'ana', tags: [['e', '']] })).toBe(msgs)
  })
})

describe('applyDeletion with a custom sameAuthor (same Hive account)', () => {
  const sameAccount = (a: string, b: string) => a === b || (a === 'ana-movil' && b === 'ana-pc') || (a === 'ana-pc' && b === 'ana-movil')

  it("removes a message from another device of the requester's account", () => {
    const list = [{ id: 'x', pubkey: 'ana-movil' }, { id: 'y', pubkey: 'bea' }]
    expect(applyDeletion(list, { pubkey: 'ana-pc', tags: [['e', 'x'], ['e', 'y']] }, sameAccount).map((m) => m.id)).toEqual(['y'])
  })
})

describe('isOwnMessage', () => {
  const accounts = new Map([['pc-pk', 'Ana'], ['bea-pk', 'bea']])

  it('is true for my exact pubkey', () => {
    expect(isOwnMessage('me', 'me', 'ana', new Map())).toBe(true)
  })

  it("is true for another pubkey linked to my hive account (case-insensitive)", () => {
    expect(isOwnMessage('pc-pk', 'me', 'ana', accounts)).toBe(true)
  })

  it('is false for someone else, unresolved pubkeys, or an empty account', () => {
    expect(isOwnMessage('bea-pk', 'me', 'ana', accounts)).toBe(false)
    expect(isOwnMessage('unknown', 'me', 'ana', accounts)).toBe(false)
    expect(isOwnMessage('pc-pk', 'me', '', accounts)).toBe(false)
  })
})
