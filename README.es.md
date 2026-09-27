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
Para apuntarlo a una instancia local de `hivescope-relay`, copiá
`.env.example` a `.env.local` y configurá `VITE_RELAY_URL`.

```bash
npm run build   # tsc -b && vite build -> dist/
npm run lint    # oxlint
```

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

## La vinculación Hive↔Nostr, resumida

Vincularse publica un evento `kind:30078` (`d=hive-link`) cuyo tag
`hive_sig` es la clave **posting** de la cuenta firmando exactamente el
string `hivescope-relay-link:<pubkey_nostr>` — ver
[`src/lib/hiveKeychain.ts`](src/lib/hiveKeychain.ts) (`linkChallenge`).
Esto tiene que coincidir byte a byte con `LinkChallenge` en
`internal/policies/hivelink.go` del relé; si tocás un lado, revisá el otro.

## i18n

Inglés y español (de España), detectado del navegador en la primera
visita, cambiable en cualquier momento (`$ lang en/es` en la esquina) y
recordado en localStorage. Todos los strings de la UI pasan por
`useTranslation()` desde el principio — ver `src/i18n/locales/*.json`.

Los motivos de rechazo del relé (se muestran tal cual cuando algo es
inválido) están en inglés, siguiendo la convención de NIP-01 para mensajes
OK pensados para que los lea cualquier cliente Nostr — no se retraducen del
lado del cliente.

## Desplegar

Acá no hay Dockerfile — el build estático lo sirve el mismo Caddy que ya
corre [hivescope-relay](https://github.com/rzazo24/hivescope-relay) en el
VPS (solo un proceso puede escuchar en el puerto 443). Ver el
`docker-compose.yml`/`Caddyfile` y el README de ese repo para el detalle
exacto; en resumen, se espera que este repo esté clonado como directorio
hermano (`../hivescope-web` relativo a `hivescope-relay`), y publicar un
build nuevo es correr `npm run build` acá y después recrear ese contenedor
`caddy`.

## Licencia

[MIT](LICENSE)
