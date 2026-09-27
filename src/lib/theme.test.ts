import { afterEach, describe, expect, it } from 'vitest'
import { getTheme, setTheme } from './theme'

afterEach(() => {
  localStorage.clear()
})

describe('getTheme', () => {
  it('defaults to dark when nothing is stored (jsdom reports no prefers-color-scheme match)', () => {
    expect(getTheme()).toBe('dark')
  })

  it('returns whatever was explicitly stored, overriding the default', () => {
    setTheme('light')
    expect(getTheme()).toBe('light')

    setTheme('dark')
    expect(getTheme()).toBe('dark')
  })
})

describe('setTheme', () => {
  it('reflects the choice on <html data-theme>, for the CSS token overrides to key off', () => {
    setTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    setTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists the choice so a later page load remembers it', () => {
    setTheme('light')
    expect(localStorage.getItem('hivescope:theme')).toBe('light')
  })
})
