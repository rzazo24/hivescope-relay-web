# hivescope-web

[![CI](https://github.com/rzazo24/hivescope-relay-web/actions/workflows/ci.yml/badge.svg)](https://github.com/rzazo24/hivescope-relay-web/actions/workflows/ci.yml)

*[Leer en español](README.es.md)*

Frontend for the HiveScope chat: link a [Hive](https://hive.io/) account
with [Hive Keychain](https://hive-keychain.com/), browse/create rooms, and
chat, all backed by
[hivescope-relay](https://github.com/rzazo24/hivescope-relay).

Live at **[chat.hivescope.xyz](https://chat.hivescope.xyz)**.

This is a pure client-side SPA — no backend of its own. It talks directly
to the relay over `wss://` and to Hive Keychain (browser extension or
mobile app) from the browser; there's nothing to run server-side beyond
serving the static build.

## Stack

Vite + React + TypeScript + Tailwind v4 (`@theme` tokens, no config file),
[nostr-tools](https://github.com/nbd-wtf/nostr-tools) for the Nostr side,
[i18next](https://www.i18next.com/) for English/Spanish.

## Running locally

```bash
npm install
npm run dev
```

By default it talks to the production relay (`wss://relay.hivescope.xyz`).
To point it at a local `hivescope-relay` instance instead, copy
`.env.example` to `.env.local` and set `VITE_RELAY_URL`.

```bash
npm run build   # tsc -b && vite build -> dist/
npm run lint    # oxlint
npm test        # vitest run
```

Tests cover pure logic (identity persistence, room slug parsing, the
Keychain challenge/signing flow, en/es translation parity) — anything that
needs a live relay connection is instead verified by hand against a real
`hivescope-relay` instance, see `CLAUDE.md`.

## Project structure

```
src/lib/               framework-agnostic helpers: relay connection, Nostr
                        identity (generated once per browser, kept in
                        localStorage), Hive Keychain, room queries
src/features/link/      the Hive Keychain linking screen
src/features/rooms/     list/create rooms
src/features/chat/      a room's live chat (kept-open subscription,
                        auto-reconnect)
src/components/         shared UI (TerminalWindow chrome, language switcher)
src/i18n/               en/es strings and i18next setup
```

See [`CLAUDE.md`](CLAUDE.md) for how the pieces fit together (the linking
flow, why identity lives in localStorage, how live messages and
reconnection work).

## Room admin

Whoever creates a room becomes its owner, and rooms carry an `admin` pubkey
tag; the owner or current admin can rename the room or hand off admin to
another account (the "edit" link next to a room in the list, only shown
when your linked identity is that room's owner or admin), enforced by the
relay's `NewRoomMetaPolicy`. This is the room's only enforced privilege —
anyone linked can still post in any room; there's no message-deletion or
kick/ban capability.

## Room expiration

Rooms aren't permanent: creating or editing one lets you pick how long it
lasts (1h, 24h, 7, 30, or 90 days — `ROOM_LIFETIME_OPTIONS` in
`src/lib/rooms.ts`), stamped as a NIP-40 `expiration` on that publish. The
relay auto-deletes the room — then its messages — once that time passes
with no updates (the short options are best-effort: cleanup runs roughly
hourly, so a 1h room may outlive its mark by up to an hour). Renaming a
room, or any other edit, resets the clock with
whatever duration you pick at that moment; there's no separate "renew"
button, editing is enough. Each room in the list shows how long it has
left.

## The Hive↔Nostr link, in short

Signing in publishes a `kind:30078` event (`d=hive-link`) whose `hive_sig`
tag is the account's **posting** key signing the exact string
`hivescope-relay-link:<nostr_pubkey>` — see
[`src/lib/hiveKeychain.ts`](src/lib/hiveKeychain.ts) (`linkChallenge`).
This has to match `LinkChallenge` in the relay's
`internal/policies/hivelink.go` byte-for-byte; if you're touching either
side, check the other.

## i18n

English and Spanish (Spain), detected from the browser on first visit,
switchable any time (`$ lang en/es` in the corner) and remembered in
localStorage. All UI strings go through `useTranslation()` from the
start — see `src/i18n/locales/*.json`.

Relay rejection reasons (shown as-is when something's invalid) are in
English, matching NIP-01 convention for OK messages meant to be read by
any Nostr client — they aren't re-translated client-side.

## Theme

Dark ("hacker terminal": black, neon green) by default, with a light
variant — same green brand accent, paper-white background — switchable any
time (`$ theme dark/light` in the corner) and remembered in localStorage.
A first-time visitor with nothing stored gets whichever matches their OS
preference, same as the language detection above.

## Deploying

There's no Dockerfile here — the static build is served by the same Caddy
instance [hivescope-relay](https://github.com/rzazo24/hivescope-relay)
already runs on the VPS (only one process can bind to port 443). See that
repo's `docker-compose.yml` / `Caddyfile` and README for the exact setup;
in short, this repo is expected checked out as a sibling directory
(`../hivescope-web` relative to `hivescope-relay`), and shipping a new
build means `npm run build` here followed by recreating that `caddy`
container.

## License

[MIT](LICENSE)
