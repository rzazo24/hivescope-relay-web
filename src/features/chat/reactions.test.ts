import { describe, expect, it } from 'vitest'
import { addReaction, chipsFor, myReactionIds, parseReaction, type Reaction, removeReactions } from './reactions'

const r = (id: string, pubkey: string, emoji: string, target = 'm1'): Reaction => ({ id, pubkey, emoji, target })
const accounts: Record<string, string> = { a1: 'Ana', a2: 'ana', b1: 'bea' }

describe('reactions', () => {
  it('parseReaction valida emoji y destino', () => {
    expect(parseReaction({ id: 'x', pubkey: 'p', content: '👍', tags: [['e', 'm1']] })).toEqual(r('x', 'p', '👍'))
    expect(parseReaction({ id: 'x', pubkey: 'p', content: 'hola', tags: [['e', 'm1']] })).toBeNull()
    expect(parseReaction({ id: 'x', pubkey: 'p', content: '👍', tags: [] })).toBeNull()
  })
  it('add/remove no duplican ni cambian la lista si no hace falta', () => {
    const list = [r('1', 'a1', '👍')]
    expect(addReaction(list, r('1', 'a1', '👍'))).toBe(list)
    expect(addReaction(list, r('2', 'b1', '👍'))).toHaveLength(2)
    expect(removeReactions(list, new Set(['zz']))).toBe(list)
    expect(removeReactions(list, new Set(['1']))).toEqual([])
  })
  it('chipsFor cuenta cuentas distintas (dos dispositivos = una) y marca las mías', () => {
    const list = [r('1', 'a1', '👍'), r('2', 'a2', '👍'), r('3', 'b1', '👍'), r('4', 'b1', '🎉'), r('5', 'b1', '👍', 'otro')]
    const chips = chipsFor(list, 'm1', (pk) => accounts[pk], (pk) => pk === 'a1' || pk === 'a2')
    expect(chips).toEqual([
      { emoji: '👍', count: 2, who: ['@ana', '@bea'], mine: true },
      { emoji: '🎉', count: 1, who: ['@bea'], mine: false },
    ])
  })
  it('un pubkey sin cuenta resuelta cuenta por su cuenta', () => {
    const chips = chipsFor([r('1', 'zzzzzzzzzz', '❤️')], 'm1', () => undefined, () => false)
    expect(chips[0].count).toBe(1)
    expect(chips[0].who[0]).toBe('zzzzzzzz…')
  })
  it('myReactionIds devuelve las de todos mis dispositivos con ese emoji', () => {
    const list = [r('1', 'a1', '👍'), r('2', 'a2', '👍'), r('3', 'b1', '👍'), r('4', 'a1', '🎉')]
    expect(myReactionIds(list, 'm1', '👍', (pk) => pk.startsWith('a'))).toEqual(['1', '2'])
  })
})
