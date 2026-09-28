import { describe, expect, it } from 'vitest'
import { applyMention, insertMention, mentionCandidates, mentionQuery, mentionsAccount, parseReplyTo, quoteSnippet, repliesToPubkey, replyTags, splitMentions } from './mentions'

describe('mentions', () => {
  it('splitMentions separa menciones y respeta el resto', () => {
    expect(splitMentions('hola @Bea, mira @carla.xy!')).toEqual([
      { text: 'hola ' },
      { text: '@Bea', account: 'bea' },
      { text: ', mira ' },
      { text: '@carla.xy', account: 'carla.xy' },
      { text: '!' },
    ])
  })
  it('no es mención un email ni un @ pegado a una palabra', () => {
    expect(splitMentions('a@bea.com y foo@bea')).toEqual([{ text: 'a@bea.com y foo@bea' }])
  })
  it('un punto final no forma parte de la cuenta', () => {
    expect(splitMentions('gracias @bea.')[1]).toEqual({ text: '@bea', account: 'bea' })
  })
  it('mentionsAccount ignora mayúsculas y cuenta vacía', () => {
    expect(mentionsAccount('ey @ANA', 'ana')).toBe(true)
    expect(mentionsAccount('ey @ana2', 'ana')).toBe(false)
    expect(mentionsAccount('ey @ana', '')).toBe(false)
  })
  it('mentionQuery detecta la mención a medio escribir junto al cursor', () => {
    expect(mentionQuery('hola @be', 8)).toEqual({ start: 5, query: 'be' })
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionQuery('hola @be ya', 11)).toBeNull()
    expect(mentionQuery('a@be', 4)).toBeNull()
  })
  it('applyMention reemplaza y coloca el cursor', () => {
    expect(applyMention('hola @be', 5, 8, 'bea')).toEqual({ text: 'hola @bea ', caret: 10 })
    expect(applyMention('hola @be y más', 5, 8, 'bea')).toEqual({ text: 'hola @bea  y más', caret: 10 })
  })
  it('mentionCandidates filtra, deduplica y excluye la propia', () => {
    expect(mentionCandidates(['bea', 'Bea', 'ben', 'ana', 'carla'], 'be', 'ana')).toEqual(['Bea', 'ben'])
    expect(mentionCandidates(['ana', 'bea'], '', 'ANA')).toEqual(['bea'])
  })
  it('replyTags / parseReplyTo / repliesToPubkey', () => {
    const tags = [['t', 'r'], ...replyTags({ id: 'abc', pubkey: 'pk' })]
    expect(parseReplyTo(tags)).toBe('abc')
    expect(repliesToPubkey(tags, 'pk')).toBe(true)
    expect(repliesToPubkey(tags, 'otro')).toBe(false)
    expect(parseReplyTo([['t', 'r'], ['e', 'x']])).toBeNull()
  })
  it('quoteSnippet recorta', () => {
    expect(quoteSnippet('a\n b')).toBe('a b')
    expect(quoteSnippet('x'.repeat(100), 10)).toBe('xxxxxxxxx…')
  })
  it('insertMention añade espacio previo solo si hace falta', () => {
    expect(insertMention('', 0, 0, 'bea')).toEqual({ text: '@bea ', caret: 5 })
    expect(insertMention('hola', 4, 4, 'bea')).toEqual({ text: 'hola @bea ', caret: 10 })
    expect(insertMention('hola ', 5, 5, 'bea')).toEqual({ text: 'hola @bea ', caret: 10 })
    expect(insertMention('ab cd', 3, 5, 'bea')).toEqual({ text: 'ab @bea ', caret: 8 })
  })
})
