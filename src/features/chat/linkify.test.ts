import { describe, expect, it } from 'vitest'
import { splitMessage } from './linkify'

describe('splitMessage', () => {
  it('detecta enlaces y menciones en el mismo mensaje', () => {
    expect(splitMessage('hola @bea mira https://hive.blog/@x/post ok')).toEqual([
      { text: 'hola ' },
      { text: '@bea', account: 'bea' },
      { text: ' mira ' },
      { text: 'https://hive.blog/@x/post', url: 'https://hive.blog/@x/post' },
      { text: ' ok' },
    ])
  })
  it('la puntuación final no es parte del enlace', () => {
    expect(splitMessage('ver https://a.com/x.')).toEqual([{ text: 'ver ' }, { text: 'https://a.com/x', url: 'https://a.com/x' }, { text: '.' }])
    expect(splitMessage('(https://a.com/x)')[1]).toEqual({ text: 'https://a.com/x', url: 'https://a.com/x' })
  })
  it('un @ dentro de la URL no es una mención', () => {
    expect(splitMessage('https://hive.blog/@bea').some((p) => p.account)).toBe(false)
  })
  it('solo http(s) con dominio', () => {
    expect(splitMessage('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }])
    expect(splitMessage('http://localhost/x')).toEqual([{ text: 'http://localhost/x' }])
    expect(splitMessage('ftp://a.com')).toEqual([{ text: 'ftp://a.com' }])
  })
  it('texto sin enlaces se comporta como splitMentions', () => {
    expect(splitMessage('hola @bea')).toEqual([{ text: 'hola ' }, { text: '@bea', account: 'bea' }])
    expect(splitMessage('')).toEqual([])
  })
})
