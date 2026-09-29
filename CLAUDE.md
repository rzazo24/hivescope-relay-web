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
   server-side. `createRoom(slug, name, adminPubkey, secretKey)` publishes
   a new/updated `room:<slug>` event; the relay enforces first-claim-wins
   ownership and, after that, that only the room's owner or current admin
   can keep publishing updates — this code doesn't re-check either, it
   just surfaces the relay's rejection reason if the publish fails.
   `adminPubkey` is a separate parameter from the signer (`secretKey`)
   specifically so editing a room (`RoomList.tsx`'s `RoomRow`, shown only
   when the signed-in identity is that room's `ownerPubkey` or `admin`)
   can resubmit the *current* `admin` value unchanged instead of silently
   reassigning it to whoever happens to be editing.

   **Ownership is per Hive account**: `canManageRoom` (`rooms.ts`) shows the
   edit button for the exact owner/admin pubkey *or* any pubkey whose linked
   account equals the owner's/admin's account (resolved with
   `useHiveAccountNames` over both `admin` and `ownerPubkey`), mirroring the
   relay's `sharesHiveAccount`, so a room made on your phone is editable
   from your PC. Cosmetic only — the relay decides.

   NIP-33 replacement is scoped to `(pubkey, kind, d)`, not just `(kind,
   d)` — so once a room's admin is delegated to a different pubkey and
   that pubkey publishes an update, the relay legitimately ends up storing
   two rows for the same `d` (the previous owner's and the new admin's).
   `listRooms()` dedupes these client-side by slug, keeping the newer one
   (`isNewerRoom`, same created_at/id tie-break as the relay's own
   `findRoomOwnership` in `roommeta.go`) — without this, a delegated room
   would render twice in the list.

   `SUPERADMIN_HIVE_ACCOUNT` (`src/lib/config.ts`, `VITE_SUPERADMIN_HIVE_ACCOUNT`,
   defaults to `'rzazo24'` same as the relay's own default) makes
   `RoomRow`'s edit button also show for rooms that account doesn't own or
   administer. This is **purely cosmetic** — the relay is the actual
   authority (`HIVESCOPE_SUPERADMIN_HIVE_ACCOUNT`, matched by Hive account
   name); this constant only stops the UI from hiding a button that would
   have worked anyway. The two must name the same account or the button
   either goes missing for a real superadmin or appears for someone the
   relay will still reject — there's no runtime check that they agree,
   they're just two independently-configured constants in two repos.

   `ROOM_LIFETIME_OPTIONS` (`rooms.ts`, `{label, seconds}` pairs — 1h, 24h,
   7d, 30d, 90d — default 30d) — `createRoom(slug, name, adminPubkey,
   secretKey, lifetimeSeconds)` stamps every room-metadata publish with an
   `expiration` tag (NIP-40) of `now + lifetimeSeconds`. The relay requires
   this tag and khatru auto-deletes the event once it passes; a separate
   relay-side sweep then deletes that room's chat messages too (see
   hivescope-relay's `internal/roomsweep`). The relay enforces expiration itself (`internal/roomsweep`, at startup and
   every 5 minutes) — not khatru's own NIP-40 sweep, which proved
   unreliable — so any duration, including 1h, can linger at most a few
   minutes past its mark. The same sweep deletes stale room rows left by
   *other pubkeys* (each browser has its own, so editing from another
   device used to leave an old row alive forever). Both `RoomList`'s
   create form and `RoomRow`'s edit form show a `LifetimeSelector`
   (1h/24h/7d/30d/90d toggle, same visual pattern as `ThemeSwitcher`) so
   whoever creates or edits a room picks the duration each time — the edit
   form's picker always resets to the 30-day default, it does not
   pre-select whatever the room's current duration happens to be (there's
   no way to recover the *original* duration someone picked from a NIP-33
   replaceable event, only the absolute `expiresAt` timestamp the last
   publish happened to compute — so there's nothing meaningful to
   pre-select from). Because *any* room-meta publish — create, rename,
   delegate admin, or even resubmitting unchanged via "edit" — stamps a
   fresh expiration, "renewing" a room (with whatever duration is picked
   at that moment) is just editing it; there's no dedicated renew action
   in this UI and none is needed.

   `Room.expiresAt` (parsed from the `expiration` tag by `parseRoomEvent`,
   0 if missing/malformed — old rooms created before this tag existed
   won't have one) and `formatTimeRemaining(expiresAt, now?)` (rounds down
   to the largest sensible unit — "3d", "5h", "12m" — floors at "1m"
   rather than showing "0m", returns `null` once past the deadline instead
   of a misleading negative) back the "expires in: Xd" shown next to a
   room's admin line and, in the edit form, above the `LifetimeSelector` as
   "currently expires in: Xd" so it's clear that line is status, not the
   picker. This is a point-in-time read from whenever `listRooms()` last
   ran, not a live ticking countdown — no interval/timer involved.
   **Mentions and replies** (`src/features/chat/mentions.ts`, pure and tested)
   need no relay support: `@account` is plain text in the kind:9 content
   (`splitMentions`), a reply adds NIP-10 tags `['e', id, '', 'reply']` +
   `['p', authorPubkey]` (`replyTags`). "For me" (`isForMe`) = mentions my Hive
   account or replies to a message whose `p` is *this device's* pubkey (a reply
   to my message from another device of mine isn't flagged). `useRooms` tallies
   those as `directed` (the `@N` badge). In the input, Enter/Tab pick an
   autocomplete candidate — except when the only candidate is already fully
   typed, otherwise Enter would never send.

   **Typing indicator** rides on the presence heartbeat: `notifyTyping` (from
   `useOnline()`, called on input change) publishes a beat with an extra
   `['typing']` tag, throttled to `TYPING_THROTTLE_MS` (the relay's presence
   limiter is per IP). Receivers keep a `TypingBook` and show it for
   `TYPING_MS`; `ChatRoom` also hides a typer once a message from their account
   newer than their last beat arrives. Needs the relay to accept the tag
   (deployed with the relay commit "allow a typing tag").

   **Browser notifications** (`src/lib/notifications.ts`, opt-in switch in
   `App.tsx`): `useRooms`' live kind:9 subscription calls `onDirected` for each
   new message that `isForMe`; `RoomList` resolves the sender and calls
   `showNotification`, which only fires with the preference on, permission
   granted and the tab hidden/unfocused. There is deliberately no push — no
   backend. `Notification.requestPermission` needs a user gesture, hence the
   button. Tested by stubbing `Notification` and `document.visibilityState` in
   Playwright (headless can't show real ones).

   **Room list search/sort**: `RoomList` filters and orders with the pure
   `filterRooms`/`sortRooms` (`rooms.ts`); "activity" uses `activity`
   (last kind:9 per room, from the same `fetchRoomMessages` query as the counts,
   bumped live), so rooms with no messages sort last. Sort mode is kept in
   localStorage `hivescope:room-sort`.

   **Avatars** (`Avatar.tsx`, `hiveAvatar.ts`) hotlink
   `images.hive.blog/u/<account>/avatar/small` with `referrerPolicy=no-referrer`
   and a letter fallback on error; the account name is validated by regex before
   building the URL. Disclosed in the help's privacy text (the image host sees
   viewers' IPs) — keep that if you change the source.

   **Message translation** (`src/lib/translate.ts`, per-message state in
   `ChatRoom`) uses the browser's on-device `LanguageDetector` + `Translator`
   only — deliberately no external service (message text would leave the
   device). `translationSupported()` gates the link; `planTranslation` (pure,
   tested) decides translate / same-language / unknown from the detector's
   answer. It must run from a click (the first use can download a language
   pack). Playwright's Chromium exposes the APIs but has no models, so tests
   stub `window.Translator`/`LanguageDetector`.

   **Links and length** (`chat/linkify.ts`): `splitMessage` splits URLs *first*
   and then mentions on the rest (so `@x` inside a URL isn't a mention; the
   same stripping is in `mentionsAccount`). Only http(s) with a dotted host
   becomes an `<a>`. `MAX_MESSAGE_LENGTH` (2000) mirrors the relay's
   `MaxChatMessageLength`; change both together.

   **Message counts and unread badges** also live in `useRooms.ts`: one
   `fetchRoomMessages` REQ (`kinds:[9], #t:[all slugs], limit 5000`) every 60 s
   feeds both `tallyMessages` (count) and `tallyUnread` (messages from other
   pubkeys newer than the per-room `lastSeen` in localStorage,
   `src/lib/unread.ts`); a `kinds:[9], limit:0` subscription bumps them live.
   Rooms with no `lastSeen` entry get a baseline of "now" (otherwise history
   would all be "new"); the open room is hidden from `unread` and stamped on
   enter/leave/tab-visible. The relay's filter rate limit (20/min, burst 60)
   is per IP, so many reloads in a row while testing make REQs fail silently
   (counts show 0) — wait a minute, it's not a bug.

   **The room list is live** (`useRooms.ts`): besides the one-shot
   `listRooms()` for the initial state, it keeps a subscription
   (`kinds:[30078], limit:0` = only new events) and merges each arriving room
   with `mergeRoom` (add, or replace if newer, else same list), so rooms
   created/edited from any device show up without reloading. Two things the
   subscription can't give you: (1) when the relay's `roomsweep` deletes an
   expired or superseded room it does a raw `DeleteEvent`, no NIP-09 event, so
   nobody is notified — hence `listRooms()` re-runs every 60 s and a 30 s tick
   re-evaluates `isRoomExpired` to hide expired rooms client-side right away;
   (2) events that arrive while the initial list is still loading are ignored
   (the list or the next refresh covers them).

   **Presence / online counter** (`usePresence` in `App`, `lib/presence.ts`):
   while linked, the app publishes an ephemeral heartbeat (kind 20078, see the
   relay's `presence.go`) every 25 s with the current room (`useRoomRoute` is a
   shared module-level store now, precisely so `App` knows the room), on room
   change, and a `left` beat on `pagehide`. It subscribes to everyone's beats
   and `countOnline` counts distinct *people* (Hive accounts, resolved with
   `resolveHiveAccounts`; unresolved pubkeys count individually meanwhile) with
   a beat < 70 s old — two devices of one account = one, per room and in total.
   Counts reach the UI through `OnlineProvider`/`useOnline` (top bar, room rows,
   room header via `OnlineBadge`). Newcomers don't know who's already there
   until their next beat, so every client answers a *new* pubkey with its own
   beat after a random 0.3–2 s (skipped if it beat < 1 s ago; the guard must be
   short because the last beat may predate the newcomer's subscription).
   `OnlineBadge` is a plain label on room rows (they're already a button) and a
   button with a dropdown elsewhere: the top bar lists everyone with the
   room(s) they're in (`showRooms`), the room header lists just that room
   (`peopleInRoom`); people are `@account` (with "(you)"), or a short pubkey
   until the account resolves. Account resolution can fail transiently
   (relay REQ rate limit closes the subscription), so `resolveHiveAccounts`
   resolves on `onclose` *without* caching the miss as "no account" (it used
   to hang forever), and the hook retries unresolved pubkeys every 15 s.
   Time is local receipt time, not event `created_at`. Only linked accounts
   announce, so unlinked visitors are invisible and uncounted. Verified with
   several browser contexts against a local relay: totals, per-room counts,
   same-account merge, leaving and closing a tab all update within seconds.

   **Hive snaps, opt-in** (`src/lib/hiveSnaps.ts`): after a room is
   created, `RoomList` only *offers* to share it (`snapOffer`); nothing is
   posted unless the user presses "share on Hive". Then `publishRoomSnap`
   finds the newest post by `@peak.snaps` (`bridge.get_account_posts`
   against `HIVE_API_NODE`, plain `fetch`) and asks Keychain
   (`requestHiveBroadcast` -> `requestBroadcast`, posting key) to broadcast a
   `comment` replying to it. It started as automatic on every creation and
   was made opt-in on request: a snap is permanent on-chain (even for 1h
   rooms) and costs a second Keychain prompt. Failure/cancel only shows a
   soft muted note. The `@peak.snaps` container is a PeakD convention, not a
   protocol, so it can silently stop working. Only creation offers a snap,
   not edits/renewals.
   **Room links** (`/r/<slug>`): the open room lives in the URL, not in
   component state. `useRoomRoute` (History API, no router lib) exposes
   `slug/open/replace`; `RoomList` derives `selectedRoom` from
   `rooms.find(slug)`, so a direct link works once the list loads (shows
   "loading" until then). Entering/leaving pushes history (browser back
   returns to the list); a slug that isn't in the list (expired/typo) gets
   `replace(null)` plus a dismissible "not found" note. Unlinked visitors see
   the link screen on that same URL and land in the room after linking. Works
   in production because Caddy serves `index.html` for unknown paths
   (`try_files {path} /index.html`) and assets are absolute (`/assets/...`).
   Slugs are only `[a-z0-9-]` (`slugFromPath` rejects anything else). The Hive
   snap now links to the room, and the room header has "copy link".
3. `src/features/chat/` — `useChatRoom` is the one hook that keeps a
   relay connection open for as long as the room is mounted (every other
   `lib/` helper is connect-do-one-thing-close). It connects with
   `{ enableReconnect: true }`; nostr-tools handles backoff reconnection
   and automatically re-fires the open subscription with an adjusted
   `since` on recovery, so messages aren't lost or re-fetched — but it
   doesn't expose a reconnect/disconnect *event*, so connection state is
   polled from `relay.connected` every second to drive the UI's
   green/red status dot and "reconnecting" banner.

**Emoji picker (desktop only)**: `EmojiPicker` (next to the chat send
button) opens a curated grid from `src/lib/emojis.ts` and inserts at the
input's caret via the pure `insertAtCursor`. It's hidden unless the device has
a fine pointer (Tailwind `pointer-fine:` = `@media (pointer: fine)`) because
mobile keyboards already have their own emoji picker. Custom list rather than
a library on purpose (no new dependency, matches the terminal styling); emoji
render with the OS emoji font, so they look different per platform.

   **Deleting your own messages**: `remove(id)` in `useChatRoom` publishes a
   NIP-09 `kind:5` (`e` tag = message id, `k` = 9) signed with this device's
   key; hivescope-relay only honors it for the message's author (verified: a
   different account gets "you are not the author").
   The hook also subscribes to `kind:5` with `since = now` so a deletion
   removes the message live for everyone in the room; `applyDeletion`
   (`deletion.ts`) re-checks author == requester client-side instead of
   trusting the relay. Deletion is **per Hive account** like room ownership:
   the relay (`NewDeletionOutcome`, via khatru's `OverwriteDeletionOutcome`)
   also accepts a `kind:5` from another pubkey linked to the same account,
   so `isOwnMessage` (pubkey or same account, using the accounts already
   resolved for sender names) decides who sees "delete" and the "you" label,
   and the hook resolves accounts before applying a deletion that comes from
   another device. It's a request, not a recall: the message
   was public from the moment it was sent (the help panel says so).

**Styling**: Tailwind v4, config-free — tokens are defined directly in
`src/index.css` via `@theme` (colors, `--font-sans`/`--font-mono`). The
"hacker terminal" look (monospace everywhere, `TerminalWindow` chrome with
the three-dot title bar) is unaffected by theme, but the color tokens have
two variants: dark (default — black background, neon green, the original
look per an explicit visual reference the project owner gave) and light
(`:root[data-theme="light"]`, added later on request — same green brand
identity, paper-white background). `src/lib/theme.ts` applies the theme by
setting `data-theme` on `<html>` (module side effect, run from `main.tsx`
before `index.css`/React mount, same pattern as `src/i18n/index.ts`
syncing `<html lang>`), persists the choice in localStorage
(`hivescope:theme`), and falls back to `prefers-color-scheme` only for a
first-time visitor with nothing stored yet — same precedent as the
language detector, not the three-state toggle hivescope-relay's own
`web/tools/*.html` pages use (manual dark/light only, no explicit "system"
option). `ThemeSwitcher.tsx` (next to `LanguageSwitcher` in the header)
is the toggle.

The light palette's accent (`--color-accent`, `#047857`) is deliberately
**darker** than the dark theme's neon `#00ffa2` — the same token is used as
plain text color in a couple of places (chat's "your own message" text,
`RoomRow`'s edit-link hover), and neon green as text fails contrast on a
light background even though it works fine as a dark theme's button
background (where it almost never appears as body text). If you add a new
use of `text-accent`, sanity-check it against both themes, not just dark.

**i18n**: `i18next` + `react-i18next`, English/Spanish, set up in
`src/i18n/`. Every user-facing string must go through `useTranslation()`
and a key in both `locales/en.json` and `locales/es.json` from the start —
retrofitting hardcoded strings later is exactly what happened once already
in this project. One thing that does *not* get re-translated: relay
rejection reasons (`err.message` from a failed publish) are displayed
as-is, in English, matching NIP-01 convention — see the "i18n" section of
the README for why.
