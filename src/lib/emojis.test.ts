import { describe, expect, it } from 'vitest'
import { EMOJIS, insertAtCursor } from './emojis'

describe('EMOJIS', () => {
  it('has no duplicates', () => {
    expect(new Set(EMOJIS).size).toBe(EMOJIS.length)
  })
})

describe('insertAtCursor', () => {
  it('inserts at the caret and places it right after the insertion', () => {
    expect(insertAtCursor('hola mundo', 4, 4, '😀')).toEqual({ text: 'hola😀 mundo', caret: 4 + '😀'.length })
  })

  it('replaces the selected range', () => {
    expect(insertAtCursor('hola mundo', 5, 10, '🌍')).toEqual({ text: 'hola 🌍', caret: 5 + '🌍'.length })
  })

  it('appends when the caret is at the end or out of range', () => {
    expect(insertAtCursor('hi', 2, 2, '👍').text).toBe('hi👍')
    expect(insertAtCursor('hi', 99, 99, '👍').text).toBe('hi👍')
  })

  it('works on an empty string and clamps a reversed/negative range', () => {
    expect(insertAtCursor('', 0, 0, '🔥').text).toBe('🔥')
    expect(insertAtCursor('abc', -5, -1, 'x').text).toBe('xabc')
  })
})
