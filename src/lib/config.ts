// URL del relé de hivescope-relay. Configurable con VITE_RELAY_URL (ver
// .env.example) para poder apuntar a un relé local en desarrollo.
export const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'wss://relay.hivescope.xyz'
