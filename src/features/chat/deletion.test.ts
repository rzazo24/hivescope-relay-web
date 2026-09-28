import { describe, expect, it } from 'vitest'
import { applyDeletion } from './deletion'

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
