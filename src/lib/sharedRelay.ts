import type { Event } from 'nostr-tools/core'
import type { Filter } from 'nostr-tools/filter'
import { Relay } from 'nostr-tools/relay'
import { RELAY_URL } from './config'

// UNA sola conexión WebSocket al relé para toda la app. Antes cada hook y cada
// consulta abría la suya (unas 12 por carga de página) y el limitador de
// conexiones del relé (10/min por IP, ráfaga de 30) dejaba fuera con un 429 a
// quien recargara un par de veces. Ahora todos comparten esta y solo cierran sus
// suscripciones, nunca la conexión (vive lo que la pestaña).
let shared: Promise<Relay> | null = null

/** La conexión compartida (se abre la primera vez; nostr-tools reconecta sola con backoff). */
export function getRelay(): Promise<Relay> {
  if (!shared) {
    shared = Relay.connect(RELAY_URL, { enableReconnect: true })
    // si la conexión inicial falla, la próxima llamada vuelve a intentarlo
    shared.catch(() => {
      shared = null
    })
  }
  return shared
}

export interface QueryResult {
  events: Event[]
  /** true si el relé terminó de responder (EOSE); false si se cerró o venció el tiempo. */
  complete: boolean
}

/**
 * Consulta puntual: pide `filters`, junta lo que llega y resuelve al EOSE. No se
 * queda colgada si el relé cierra la suscripción (límite de peticiones...) o no
 * responde: en ambos casos resuelve con lo recibido y `complete: false`.
 */
export async function queryOnce(filters: Filter[], timeoutMs = 10_000): Promise<QueryResult> {
  const relay = await getRelay()
  return new Promise<QueryResult>((resolve) => {
    const events: Event[] = []
    let done = false
    const finish = (complete: boolean) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try {
        sub.close()
      } catch {
        // ya cerrada
      }
      resolve({ events, complete })
    }
    const sub = relay.subscribe(filters, {
      onevent: (event) => events.push(event),
      oneose: () => finish(true),
      onclose: () => finish(false),
    })
    const timer = setTimeout(() => finish(false), timeoutMs)
  })
}
