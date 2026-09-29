import { describe, expect, it } from 'vitest'
import { mayHaveMore, mergeMessages, toChatMessage } from './history'

const m = (id: string, createdAt: number) => toChatMessage({ id, pubkey: 'p', content: id, created_at: createdAt, tags: [['t', 'r']] })

describe('history', () => {
  it('mergeMessages ordena, no duplica y desempata por id', () => {
    const merged = mergeMessages([m('c', 30), m('b', 20)], [m('a', 10), m('b', 20), m('d', 20)])
    expect(merged.map((x) => x.id)).toEqual(['a', 'b', 'd', 'c'])
  })
  it('mergeMessages devuelve la misma lista si no hay nada nuevo', () => {
    const prev = [m('a', 1)]
    expect(mergeMessages(prev, [m('a', 1)])).toBe(prev)
    expect(mergeMessages(prev, [])).toBe(prev)
  })
  it('mergeMessages no duplica repetidos dentro del propio lote', () => {
    expect(mergeMessages([], [m('a', 1), m('a', 1)])).toHaveLength(1)
  })
  it('toChatMessage saca respuesta y citados', () => {
    const msg = toChatMessage({ id: 'x', pubkey: 'p', content: 'hi', created_at: 5, tags: [['t', 'r'], ['e', 'parent', '', 'reply'], ['p', 'q']] })
    expect(msg.replyTo).toBe('parent')
    expect(msg.mentioned).toEqual(['q'])
  })
  it('mayHaveMore', () => {
    expect(mayHaveMore(200, 200)).toBe(true)
    expect(mayHaveMore(199, 200)).toBe(false)
  })
})
