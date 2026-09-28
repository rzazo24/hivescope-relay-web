import { useCallback, useEffect, useState } from 'react'
import { pathForSlug, slugFromPath } from '../lib/roomRoute'

/**
 * Sala abierta según la URL (/r/<slug>), sincronizada con el historial del
 * navegador: entrar/salir de una sala hace pushState, así que el botón atrás
 * vuelve a la lista y un enlace directo abre la sala. Sin librería de rutas:
 * la app solo tiene esta ruta. `replace` cambia la URL sin añadir historial
 * (para limpiar un enlace a una sala que no existe).
 */
export function useRoomRoute(): { slug: string | null; open: (slug: string | null) => void; replace: (slug: string | null) => void } {
  const [slug, setSlug] = useState(() => slugFromPath(window.location.pathname))

  useEffect(() => {
    const onPop = () => setSlug(slugFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = useCallback((next: string | null) => {
    window.history.pushState(null, '', next ? pathForSlug(next) : '/')
    setSlug(next)
  }, [])

  const replace = useCallback((next: string | null) => {
    window.history.replaceState(null, '', next ? pathForSlug(next) : '/')
    setSlug(next)
  }, [])

  return { slug, open, replace }
}
