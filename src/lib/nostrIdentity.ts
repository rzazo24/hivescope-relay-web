import { bytesToHex, hexToBytes } from 'nostr-tools/utils'
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'

const STORAGE_KEY = 'hivescope:nostr-secret-key'

export interface NostrIdentity {
  secretKey: Uint8Array
  publicKey: string
}

/**
 * Devuelve la identidad Nostr de este navegador, generando una nueva la
 * primera vez que se visita la app. Se guarda en localStorage: cada
 * dispositivo/navegador tiene su propia identidad. hivescope-relay permite
 * vincular varios pubkeys Nostr a la misma cuenta Hive, así que esto no es
 * un problema — solo significa que cada dispositivo se vincula por
 * separado.
 */
export function getOrCreateIdentity(): NostrIdentity {
  const stored = localStorage.getItem(STORAGE_KEY)
  const secretKey = stored ? hexToBytes(stored) : generateSecretKey()

  if (!stored) {
    localStorage.setItem(STORAGE_KEY, bytesToHex(secretKey))
  }

  return { secretKey, publicKey: getPublicKey(secretKey) }
}
