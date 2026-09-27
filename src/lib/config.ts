// URL del relé de hivescope-relay. Configurable con VITE_RELAY_URL (ver
// .env.example) para poder apuntar a un relé local en desarrollo.
export const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'wss://relay.hivescope.xyz'

// Cuenta Hive tratada como superadmin por hivescope-relay
// (HIVESCOPE_SUPERADMIN_HIVE_ACCOUNT ahí) -- solo para decidir si mostrar el
// botón "editar" en salas que esta cuenta no posee ni administra. Puramente
// cosmético: quien de verdad autoriza la edición es el relé, esto solo evita
// esconderle el botón al superadmin. "" = nadie ve este atajo de UI.
export const SUPERADMIN_HIVE_ACCOUNT = import.meta.env.VITE_SUPERADMIN_HIVE_ACCOUNT ?? 'rzazo24'
