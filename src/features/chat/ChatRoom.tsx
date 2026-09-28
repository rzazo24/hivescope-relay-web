import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useHiveAccountNames } from '../../hooks/useHiveAccountNames'
import type { NostrIdentity } from '../../lib/nostrIdentity'
import type { Room } from '../../lib/rooms'
import { ConfirmModal } from '../../components/ConfirmModal'
import { OnlineBadge } from '../../components/OnlineBadge'
import { useOnline } from '../../hooks/usePresence'
import { EmojiPicker } from '../../components/EmojiPicker'
import { insertAtCursor } from '../../lib/emojis'
import { roomUrl } from '../../lib/roomRoute'
import { isOwnMessage } from './deletion'
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
  account,
  onBack,
}: {
  room: Room
  identity: NostrIdentity
  account: string
  onBack: () => void
}) {
  const { t } = useTranslation()
  const { messages, connected, sending, error, send, remove } = useChatRoom(room.slug, identity)
  const online = useOnline()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  const senderNames = useHiveAccountNames(messages.map((m) => m.pubkey))

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Inserta el emoji en la posición del cursor (o reemplazando la selección) y
  // devuelve el foco al campo con el cursor justo después.
  const handleEmoji = (emoji: string) => {
    const el = inputRef.current
    const { text, caret } = insertAtCursor(draft, el?.selectionStart ?? draft.length, el?.selectionEnd ?? draft.length, emoji)
    setDraft(text)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl(window.location.origin, room.slug))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // sin permiso de portapapeles (contexto no seguro, etc.): no hay nada útil que mostrar
    }
  }

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
        <button type="button" onClick={onBack} className="shrink-0 text-xs text-muted hover:text-ink">
          {t('rooms.back')}
        </button>
        <div className="flex min-w-0 items-center gap-3 text-xs text-muted">
          <button type="button" onClick={handleCopyLink} className="shrink-0 underline decoration-dotted underline-offset-2 hover:text-ink">
            {copied ? t('rooms.linkCopied') : t('rooms.copyLink')}
          </button>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? 'bg-success' : 'bg-error'}`} />
            <span className="truncate">{room.name}</span>
          </span>
          <OnlineBadge count={online.byRoom.get(room.slug) ?? 0} />
        </div>
      </div>

      {/* Solo oculta el historial en la conexión inicial; si se cae después
          de haber cargado mensajes, se ven igual y solo aparece el aviso. */}
      {!connected && messages.length > 0 && (
        <p className="text-xs text-error">{t('chat.reconnecting')}</p>
      )}

      <div
        ref={listRef}
        className="flex h-[50vh] min-h-72 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-code p-3 sm:h-[55vh] lg:h-[60vh]"
      >
        {!connected && messages.length === 0 && <p className="text-xs text-muted">{t('chat.connecting')}</p>}
        {connected && messages.length === 0 && <p className="text-xs text-muted">{t('chat.empty')}</p>}

        {messages.map((msg) => {
          // Mío = este pubkey u otro dispositivo de mi misma cuenta Hive (el relé
          // deja borrar en ambos casos, ver NewDeletionOutcome).
          const isMe = isOwnMessage(msg.pubkey, identity.publicKey, account, senderNames)
          return (
            <div key={msg.id}>
              <div className="flex items-baseline gap-2 text-[11px] text-muted">
                <span>
                  {isMe ? t('chat.you') : senderNames.has(msg.pubkey) ? `@${senderNames.get(msg.pubkey)}` : shortPubkey(msg.pubkey)}
                </span>
                <span>{formatTime(msg.createdAt)}</span>
                {isMe && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(msg.id)}
                    className="underline decoration-dotted underline-offset-2 transition hover:text-error"
                  >
                    {t('chat.delete')}
                  </button>
                )}
              </div>
              <p className={isMe ? 'text-accent' : 'text-ink'}>{msg.content}</p>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('chat.placeholder')}
          autoComplete="off"
          disabled={!connected || sending}
          className="min-w-0 flex-1 rounded-md border border-border bg-code px-3 py-2.5 text-sm text-ink caret-accent outline-none focus:border-accent disabled:opacity-60"
        />
        <EmojiPicker onPick={handleEmoji} disabled={!connected || sending} />
        <button
          type="submit"
          disabled={!connected || sending || !draft.trim()}
          aria-label={sending ? t('chat.sending') : t('chat.send')}
          title={sending ? t('chat.sending') : t('chat.send')}
          className="shrink-0 rounded-md bg-accent px-3.5 py-2.5 text-sm font-bold text-accent-ink shadow-[0_0_20px_-4px_rgba(0,255,162,0.6)] transition disabled:opacity-40 disabled:shadow-none"
        >
          {sending ? '…' : '➤'}
        </button>
      </form>

      {error && <p className="rounded-md bg-error-bg px-3 py-2.5 text-xs text-error">! {error}</p>}

      {pendingDelete && (
        <ConfirmModal
          title={`$ ${t('chat.deleteTitle')}`}
          message={t('chat.deleteConfirm')}
          confirmLabel={t('chat.deleteConfirmButton')}
          cancelLabel={t('chat.deleteCancel')}
          onConfirm={() => {
            const id = pendingDelete
            setPendingDelete(null)
            void remove(id)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
