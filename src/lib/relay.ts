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
