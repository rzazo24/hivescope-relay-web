import { useCallback, useSyncExternalStore } from 'react'
import { pathForSlug, slugFromPath } from '../lib/roomRoute'

/**
 * Sala abierta según la URL (/r/<slug>), sincronizada con el historial del
 * navegador: entrar/salir de una sala hace pushState, así que el botón atrás
 * vuelve a la lista y un enlace directo abre la sala. Sin librería de rutas:
 * la app solo tiene esta ruta.
 *
 * Es un almacén compartido a nivel de módulo (useSyncExternalStore) y no un
 * useState por componente, porque más de un sitio necesita saber en qué sala
 * estás (la lista de salas y el anuncio de presencia de App): pushState no
 * dispara ningún evento, así que cada cambio lo notificamos nosotros.
 */
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

const getSnapshot = () => slugFromPath(window.location.pathname)

function navigate(slug: string | null, mode: 'push' | 'replace') {
  const url = slug ? pathForSlug(slug) : '/'
  if (mode === 'push') window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
  listeners.forEach((l) => l())
}

/** `open` añade una entrada al historial; `replace` cambia la URL sin añadirla (p. ej. al limpiar un enlace a una sala que no existe). */
export function useRoomRoute(): { slug: string | null; open: (slug: string | null) => void; replace: (slug: string | null) => void } {
  const slug = useSyncExternalStore(subscribe, getSnapshot)
  const open = useCallback((next: string | null) => navigate(next, 'push'), [])
  const replace = useCallback((next: string | null) => navigate(next, 'replace'), [])
  return { slug, open, replace }
}
