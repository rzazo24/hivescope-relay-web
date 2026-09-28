# hivescope-web

[![CI](https://github.com/rzazo24/hivescope-relay-web/actions/workflows/ci.yml/badge.svg)](https://github.com/rzazo24/hivescope-relay-web/actions/workflows/ci.yml)

*[Read in English](README.md)*

Frontend del chat de HiveScope: vincula una cuenta de [Hive](https://hive.io/)
con [Hive Keychain](https://hive-keychain.com/), navega/crea salas, y chatea,
todo apoyado en [hivescope-relay](https://github.com/rzazo24/hivescope-relay).

En vivo en **[chat.hivescope.xyz](https://chat.hivescope.xyz)**.

Es una SPA puramente de cliente — sin backend propio. Habla directo con el
relé por `wss://` y con Hive Keychain (extensión de navegador o app móvil)
desde el propio navegador; no hay nada que correr del lado del servidor más
allá de servir el build estático.

## Stack

Vite + React + TypeScript + Tailwind v4 (tokens `@theme`, sin archivo de
config), [nostr-tools](https://github.com/nbd-wtf/nostr-tools) para la parte
Nostr, [i18next](https://www.i18next.com/) para inglés/español.

## Correr en local

```bash
npm install
npm run dev
```

Por defecto habla con el relé de producción (`wss://relay.hivescope.xyz`).
Para apuntarlo a una instancia local de `hivescope-relay`, copia
`.env.example` a `.env.local` y configura `VITE_RELAY_URL`.

```bash
npm run build   # tsc -b && vite build -> dist/
npm run lint    # oxlint
npm test        # vitest run
```

Los tests cubren la lógica pura (persistencia de identidad, parseo de slug
de sala, el flujo de challenge/firma de Keychain, paridad de traducciones
en/es) — lo que necesita una conexión real al relé se verifica a mano
contra una instancia real de `hivescope-relay`, ver `CLAUDE.md`.

## Estructura del proyecto

```
src/lib/               helpers independientes de React: conexión al relé,
                        identidad Nostr (generada una vez por navegador,
                        guardada en localStorage), Hive Keychain, consultas
                        de salas
src/features/link/      la pantalla de vinculación con Hive Keychain
src/features/rooms/     listar/crear salas
src/features/chat/      el chat en vivo de una sala (suscripción que se
                        mantiene abierta, reconexión automática)
src/components/         UI compartida (la ventana de terminal, el selector
                        de idioma)
src/i18n/               strings en/es y configuración de i18next
```

Ver [`CLAUDE.md`](CLAUDE.md) para cómo encajan las piezas (el flujo de
vinculación, por qué la identidad vive en localStorage, cómo funcionan los
mensajes en vivo y la reconexión).

## Admin de sala

Quien crea una sala pasa a ser su dueña, y las salas llevan un tag de pubkey
`admin`; la dueña o el admin actual pueden renombrar la sala o delegar la
administración en otra cuenta (el enlace "editar" junto a cada sala en el
listado, que solo aparece cuando tu identidad vinculada es la dueña o el
admin de esa sala), reforzado por `NewRoomMetaPolicy` del relé. Es el único
privilegio reforzado de una sala — cualquier cuenta vinculada puede seguir
escribiendo en cualquier sala; no hay capacidad de borrar mensajes ni de
expulsar/silenciar cuentas.

## Borrar mensajes

Cada mensaje tuyo tiene un enlace "borrar" (con confirmación). Envía un borrado NIP-09 firmado con tu clave: el relé elimina el mensaje y desaparece en vivo para todos en la sala. Funciona desde cualquier dispositivo vinculado a la misma cuenta Hive, y no puede recuperar copias que alguien ya haya visto o guardado.

## Contador de conectados

El icono de personas muestra cuántas cuentas Hive están en línea: en total (barra superior), por sala (lista de salas) y en la sala actual; púlsalo en la barra superior o en la cabecera de una sala para ver la lista de quién está en línea. Los clientes vinculados envían latidos efímeros indicando en qué sala están; no se guarda nada, y dos dispositivos de la misma cuenta cuentan una vez.

## Número de mensajes

Cada sala del listado muestra cuántos mensajes tiene. Una sola consulta al relé los cuenta todos (se repite cada minuto, así que los borrados se reflejan) y los mensajes nuevos suben el número en vivo.

## Mensajes no leídos

Las salas con mensajes que no has visto muestran una etiqueta «N nuevos», y el título de la pestaña lleva el total («(3) HiveScope Chat»). «Visto» es una marca de tiempo por sala guardada en el localStorage de este dispositivo (`src/lib/unread.ts`); las salas que nunca habías visto arrancan como leídas, tus propios mensajes no cuentan y la sala abierta se marca leída mientras la pestaña está visible.

## Enlaces a salas

Cada sala tiene un enlace directo, `/r/<nombre-de-sala>`, que puedes copiar desde dentro de la sala. Al abrirlo vas directamente a la sala (tras vincularte, si aún no lo estabas); si la sala no existe o ha caducado, acabas en la lista con un aviso. El snap de Hive que puedes compartir al crear una sala también enlaza a ella.

## Caducidad de salas

Las salas no son permanentes: al crear o editar una se elige cuánto dura
(1h, 24h, 7, 30 o 90 días — `ROOM_LIFETIME_OPTIONS` en `src/lib/rooms.ts`),
marcado como una `expiration` NIP-40 en esa publicación. El relé borra sola
la sala —y después sus mensajes— en cuanto pasa ese tiempo sin
actualizaciones (la limpieza corre cada pocos minutos, así que una sala
puede tardar unos minutos más de lo marcado). Renombrar una sala, o cualquier otra edición,
reinicia el plazo con la duración que se elija en ese momento; no hay un botón de
"renovar" aparte, con editarla alcanza. Cada sala del listado muestra cuánto
le queda.

## Snaps de Hive

Tras crear una sala se te ofrece un botón para compartirla en Hive como un "snap" corto (una respuesta al post contenedor diario de `@peak.snaps`, firmada con Hive Keychain). No se publica nada si no lo pulsas; un snap es permanente en la cadena. Ver `src/lib/hiveSnaps.ts`.

## La vinculación Hive↔Nostr, resumida

Vincularse publica un evento `kind:30078` (`d=hive-link`) cuyo tag
`hive_sig` es la clave **posting** de la cuenta firmando exactamente el
string `hivescope-relay-link:<pubkey_nostr>` — ver
[`src/lib/hiveKeychain.ts`](src/lib/hiveKeychain.ts) (`linkChallenge`).
Esto tiene que coincidir byte a byte con `LinkChallenge` en
`internal/policies/hivelink.go` del relé; si tocas un lado, revisa el otro.

## i18n

Inglés y español (de España), detectado del navegador en la primera
visita, cambiable en cualquier momento (`$ lang en/es` en la esquina) y
recordado en localStorage. Todos los strings de la UI pasan por
`useTranslation()` desde el principio — ver `src/i18n/locales/*.json`.

Los motivos de rechazo del relé (se muestran tal cual cuando algo es
inválido) están en inglés, siguiendo la convención de NIP-01 para mensajes
OK pensados para que los lea cualquier cliente Nostr — no se retraducen del
lado del cliente.

## Tema

Oscuro ("hacker terminal": negro, verde neón) por defecto, con una variante
clara — mismo verde de marca, fondo blanco papel — que se puede cambiar en
cualquier momento (`$ tema oscuro/claro` en la esquina) y queda recordada
en localStorage. Quien visita por primera vez sin nada guardado recibe la
que coincida con la preferencia de su sistema operativo, igual que con la
detección de idioma de arriba.

## Desplegar

Aquí no hay Dockerfile — el build estático lo sirve el mismo Caddy que ya
corre [hivescope-relay](https://github.com/rzazo24/hivescope-relay) en el
VPS (solo un proceso puede escuchar en el puerto 443). Ver el
`docker-compose.yml`/`Caddyfile` y el README de ese repo para el detalle
exacto; en resumen, se espera que este repo esté clonado como directorio
hermano (`../hivescope-web` relativo a `hivescope-relay`), y publicar un
build nuevo es correr `npm run build` acá y después recrear ese contenedor
`caddy`.

## Licencia

[MIT](LICENSE)
