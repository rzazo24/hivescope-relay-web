# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The frontend for the HiveScope chat: a pure client-side SPA (no backend of
its own) that links a Hive account via Hive Keychain, then talks directly
to [hivescope-relay](https://github.com/rzazo24/hivescope-relay) over
`wss://` for everything else. Live at https://chat.hivescope.xyz. Full
behavior and the deploy setup are in `README.md`/`README.es.md`; this file
is about how the code fits together.

hivescope-relay is a **separate repo**, checked out as a sibling directory
on the VPS (`../hivescope-relay`). Don't assume relay source is available
here — if you need to check the exact contract (event shapes, the
`LinkChallenge` string, rejection messages), read `../hivescope-relay`
directly or its README.

## Commands

```bash
npm install
npm run dev              # dev server, defaults to wss://relay.hivescope.xyz
npm run build             # tsc -b && vite build -> dist/
npm run lint               # oxlint
npm test                   # vitest run
```

Vitest (jsdom env, configured in `vite.config.ts`'s `test` block) covers the
pure/deterministic logic: `src/lib/*.test.ts` (identity generation +
persistence, `slugifyRoom`, `parseRoomEvent`'s edge cases, and a mocked
`window.hive_keychain` for `waitForKeychain`/`requestHiveSignature`) and
`src/i18n/locales.test.ts` (en/es key parity — this exists because
untranslated strings have actually slipped through before). It does
**not** cover anything that needs a live relay connection (`listRooms`,
`createRoom`, the chat subscription, the actual linking flow) — that
verification has so far meant running a real build against the real relay
with Playwright instead (see recent commit messages for examples), because
those paths are thin glue over `nostr-tools` and the relay's actual
behavior, and mocking `nostr-tools/relay` convincingly would test the mock
more than the app. Keep that split when adding tests: pure logic gets a
Vitest unit test, anything relay-shaped gets exercised for real before
calling a change done.

## Architecture

**Identity**: `src/lib/nostrIdentity.ts` generates one Nostr keypair per
browser on first visit and keeps it in `localStorage`
(`hivescope:nostr-secret-key`). There's no NIP-07 extension support and no
import-an-existing-nsec flow — each device/browser is its own identity, by
design (the relay already allows one Hive account to link multiple Nostr
pubkeys, so this isn't a real limitation, just a UX simplification).

**The three screens are gated by link status**, checked once at the top of
`App.tsx` via `useHiveLink()` (in `src/features/link/`) and passed down —
`LinkScreen` if unlinked, `RoomList`/`ChatRoom` if linked:

1. `src/features/link/` — `useHiveLink` detects `window.hive_keychain`
   with a retry loop (`waitForKeychain` in `src/lib/hiveKeychain.ts`), not
   a single check: mobile in-app browsers (the Keychain app's own browser)
   inject it a moment after page load, and worse, **Keychain's mobile
   browser doesn't inject at all into a cross-origin iframe** — this is
   why hivescope-relay serves its own equivalent signer tool
   (`web/tools/hive-link-signer.html`) as a real top-level page rather
   than an embedded preview. On submit it calls
   `hiveKeychain.requestHiveSignature`, then publishes the `hive-link`
   event via `lib/relay.ts`. On mount, it also checks
   `lib/relay.ts#findHiveLink` against the relay to restore "already
   linked" state — this is a real check against stored relay state, not
   just trusting local memory of a past success.
2. `src/features/rooms/` — `listRooms()` fetches **all** `kind:30078`
   events and filters client-side for a `d` tag starting with `room:`.
   This isn't a shortcut: Nostr filters have no prefix-match on tag
   values, so there is no way to ask the relay for just rooms
   server-side. `createRoom()` publishes a new `room:<slug>` event; the
   relay enforces first-claim-wins ownership, this code doesn't.
3. `src/features/chat/` — `useChatRoom` is the one hook that keeps a
   relay connection open for as long as the room is mounted (every other
   `lib/` helper is connect-do-one-thing-close). It connects with
   `{ enableReconnect: true }`; nostr-tools handles backoff reconnection
   and automatically re-fires the open subscription with an adjusted
   `since` on recovery, so messages aren't lost or re-fetched — but it
   doesn't expose a reconnect/disconnect *event*, so connection state is
   polled from `relay.connected` every second to drive the UI's
   green/red status dot and "reconnecting" banner.

**Styling**: Tailwind v4, config-free — tokens are defined directly in
`src/index.css` via `@theme` (colors, `--font-sans`/`--font-mono`). This
is currently a **single dark "hacker terminal" theme** (black background,
neon green, monospace everywhere, `TerminalWindow` chrome with the
three-dot title bar) — deliberately, per an explicit visual reference the
project owner gave; there's no light mode and no `prefers-color-scheme`
handling, unlike hivescope-relay's own `web/tools/*.html` pages (which use
a different, cream/red palette — don't copy that one here).

**i18n**: `i18next` + `react-i18next`, English/Spanish, set up in
`src/i18n/`. Every user-facing string must go through `useTranslation()`
and a key in both `locales/en.json` and `locales/es.json` from the start —
retrofitting hardcoded strings later is exactly what happened once already
in this project. One thing that does *not* get re-translated: relay
rejection reasons (`err.message` from a failed publish) are displayed
as-is, in English, matching NIP-01 convention — see the "i18n" section of
the README for why.
