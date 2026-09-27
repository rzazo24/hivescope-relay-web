export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'hivescope:theme'
const CHANGE_EVENT = 'hivescope:theme-changed'

function detectSystemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Preferencia guardada a mano, o -- si nunca se eligió una -- la del sistema, igual que con el idioma. */
export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return detectSystemTheme()
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: theme }))
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

export function subscribeTheme(onChange: (theme: Theme) => void): () => void {
  const handler = (e: Event) => onChange((e as CustomEvent<Theme>).detail)
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

// Aplica el tema apenas se importa este módulo (antes de que React monte),
// igual que src/i18n/index.ts sincroniza <html lang> -- evita depender de
// un efecto para el primer render.
applyTheme(getTheme())
