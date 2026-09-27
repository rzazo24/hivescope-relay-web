import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NostrIdentity } from '../../lib/nostrIdentity'
import type { Room } from '../../lib/rooms'
import { useChatRoom } from './useChatRoom'

function shortPubkey(pubkey: string) {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`
}

function formatTime(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatRoom({
  room,
  identity,
  onBack,
}: {
  room: Room
  identity: NostrIdentity
  onBack: () => void
}) {
  const { t } = useTranslation()
  const { messages, connected, sending, error, send } = useChatRoom(room.slug, identity)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    setDraft('')
    send(content)
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <button type="button" onClick={onBack} className="text-xs text-muted hover:text-ink">
          {t('rooms.back')}
        </button>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-error'}`} />
          <span className="truncate">{room.name}</span>
        </div>
      </div>

      {/* Solo oculta el historial en la conexión inicial; si se cae después
          de haber cargado mensajes, se ven igual y solo aparece el aviso. */}
      {!connected && messages.length > 0 && (
        <p className="text-xs text-error">{t('chat.reconnecting')}</p>
      )}

      <div ref={listRef} className="flex h-72 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-code p-3">
        {!connected && messages.length === 0 && <p className="text-xs text-muted">{t('chat.connecting')}</p>}
        {connected && messages.length === 0 && <p className="text-xs text-muted">{t('chat.empty')}</p>}

        {messages.map((msg) => {
          const isMe = msg.pubkey === identity.publicKey
          return (
            <div key={msg.id}>
              <div className="flex items-baseline gap-2 text-[11px] text-muted">
                <span>{isMe ? t('chat.you') : shortPubkey(msg.pubkey)}</span>
                <span>{formatTime(msg.createdAt)}</span>
              </div>
              <p className={isMe ? 'text-accent' : 'text-ink'}>{msg.content}</p>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('chat.placeholder')}
          autoComplete="off"
          disabled={!connected || sending}
          className="w-full rounded-md border border-border bg-code px-3 py-2.5 text-sm text-ink caret-accent outline-none focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!connected || sending || !draft.trim()}
          className="shrink-0 rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink shadow-[0_0_20px_-4px_rgba(0,255,162,0.6)] transition disabled:opacity-40 disabled:shadow-none"
        >
          {sending ? t('chat.sending') : t('chat.send')}
        </button>
      </form>

      {error && <p className="rounded-md bg-error-bg px-3 py-2.5 text-xs text-error">! {error}</p>}
    </div>
  )
}
