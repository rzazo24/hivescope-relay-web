import { finalizeEvent } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RELAY_URL } from '../../lib/config'
import type { NostrIdentity } from '../../lib/nostrIdentity'
import { resolveHiveAccounts } from '../../lib/relay'
import { applyDeletion } from './deletion'

export interface ChatMessage {
  id: string
  pubkey: string
  content: string
  createdAt: number
}

/**
 * Se conecta al relé y mantiene la suscripción abierta para recibir
 * mensajes en vivo (no solo los que ya existían al entrar), igual que
 * hace room-viewer.html en hivescope-relay.
 */
export function useChatRoom(slug: string, identity: NostrIdentity) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const relayRef = useRef<Relay | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Aplica un borrado: al instante para los mensajes del mismo pubkey, y --tras
  // resolver las cuentas Hive-- también para los de otros dispositivos de la
  // misma cuenta, que es lo que acepta el relé.
  const applyDeletionEvent = useCallback((event: { pubkey: string; tags: string[][] }) => {
    setMessages((prev) => applyDeletion(prev, event))

    const targets = new Set(event.tags.filter((t) => t[0] === 'e').map((t) => t[1]))
    const others = messagesRef.current.filter((m) => targets.has(m.id) && m.pubkey !== event.pubkey).map((m) => m.pubkey)
    if (others.length === 0) return
    void resolveHiveAccounts([event.pubkey, ...others]).then((accounts) => {
      const requester = accounts.get(event.pubkey)?.toLowerCase()
      if (!requester) return
      setMessages((prev) =>
        applyDeletion(prev, event, (author, req) => author === req || accounts.get(author)?.toLowerCase() === requester),
      )
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const seen = new Set<string>()

    // Reset intencional y síncrono al cambiar de sala: tiene que pasar
    // antes de que arranque la conexión nueva, si no un remount rápido
    // entre salas mostraría un instante los mensajes de la sala anterior.
    setMessages([])
    setConnected(false)
    setError(null)

    let pollHandle: ReturnType<typeof setInterval> | undefined

    Relay.connect(RELAY_URL, { enableReconnect: true })
      .then((relay) => {
        if (cancelled) {
          relay.close()
          return
        }
        relayRef.current = relay
        setConnected(true)

        // nostr-tools reconecta solo (con backoff) y vuelve a lanzar esta
        // suscripción al recuperar la conexión, pidiendo solo lo nuevo
        // desde el último evento visto -- no hace falta resuscribir a mano.
        // relay.connected no dispara ningún evento propio, así que lo
        // sondeamos para reflejar caídas/reconexiones reales en la UI.
        pollHandle = setInterval(() => setConnected(relay.connected), 1000)

        relay.subscribe([{ kinds: [9], '#t': [slug], limit: 200 }], {
          onevent(event) {
            if (seen.has(event.id)) return
            seen.add(event.id)
            setMessages((prev) =>
              [...prev, { id: event.id, pubkey: event.pubkey, content: event.content, createdAt: event.created_at }].sort(
                (a, b) => a.createdAt - b.createdAt,
              ),
            )
          },
        })

        // Borrados en vivo: cuando alguien retira un mensaje (kind 5, NIP-09),
        // desaparece también para quien ya lo tiene en pantalla. Sin historial
        // (since = ahora): lo ya borrado antes de entrar no llega en el kind 9.
        relay.subscribe([{ kinds: [5], since: Math.floor(Date.now() / 1000) }], {
          onevent(event) {
            applyDeletionEvent(event)
          },
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))

    return () => {
      cancelled = true
      if (pollHandle) clearInterval(pollHandle)
      relayRef.current?.close()
      relayRef.current = null
    }
  }, [slug, applyDeletionEvent])

  const send = useCallback(
    async (content: string) => {
      const relay = relayRef.current
      if (!relay) return

      setSending(true)
      setError(null)
      try {
        const event = finalizeEvent(
          {
            kind: 9,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', slug]],
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

  return { messages, connected, sending, error, send, remove }
}
