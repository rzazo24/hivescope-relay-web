import { useEffect, useState } from 'react'
import { resolveHiveAccounts } from '../lib/relay'

/**
 * Resuelve una lista de pubkeys Nostr a sus cuentas Hive vinculadas (para
 * mostrar "@usuario" en vez del pubkey crudo). Los pubkeys sin vinculación
 * simplemente no aparecen en el mapa devuelto -- quien lo use tiene que
 * seguir teniendo un valor de reserva (el pubkey corto) para ese caso.
 *
 * Se deriva una clave estable (string ordenado) de la lista de pubkeys en
 * vez de usar el array directamente como dependencia del efecto, porque un
 * array nuevo en cada render de otro modo dispararía la consulta al relé
 * sin parar.
 */
export function useHiveAccountNames(pubkeys: string[]): Map<string, string> {
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const key = [...new Set(pubkeys)].sort().join(',')

  useEffect(() => {
    if (!key) return
    let cancelled = false

    resolveHiveAccounts(key.split(',')).then((resolved) => {
      if (cancelled || resolved.size === 0) return
      setNames((prev) => {
        const merged = new Map(prev)
        for (const [pk, account] of resolved) merged.set(pk, account)
        return merged
      })
    })

    return () => {
      cancelled = true
    }
  }, [key])

  return names
}
