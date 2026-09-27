import { finalizeEvent } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RELAY_URL } from '../../lib/config'
import type { NostrIdentity } from '../../lib/nostrIdentity'

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
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))

    return () => {
      cancelled = true
      if (pollHandle) clearInterval(pollHandle)
      relayRef.current?.close()
      relayRef.current = null
    }
  }, [slug])

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

  return { messages, connected, sending, error, send }
}
