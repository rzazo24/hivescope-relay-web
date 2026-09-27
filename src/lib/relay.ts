import { type EventTemplate, finalizeEvent } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { RELAY_URL } from './config'

/** Firma `template` con secretKey y lo publica en hivescope-relay. Lanza si el relé lo rechaza. */
export async function publishEvent(template: EventTemplate, secretKey: Uint8Array) {
  const event = finalizeEvent(template, secretKey)
  const relay = await Relay.connect(RELAY_URL)
  try {
    await relay.publish(event)
  } finally {
    relay.close()
  }
  return event
}

/**
 * Comprueba contra el relé si pubkey ya tiene un evento de vinculación
 * hive-link guardado (es decir, si ya superó NewHiveLinkPolicy en algún
 * momento). Es la misma pregunta que se hace hivescope-relay para decidir
 * si un pubkey puede publicar mensajes de chat.
 */
export async function findHiveLink(pubkey: string): Promise<{ account: string } | null> {
  const relay = await Relay.connect(RELAY_URL)
  try {
    return await new Promise((resolve) => {
      let found: { account: string } | null = null

      const sub = relay.subscribe([{ kinds: [30078], authors: [pubkey], limit: 10 }], {
        onevent(event) {
          const dTag = event.tags.find((t) => t[0] === 'd')?.[1]
          if (dTag !== 'hive-link') return

          const account = event.tags.find((t) => t[0] === 'hive_account')?.[1]
          if (account) found = { account }
        },
        oneose() {
          sub.close()
          resolve(found)
        },
      })
    })
  } finally {
    relay.close()
  }
}

// Cachea pubkey -> cuenta hive (o null si no tiene vinculación) para toda la
// sesión del navegador: los mismos pubkeys aparecen una y otra vez (el mismo
// remitente en varios mensajes, el mismo admin en la lista de salas), y esta
// vinculación no cambia una vez publicada -- no tiene sentido re-consultar
// el relé por algo que ya sabemos.
const hiveAccountCache = new Map<string, string | null>()

/**
 * Igual que findHiveLink, pero para varios pubkeys a la vez en una sola
 * consulta al relé (en vez de una por pubkey), y cacheado. Devuelve solo los
 * pubkeys para los que sí se encontró una cuenta -- los demás (sin
 * vinculación, por ejemplo un "admin" que alguien puso a mano sin que sea un
 * pubkey vinculado de verdad) simplemente no aparecen en el mapa resultado.
 */
export async function resolveHiveAccounts(pubkeys: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const uncached: string[] = []

  for (const pk of new Set(pubkeys)) {
    const cached = hiveAccountCache.get(pk)
    if (cached) result.set(pk, cached)
    else if (cached === undefined) uncached.push(pk)
  }

  if (uncached.length === 0) return result

  const relay = await Relay.connect(RELAY_URL)
  try {
    await new Promise<void>((resolve) => {
      const seen = new Set<string>()

      const sub = relay.subscribe([{ kinds: [30078], authors: uncached, limit: uncached.length * 5 }], {
        onevent(event) {
          const dTag = event.tags.find((t) => t[0] === 'd')?.[1]
          if (dTag !== 'hive-link') return

          const account = event.tags.find((t) => t[0] === 'hive_account')?.[1]
          if (!account || seen.has(event.pubkey)) return
          seen.add(event.pubkey)

          hiveAccountCache.set(event.pubkey, account)
          result.set(event.pubkey, account)
        },
        oneose() {
          sub.close()
          resolve()
        },
      })
    })
  } finally {
    relay.close()
  }

  // lo que se pidió y no apareció, también se cachea (como "sin cuenta") para
  // no volver a preguntarle al relé por lo mismo en cada render.
  for (const pk of uncached) {
    if (!hiveAccountCache.has(pk)) hiveAccountCache.set(pk, null)
  }

  return result
}
