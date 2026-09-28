// URL del relé de hivescope-relay. Configurable con VITE_RELAY_URL (ver
// .env.example) para poder apuntar a un relé local en desarrollo.
export const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'wss://relay.hivescope.xyz'

// Nodo Hive público para leer datos de la cadena directamente desde el
// navegador (hoy solo lo usa hiveSnaps.ts para encontrar el contenedor de
// snaps del día) -- mismo default que usa hivescope-relay del lado del
// servidor (hiveapi.DefaultNode), pero configurado por separado porque son
// procesos distintos.
export const HIVE_API_NODE = import.meta.env.VITE_HIVE_API_NODE ?? 'https://api.hive.blog'

// URL pública de esta app -- se usa al armar el texto de un snap de Hive
// (ver hiveSnaps.ts) para enlazar de vuelta. No hay ruteo por sala todavía
// (la app es de una sola pantalla, sin URLs por sala), así que siempre
// apunta a la raíz.
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://chat.hivescope.xyz'

// Cuenta Hive tratada como superadmin por hivescope-relay
// (HIVESCOPE_SUPERADMIN_HIVE_ACCOUNT ahí) -- solo para decidir si mostrar el
// botón "editar" en salas que esta cuenta no posee ni administra. Puramente
// cosmético: quien de verdad autoriza la edición es el relé, esto solo evita
// esconderle el botón al superadmin. "" = nadie ve este atajo de UI.
export const SUPERADMIN_HIVE_ACCOUNT = import.meta.env.VITE_SUPERADMIN_HIVE_ACCOUNT ?? 'rzazo24'
