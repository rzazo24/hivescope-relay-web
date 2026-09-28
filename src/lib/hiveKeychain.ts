export interface KeychainSignBufferResponse {
  success: boolean
  result?: string
  message?: string
  error?: string
}

export interface KeychainBroadcastResponse {
  success: boolean
  result?: unknown
  message?: string
  error?: string
}

/** Una operación cruda de la blockchain de Hive, en el formato [nombre, payload] que espera broadcast_transaction. */
export type HiveOperation = [string, Record<string, unknown>]

interface HiveKeychainApi {
  requestSignBuffer(
    account: string,
    message: string,
    keyType: 'Posting' | 'Active' | 'Memo',
    callback: (response: KeychainSignBufferResponse) => void,
  ): void
  requestBroadcast(
    account: string,
    operations: HiveOperation[],
    keyType: 'Posting' | 'Active',
    callback: (response: KeychainBroadcastResponse) => void,
  ): void
}

declare global {
  interface Window {
    hive_keychain?: HiveKeychainApi
  }
}

/**
 * Espera a que window.hive_keychain aparezca, reintentando durante
 * timeoutMs. Hace falta porque algunos navegadores in-app (como el de la
 * app móvil de Hive Keychain) lo inyectan un instante después de que la
 * página termina de cargar — comprobarlo una sola vez al arrancar da falsos
 * negativos.
 */
export function waitForKeychain(timeoutMs = 10_000, intervalMs = 200): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()

    const tick = () => {
      if (typeof window.hive_keychain !== 'undefined') {
        resolve(true)
        return
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false)
        return
      }
      setTimeout(tick, intervalMs)
    }

    tick()
  })
}

/**
 * El mensaje exacto que hay que firmar con la clave posting de la cuenta
 * Hive para demostrar que se controla nostrPubkey. DEBE coincidir
 * exactamente con `LinkChallenge` en internal/policies/hivelink.go de
 * hivescope-relay — es un contrato entre frontend y relé.
 */
export function linkChallenge(nostrPubkey: string): string {
  return `hivescope-relay-link:${nostrPubkey}`
}

/** Pide a Hive Keychain que firme `message` con la clave posting de `account`. */
export function requestHiveSignature(account: string, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window.hive_keychain === 'undefined') {
      reject(new Error('Hive Keychain no está disponible en esta página'))
      return
    }

    window.hive_keychain.requestSignBuffer(account, message, 'Posting', (response) => {
      if (response.success && response.result) {
        resolve(response.result)
      } else {
        reject(new Error(response.message ?? response.error ?? 'Firma cancelada o fallida'))
      }
    })
  })
}

/**
 * Pide a Hive Keychain que firme y transmita operations a la blockchain de
 * Hive con la clave posting de account. A diferencia de requestHiveSignature
 * (que solo firma un mensaje para demostrar control de la cuenta), esto
 * publica de verdad en la cadena -- lo usa publishRoomSnap en hiveSnaps.ts.
 */
export function requestHiveBroadcast(account: string, operations: HiveOperation[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.hive_keychain === 'undefined') {
      reject(new Error('Hive Keychain no está disponible en esta página'))
      return
    }

    window.hive_keychain.requestBroadcast(account, operations, 'Posting', (response) => {
      if (response.success) {
        resolve()
      } else {
        reject(new Error(response.message ?? response.error ?? 'Publicación cancelada o fallida'))
      }
    })
  })
}
