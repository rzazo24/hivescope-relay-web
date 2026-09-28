import { describe, expect, it } from 'vitest'
import { keyboardInset } from './keyboardInset'

describe('keyboardInset', () => {
  it('is 0 when the visual viewport fills the layout viewport (no keyboard)', () => {
    expect(keyboardInset(800, 800, 0)).toBe(0)
  })

  it('is the height the keyboard covers', () => {
    expect(keyboardInset(800, 500, 0)).toBe(300)
  })

  it('subtracts the pan offset iOS applies to keep the focused field visible', () => {
    expect(keyboardInset(800, 500, 120)).toBe(180)
  })

  it('never goes negative (pinch-zoom can make the visual viewport smaller without a keyboard offset)', () => {
    expect(keyboardInset(800, 500, 400)).toBe(0)
  })
})
