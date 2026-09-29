import { finalizeEvent } from 'nostr-tools/pure'
import type { Relay } from 'nostr-tools/relay'
import type { Subscription } from 'nostr-tools/abstract-relay'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NostrIdentity } from '../../lib/nostrIdentity'
import { resolveHiveAccounts } from '../../lib/relay'
import { getRelay, queryOnce } from '../../lib/sharedRelay'
import { INITIAL_PAGE, mayHaveMore, mergeMessages, OLDER_PAGE, toChatMessage } from './history'
import { applyDeletion } from './deletion'
import { replyTags } from './mentions'
import { addReaction, parseReaction, REACTION_KIND, type Reaction, removeReactions } from './reactions'

export interface ChatMessage {
  id: string
  pubkey: string
  content: string
  createdAt: number
  /** Id del mensaje al que responde, si es una respuesta. */
  replyTo: string | null
  /** Pubkeys citados (tags p): a quién va dirigido. */
  mentioned: string[]
}

/**
 * Se conecta al relé y mantiene la suscripción abierta para recibir
 * mensajes en vivo (no solo los que ya existían al entrar), igual que
 * hace room-viewer.html en hivescope-relay.
 */
export function useChatRoom(slug: string, identity: NostrIdentity) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const slugRef = useRef(slug)
  useEffect(() => {
    slugRef.current = slug
  }, [slug])
  const [connected, setConnected] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const relayRef = useRef<Relay | null>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const messagesRef = useRef<ChatMessage[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  const reactionsRef = useRef<Reaction[]>([])
  useEffect(() => {
    reactionsRef.current = reactions
  }, [reactions])

  // Aplica un borrado: al instante para los mensajes del mismo pubkey, y --tras
  // resolver las cuentas Hive-- también para los de otros dispositivos de la
  // misma cuenta, que es lo que acepta el relé.
  const applyDeletionEvent = useCallback((event: { pubkey: string; tags: string[][] }) => {
    setMessages((prev) => applyDeletion(prev, event))
    setReactions((prev) => applyDeletion(prev, event))

    const targets = new Set(event.tags.filter((t) => t[0] === 'e').map((t) => t[1]))
    const others = [...messagesRef.current, ...reactionsRef.current]
      .filter((m) => targets.has(m.id) && m.pubkey !== event.pubkey)
      .map((m) => m.pubkey)
    if (others.length === 0) return
    void resolveHiveAccounts([event.pubkey, ...others]).then((accounts) => {
      const requester = accounts.get(event.pubkey)?.toLowerCase()
      if (!requester) return
      const sameAccount = (author: string, req: string) => author === req || accounts.get(author)?.toLowerCase() === requester
      setMessages((prev) => applyDeletion(prev, event, sameAccount))
      setReactions((prev) => applyDeletion(prev, event, sameAccount))
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const seen = new Set<string>()
    seenRef.current = seen

    // Reset intencional y síncrono al cambiar de sala: tiene que pasar
    // antes de que arranque la conexión nueva, si no un remount rápido
    // entre salas mostraría un instante los mensajes de la sala anterior.
    setMessages([])
    setReactions([])
    setHasMore(false)
    setLoadingOlder(false)
    setConnected(false)
    setError(null)

    let pollHandle: ReturnType<typeof setInterval> | undefined

    const subs: Subscription[] = []
    getRelay()
      .then((relay) => {
        if (cancelled) return
        relayRef.current = relay
        setConnected(true)

        // nostr-tools reconecta solo (con backoff) y vuelve a lanzar esta
        // suscripción al recuperar la conexión, pidiendo solo lo nuevo
        // desde el último evento visto -- no hace falta resuscribir a mano.
        // relay.connected no dispara ningún evento propio, así que lo
        // sondeamos para reflejar caídas/reconexiones reales en la UI.
        pollHandle = setInterval(() => setConnected(relay.connected), 1000)

        let initialCount = 0
        subs.push(
          relay.subscribe([{ kinds: [9], '#t': [slug], limit: INITIAL_PAGE }], {
            onevent(event) {
              if (seen.has(event.id)) return
              seen.add(event.id)
              initialCount++
              setMessages((prev) => mergeMessages(prev, [toChatMessage(event)]))
            },
            // una página inicial llena sugiere que hay historial más antiguo
            oneose() {
              setHasMore(mayHaveMore(initialCount, INITIAL_PAGE))
            },
          }),
        )

        // Reacciones (kind 7) de esta sala, con historial y en vivo.
        subs.push(
          relay.subscribe([{ kinds: [REACTION_KIND], '#t': [slug], limit: 2000 }], {
            onevent(event) {
              const reaction = parseReaction(event)
              if (reaction) setReactions((prev) => addReaction(prev, reaction))
            },
          }),
        )

        // Borrados en vivo: cuando alguien retira un mensaje (kind 5, NIP-09),
        // desaparece también para quien ya lo tiene en pantalla. Sin historial
        // (since = ahora): lo ya borrado antes de entrar no llega en el kind 9.
        subs.push(
          relay.subscribe([{ kinds: [5], since: Math.floor(Date.now() / 1000) }], {
            onevent(event) {
              applyDeletionEvent(event)
            },
          }),
        )
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))

    return () => {
      cancelled = true
      if (pollHandle) clearInterval(pollHandle)
      // solo se cierran las suscripciones: la conexión es compartida (lib/sharedRelay)
      subs.forEach((sub) => sub.close())
      relayRef.current = null
    }
  }, [slug, applyDeletionEvent])

  /** Trae la página de mensajes anteriores al más antiguo que se ve (y sus reacciones). */
  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0]
    if (!oldest || loadingOlder) return
    const room = slug
    setLoadingOlder(true)
    try {
      // `until` es inclusive: puede volver algún mensaje ya visto, se descarta por id
      const { events, complete } = await queryOnce([{ kinds: [9], '#t': [slug], until: oldest.createdAt, limit: OLDER_PAGE }])
      if (slugRef.current !== room) return // se cambió de sala mientras tanto
      const fresh = events.filter((e) => !seenRef.current.has(e.id))
      fresh.forEach((e) => seenRef.current.add(e.id))
      if (fresh.length > 0) {
        setMessages((prev) => mergeMessages(prev, fresh.map(toChatMessage)))
        const reactionEvents = await queryOnce([{ kinds: [REACTION_KIND], '#e': fresh.map((e) => e.id), limit: 2000 }])
        if (slugRef.current === room) {
          for (const ev of reactionEvents.events) {
            const reaction = parseReaction(ev)
            if (reaction) setReactions((prev) => addReaction(prev, reaction))
          }
        }
      }
      // sin nada nuevo, o con una respuesta a medias, no hay (más) historial que traer
      setHasMore(complete && fresh.length > 0 && mayHaveMore(events.length, OLDER_PAGE))
    } catch {
      // se puede volver a intentar con el botón
    } finally {
      if (slugRef.current === room) setLoadingOlder(false)
    }
  }, [slug, loadingOlder])

  const send = useCallback(
    async (content: string, replyTo?: { id: string; pubkey: string }) => {
      const relay = relayRef.current
      if (!relay) return

      setSending(true)
      setError(null)
      try {
        const event = finalizeEvent(
          {
            kind: 9,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', slug], ...(replyTo ? replyTags(replyTo) : [])],
            content,
          },
          identity.secretKey,
        )
        await relay.publish(event)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setSending(false)
      }
    },
    [slug, identity],
  )

  /** Reacciona con `emoji` al mensaje. Publica el evento kind:7 (NIP-25). */
  const react = useCallback(
    async (target: { id: string; pubkey: string }, emoji: string) => {
      const relay = relayRef.current
      if (!relay) return
      setError(null)
      try {
        const event = finalizeEvent(
          {
            kind: REACTION_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ['e', target.id],
              ['p', target.pubkey],
              ['t', slug],
            ],
            content: emoji,
          },
          identity.secretKey,
        )
        await relay.publish(event)
        const reaction = parseReaction(event)
        if (reaction) setReactions((prev) => addReaction(prev, reaction))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [slug, identity],
  )

  /** Quita reacciones propias (NIP-09) por id. */
  const unreact = useCallback(
    async (ids: string[]) => {
      const relay = relayRef.current
      if (!relay || ids.length === 0) return
      setError(null)
      try {
        const event = finalizeEvent(
          {
            kind: 5,
            created_at: Math.floor(Date.now() / 1000),
            tags: [...ids.map((id) => ['e', id]), ['k', String(REACTION_KIND)]],
            content: '',
          },
          identity.secretKey,
        )
        await relay.publish(event)
        setReactions((prev) => removeReactions(prev, new Set(ids)))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [identity],
  )

  /** Retira un mensaje propio (NIP-09). Devuelve true si el relé lo aceptó. */
  const remove = useCallback(
    async (id: string) => {
      const relay = relayRef.current
      if (!relay) return false

      setError(null)
      try {
        const event = finalizeEvent(
          {
            kind: 5,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ['e', id],
              ['k', '9'],
            ],
            content: '',
          },
          identity.secretKey,
        )
        await relay.publish(event)
        applyDeletionEvent(event)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return false
      }
    },
    [identity, applyDeletionEvent],
  )

  return { messages, reactions, hasMore, loadingOlder, loadOlder, connected, sending, error, send, remove, react, unreact }
}
