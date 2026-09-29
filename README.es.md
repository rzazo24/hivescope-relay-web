# hivescope-web

[![CI](https://github.com/rzazo24/hivescope-relay-web/actions/workflows/ci.yml/badge.svg)](https://github.com/rzazo24/hivescope-relay-web/actions/workflows/ci.yml)

*[Read in English](README.md)*

Frontend del chat de HiveScope: vincula una cuenta de [Hive](https://hive.io/)
con [Hive Keychain](https://hive-keychain.com/), navega/crea salas, y chatea,
todo apoyado en [hivescope-relay](https://github.com/rzazo24/hivescope-relay).

Publicación de presentación en Hive: [HiveScope Chat](https://peakd.com/hive-139531/@rzazo24/hivescope-chat-a-decentralized-chat-where-your-identity-is-your-hive-account-hivescope-chat-un-chat-descentralizado-donde-tu-i).

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

## Menciones y respuestas

Escribe `@cuenta` para mencionar a alguien (autocompletado con la gente de la sala; Tab/Intro, o pulsa el nombre de quien escribe para insertarlo) y usa «responder» bajo un mensaje para citarlo. Las menciones son texto del propio mensaje; una respuesta añade tags NIP-10 (`e` con el marcador `reply` y `p` con el autor citado), así que no hace falta tocar el relé. Los mensajes que te mencionan o responden a uno tuyo se resaltan y la lista de salas muestra una etiqueta `@N` (`src/features/chat/mentions.ts`).

## Aviso «está escribiendo»

Mientras escribes, el cliente envía (como mucho cada 4 s) un latido de presencia con un tag `typing`; los demás de la sala ven «@nombre está escribiendo…» durante 5 s (desaparece en cuanto llega su mensaje). Requiere que el relé acepte ese tag. Ver `typingByRoom` en `src/lib/presence.ts`.

## Notificaciones del navegador

Un interruptor opcional «avisos» en la barra superior muestra una notificación del navegador cuando un mensaje te menciona o responde a uno tuyo con la pestaña en segundo plano; al pulsarla se abre la sala. El permiso se pide una vez, la elección se recuerda por dispositivo y solo funciona con la app abierta (no hay push: es una SPA sin backend). Se oculta donde el navegador no tiene la API Notification (p. ej. iOS Safari, la mayoría de navegadores integrados). Ver `src/lib/notifications.ts`.

## Buscar y ordenar salas

Con dos o más salas la lista muestra un buscador (nombre o slug) y un selector de orden: última actividad (por defecto), conectados ahora, número de mensajes o nombre; la elección se recuerda por dispositivo. La última actividad sale de la misma consulta de mensajes que alimenta los contadores y se actualiza en vivo (`filterRooms`/`sortRooms` en `src/lib/rooms.ts`).

## Avatares de Hive

Cada persona que escribe en el chat (y cada una de la lista de conectados) muestra su foto de perfil de Hive, cargada desde `https://images.hive.blog/u/<cuenta>/avatar/small`, con una inicial de reserva. Es la única petición a terceros que hace la app para contenido, y se avisa en la sección de privacidad de la ayuda (`src/components/Avatar.tsx`, `src/lib/hiveAvatar.ts`).

## Enlaces y longitud de los mensajes

Las URL http(s) de los mensajes se muestran como enlaces (`target=_blank`, `rel="noopener noreferrer nofollow"`; la puntuación final se deja fuera y una `@` dentro de una URL no es una mención). Los mensajes tienen un máximo de 2000 caracteres, que impone el relé y replica el `maxLength` del campo de texto (`src/features/chat/linkify.ts`).

## Errores del relé más claros

Los motivos de rechazo del relé siguen en inglés en el cable (NIP-01), pero los que un usuario puede provocar de verdad —enviar demasiado rápido (límite de velocidad), un mensaje de más de 2000 caracteres, un dispositivo sin vincular, no tener conexión— se muestran como mensajes traducidos y en lenguaje llano (`src/lib/relayErrors.ts`, claves `errors.*`); cualquier otro se muestra tal como lo envió el relé.

## Reacciones

Cada mensaje tiene un botón ☺+ para reaccionar con uno de seis emojis; las etiquetas bajo el mensaje cuentan cuentas Hive distintas y resaltan la tuya. Una reacción es un evento NIP-25 `kind:7` (`e` id del mensaje, `p` autor, `t` sala) que se quita con un borrado NIP-09, también desde otro dispositivo de la misma cuenta. El relé solo acepta su lista cerrada de emojis, y `REACTION_EMOJIS` del frontend (`src/features/chat/reactions.ts`) debe coincidir. Requiere la versión del relé que acepta kind 7.

## Una sola conexión al relé

Toda la app comparte un único WebSocket con el relé (`src/lib/sharedRelay.ts`) en vez de abrir uno por cada hook o consulta, así que recargar la página varias veces ya no agota el límite de conexiones por IP del relé. Las consultas puntuales vencen a los 10 s en lugar de quedarse colgadas.

## Historial más largo

Una sala se abre con sus últimos 200 mensajes; subir hasta arriba (o el botón «cargar mensajes anteriores») trae los anteriores de 100 en 100 con `until`, y sus reacciones, y mantiene la posición del scroll para que la vista no salte (`src/features/chat/history.ts`, `loadOlder` en `useChatRoom.ts`). Requiere la versión del relé que sube los límites de consulta de sqlite: antes, toda consulta devolvía como máximo 100 eventos sin avisar.

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
lado del cliente (salvo los pocos que un usuario puede provocar, ver «Errores del relé más claros»).

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
