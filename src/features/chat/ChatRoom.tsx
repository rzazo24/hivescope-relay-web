import { type FormEvent, type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { describeRelayError } from '../../lib/relayErrors'
import { translateText, translationSupported, type TranslateResult } from '../../lib/translate'
import { useHiveAccountNames } from '../../hooks/useHiveAccountNames'
import type { NostrIdentity } from '../../lib/nostrIdentity'
import type { Room } from '../../lib/rooms'
import { Avatar } from '../../components/Avatar'
import { ConfirmModal } from '../../components/ConfirmModal'
import { OnlineBadge } from '../../components/OnlineBadge'
import { useOnline } from '../../hooks/usePresence'
import { peopleInRoom } from '../../lib/presence'
import { EmojiPicker } from '../../components/EmojiPicker'
import { insertAtCursor } from '../../lib/emojis'
import { roomUrl } from '../../lib/roomRoute'
import { isOwnMessage } from './deletion'
import { applyMention, insertMention, mentionCandidates, mentionQuery, mentionsAccount, quoteSnippet } from './mentions'
import { chipsFor, myReactionIds, REACTION_EMOJIS } from './reactions'
import { MAX_MESSAGE_LENGTH, splitMessage } from './linkify'
import { type ChatMessage, useChatRoom } from './useChatRoom'

function shortPubkey(pubkey: string) {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`
}

function ReplyQuote({
  parent,
  parentId,
  nameOf,
  fallback,
  onJump,
}: {
  parent: ChatMessage | null
  parentId: string
  nameOf: (pubkey: string) => string
  fallback: string
  onJump: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => parent && onJump(parentId)}
      className="mb-0.5 block max-w-full truncate border-l-2 border-border pl-2 text-left text-[11px] text-muted hover:text-ink"
    >
      ↩ {parent ? `${nameOf(parent.pubkey)}: ${quoteSnippet(parent.content, 80)}` : fallback}
    </button>
  )
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
  const { t, i18n } = useTranslation()
  const { messages, reactions, hasMore, loadingOlder, loadOlder, connected, sending, error, send, remove, react, unreact } = useChatRoom(room.slug, identity)
  const online = useOnline()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  // Traducción bajo demanda (en el dispositivo, ver lib/translate.ts): por id de mensaje.
  const [translations, setTranslations] = useState<Record<string, { status: 'loading' | 'done' | 'error'; progress?: number; result?: TranslateResult }>>({})
  const canTranslate = translationSupported()
  const translate = async (msg: ChatMessage) => {
    const set = (v: { status: 'loading' | 'done' | 'error'; progress?: number; result?: TranslateResult } | null) =>
      setTranslations((prev) => {
        const next = { ...prev }
        if (v) next[msg.id] = v
        else delete next[msg.id]
        return next
      })
    set({ status: 'loading' })
    try {
      const result = await translateText(msg.content, i18n.resolvedLanguage ?? i18n.language, (f) => set({ status: 'loading', progress: f }))
      set({ status: 'done', result })
    } catch {
      set({ status: 'error' })
    }
  }
  const hideTranslation = (id: string) =>
    setTranslations((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  // Reacciones: mías = este pubkey u otro dispositivo de mi cuenta Hive.
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const isMineKey = (pk: string) => isOwnMessage(pk, identity.publicKey, account, senderNames)
  const toggleReaction = (msg: ChatMessage, emoji: string) => {
    setPickerFor(null)
    const ids = myReactionIds(reactions, msg.id, emoji, isMineKey)
    if (ids.length > 0) void unreact(ids)
    else void react(msg, emoji)
  }
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [caret, setCaret] = useState(0)
  const [pickIndex, setPickIndex] = useState(0)
  const senderNames = useHiveAccountNames([...messages.map((m) => m.pubkey), ...reactions.map((r) => r.pubkey)])

  // Cuentas que se pueden mencionar: quien ha escrito aquí y quien está en la sala.
  const knownAccounts = [
    ...senderNames.values(),
    ...peopleInRoom(online.people, room.slug).flatMap((p) => (p.account ? [p.account] : [])),
  ]
  // Quién escribe ahora: fuera yo, y fuera quien ya ha enviado su mensaje después
  // de empezar a escribir (su último aviso puede durar unos segundos más).
  const typers = (online.typing.get(room.slug) ?? [])
    .filter((x) => x.account !== account.toLowerCase())
    .filter(
      (x) =>
        !messages.some(
          (m) => senderNames.get(m.pubkey)?.toLowerCase() === x.account && m.createdAt * 1000 >= x.at - 1500,
        ),
    )
    .map((x) => x.account)
  const mention = mentionQuery(draft, caret)
  // Si ya está escrita entera la única cuenta posible, no hay nada que completar:
  // Enter tiene que enviar el mensaje, no "elegir" lo que ya está puesto.
  const rawCandidates = mention ? mentionCandidates(knownAccounts, mention.query, account) : []
  const candidates = rawCandidates.length === 1 && rawCandidates[0].toLowerCase() === mention?.query ? [] : rawCandidates
  const showCandidates = candidates.length > 0 && !sending

  const pickMention = (acc: string) => {
    if (!mention) return
    const { text, caret: c } = applyMention(draft, mention.start, caret, acc)
    setDraft(text)
    setCaret(c)
    setPickIndex(0)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(c, c)
    })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showCandidates) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const d = e.key === 'ArrowDown' ? 1 : -1
        setPickIndex((i) => (i + d + candidates.length) % candidates.length)
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        pickMention(candidates[Math.min(pickIndex, candidates.length - 1)])
        return
      }
    }
    if (e.key === 'Escape' && replyingTo) setReplyingTo(null)
  }

  // Pulsar el nombre de alguien escribe su @mención en el mensaje (en el cursor si
  // el campo tiene el foco; si no, al final).
  const mentionUser = (acc: string) => {
    const el = inputRef.current
    const focused = el !== null && document.activeElement === el
    const at = focused ? (el.selectionStart ?? draft.length) : draft.length
    const { text, caret: c } = insertMention(draft, at, focused ? (el.selectionEnd ?? at) : at, acc)
    setDraft(text)
    setCaret(c)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(c, c)
    })
  }

  const startReply = (msg: ChatMessage) => {
    setReplyingTo(msg)
    inputRef.current?.focus()
  }

  const nameOf = (pubkey: string) => (senderNames.has(pubkey) ? `@${senderNames.get(pubkey)}` : shortPubkey(pubkey))

  const jumpTo = (id: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-msg="${id}"]`)
    el?.scrollIntoView({ block: 'center' })
  }

  // Al fondo cuando llega un mensaje NUEVO (cambia el último), no cuando se
  // añade historial por arriba: ahí hay que conservar lo que se está leyendo.
  const newestId = messages[messages.length - 1]?.id
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [newestId])

  const oldestId = messages[0]?.id
  const anchorRef = useRef<{ height: number; top: number } | null>(null)
  const requestOlder = () => {
    const el = listRef.current
    if (!el || loadingOlder || !hasMore) return
    anchorRef.current = { height: el.scrollHeight, top: el.scrollTop }
    void loadOlder()
  }
  // Tras añadir mensajes por arriba, se recoloca el scroll para que no salte.
  useLayoutEffect(() => {
    const el = listRef.current
    const anchor = anchorRef.current
    if (el && anchor) {
      el.scrollTop = el.scrollHeight - anchor.height + anchor.top
      anchorRef.current = null
    }
  }, [oldestId])

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
    setCaret(0)
    setReplyingTo(null)
    send(content, replyingTo ?? undefined)
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
          <OnlineBadge count={online.byRoom.get(room.slug) ?? 0} people={peopleInRoom(online.people, room.slug)} myAccount={account} />
        </div>
      </div>

      {/* Solo oculta el historial en la conexión inicial; si se cae después
          de haber cargado mensajes, se ven igual y solo aparece el aviso. */}
      {!connected && messages.length > 0 && (
        <p className="text-xs text-error">{t('chat.reconnecting')}</p>
      )}

      <div
        ref={listRef}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop < 60) requestOlder()
        }}
        className="flex h-[50vh] min-h-72 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-code p-3 sm:h-[55vh] lg:h-[60vh]"
      >
        {hasMore && (
          <button
            type="button"
            onClick={requestOlder}
            disabled={loadingOlder}
            className="self-center text-xs text-muted underline decoration-dotted underline-offset-2 hover:text-ink disabled:no-underline disabled:opacity-60"
          >
            {loadingOlder ? t('chat.loadingOlder') : t('chat.loadOlder')}
          </button>
        )}
        {!connected && messages.length === 0 && <p className="text-xs text-muted">{t('chat.connecting')}</p>}
        {connected && messages.length === 0 && <p className="text-xs text-muted">{t('chat.empty')}</p>}

        {messages.map((msg) => {
          // Mío = este pubkey u otro dispositivo de mi misma cuenta Hive (el relé
          // deja borrar en ambos casos, ver NewDeletionOutcome).
          const isMe = isOwnMessage(msg.pubkey, identity.publicKey, account, senderNames)
          return (
            <div
              key={msg.id}
              data-msg={msg.id}
              className={
                !isMe && (mentionsAccount(msg.content, account) || (msg.replyTo !== null && msg.mentioned.includes(identity.publicKey)))
                  ? '-mx-1.5 border-l-2 border-accent bg-surface px-1.5'
                  : undefined
              }
            >
              <div className="flex items-baseline gap-2 text-[11px] text-muted">
                {(isMe ? account : senderNames.get(msg.pubkey)) && <Avatar account={isMe ? account : senderNames.get(msg.pubkey)!} />}
                {isMe || !senderNames.has(msg.pubkey) ? (
                  <span>{isMe ? t('chat.you') : shortPubkey(msg.pubkey)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => mentionUser(senderNames.get(msg.pubkey)!)}
                    title={t('chat.mentionHint')}
                    className="transition hover:text-accent"
                  >
                    @{senderNames.get(msg.pubkey)}
                  </button>
                )}
                <span>{formatTime(msg.createdAt)}</span>
                <button
                  type="button"
                  onClick={() => startReply(msg)}
                  className="underline decoration-dotted underline-offset-2 transition hover:text-accent"
                >
                  {t('chat.reply')}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerFor(pickerFor === msg.id ? null : msg.id)}
                  aria-expanded={pickerFor === msg.id}
                  aria-label={t('chat.react')}
                  title={t('chat.react')}
                  className="transition hover:text-accent"
                >
                  ☺+
                </button>
                {canTranslate && !isMe && !translations[msg.id] && (
                  <button
                    type="button"
                    onClick={() => void translate(msg)}
                    className="underline decoration-dotted underline-offset-2 transition hover:text-accent"
                  >
                    {t('chat.translate')}
                  </button>
                )}
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
              {msg.replyTo && (
                <ReplyQuote
                  parent={messages.find((m) => m.id === msg.replyTo) ?? null}
                  nameOf={nameOf}
                  fallback={t('chat.replyMissing')}
                  onJump={jumpTo}
                  parentId={msg.replyTo}
                />
              )}
              <p className={`break-words ${isMe ? 'text-accent' : 'text-ink'}`}>
                {splitMessage(msg.content).map((piece, i) =>
                  piece.url ? (
                    <a
                      key={i}
                      href={piece.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="break-all underline decoration-dotted underline-offset-2 hover:text-accent"
                    >
                      {piece.text}
                    </a>
                  ) : piece.account ? (
                    <span
                      key={i}
                      className={piece.account === account.toLowerCase() ? 'rounded-sm bg-accent px-0.5 font-bold text-accent-ink' : 'font-bold text-accent'}
                    >
                      {piece.text}
                    </span>
                  ) : (
                    piece.text
                  ),
                )}
              </p>
              {pickerFor === msg.id && (
                <div className="mt-1 flex gap-1" role="group" aria-label={t('chat.react')}>
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => toggleReaction(msg, emoji)}
                      className="rounded border border-border bg-surface px-1.5 py-0.5 text-sm transition hover:border-accent"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              {(() => {
                const chips = chipsFor(reactions, msg.id, (pk) => senderNames.get(pk), isMineKey)
                return chips.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {chips.map((chip) => (
                      <button
                        key={chip.emoji}
                        type="button"
                        onClick={() => toggleReaction(msg, chip.emoji)}
                        title={chip.who.join(', ')}
                        aria-pressed={chip.mine}
                        className={`rounded-full border px-2 py-0.5 text-xs transition ${chip.mine ? 'border-accent bg-surface text-accent' : 'border-border text-muted hover:border-accent'}`}
                      >
                        {chip.emoji} {chip.count}
                      </button>
                    ))}
                  </div>
                ) : null
              })()}
              {translations[msg.id] && (
                <p className="mt-0.5 border-l-2 border-border pl-2 text-xs text-muted">
                  {translations[msg.id].status === 'loading' &&
                    (translations[msg.id].progress !== undefined
                      ? t('chat.translateDownloading', { percent: Math.round((translations[msg.id].progress ?? 0) * 100) })
                      : t('chat.translating'))}
                  {translations[msg.id].status === 'error' && t('chat.translateError')}
                  {translations[msg.id].status === 'done' && translations[msg.id].result && (() => {
                    const r = translations[msg.id].result!
                    if (r.kind === 'translated') return <><span className="text-ink">{r.text}</span> · {t('chat.translatedFrom', { lang: r.from })}</>
                    if (r.kind === 'same-language') return t('chat.translateSame')
                    if (r.kind === 'unavailable') return t('chat.translateUnavailable', { lang: r.from })
                    return t('chat.translateUnknown')
                  })()}{' '}
                  {translations[msg.id].status !== 'loading' && (
                    <button type="button" onClick={() => hideTranslation(msg.id)} className="underline decoration-dotted underline-offset-2 hover:text-ink">
                      {t('chat.translateHide')}
                    </button>
                  )}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="-mt-1 h-4 truncate text-[11px] text-muted" aria-live="polite">
        {typers.length === 1 && t('chat.typingOne', { a: `@${typers[0]}` })}
        {typers.length === 2 && t('chat.typingTwo', { a: `@${typers[0]}`, b: `@${typers[1]}` })}
        {typers.length > 2 && t('chat.typingMany', { count: typers.length })}
      </p>

      {replyingTo && (
        <div className="flex items-center justify-between gap-2 border-l-2 border-accent bg-code px-2 py-1 text-xs text-muted">
          <span className="min-w-0 truncate">
            {t('chat.replyingTo', { name: nameOf(replyingTo.pubkey) })} · {quoteSnippet(replyingTo.content, 60)}
          </span>
          <button type="button" onClick={() => setReplyingTo(null)} aria-label={t('chat.replyCancel')} className="shrink-0 hover:text-error">
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative flex gap-2">
        {showCandidates && (
          <ul role="listbox" className="absolute bottom-full left-0 z-10 mb-1 min-w-40 overflow-hidden rounded-md border border-border bg-surface text-xs shadow-lg">
            {candidates.map((c, i) => (
              <li key={c} role="option" aria-selected={i === pickIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickMention(c)}
                  className={`block w-full px-3 py-1.5 text-left ${i === pickIndex ? 'bg-surface-2 text-accent' : 'text-ink hover:bg-surface-2'}`}
                >
                  @{c}
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => {
            if (e.target.value.trim()) online.notifyTyping()
            setDraft(e.target.value)
            setCaret(e.target.selectionStart ?? e.target.value.length)
            setPickIndex(0)
          }}
          maxLength={MAX_MESSAGE_LENGTH}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
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

      {error && <p className="rounded-md bg-error-bg px-3 py-2.5 text-xs text-error">! {describeRelayError(error, t)}</p>}

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
