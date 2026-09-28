/** Ruta de una sala: /r/<slug>. Los slugs son solo [a-z0-9-] (ver slugifyRoom). */
const ROOM_PATH = /^\/r\/([a-z0-9-]+)\/?$/

/** Slug de sala que codifica un pathname, o null si no es una ruta de sala. */
export function slugFromPath(pathname: string): string | null {
  return ROOM_PATH.exec(pathname)?.[1] ?? null
}

export function pathForSlug(slug: string): string {
  return `/r/${slug}`
}

/** Enlace absoluto a una sala, para compartir (origin sin barra final). */
export function roomUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, '')}${pathForSlug(slug)}`
}
