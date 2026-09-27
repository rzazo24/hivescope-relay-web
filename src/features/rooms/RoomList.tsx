import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NostrIdentity } from '../../lib/nostrIdentity'
import { slugifyRoom } from '../../lib/rooms'
import { useRooms } from './useRooms'

function shortPubkey(pubkey: string) {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`
}

export function RoomList({ identity, account }: { identity: NostrIdentity; account: string }) {
  const { t } = useTranslation()
  const { rooms, error, creating, createError, create } = useRooms()
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [newRoomName, setNewRoomName] = useState('')

  if (selectedSlug) {
    return (
      <div className="text-sm">
        <button type="button" onClick={() => setSelectedSlug(null)} className="text-xs text-muted hover:text-ink">
          {t('rooms.back')}
        </button>
        <p className="mt-3 text-ink">{t('rooms.enteredTitle', { slug: selectedSlug })}</p>
        <p className="mt-1 text-muted">{t('rooms.enteredBody')}</p>
      </div>
    )
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    const slug = slugifyRoom(newRoomName)
    if (!slug) return
    const ok = await create(slug, newRoomName.trim(), identity.secretKey)
    if (ok) setNewRoomName('')
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-xs text-muted">{t('rooms.linkedAs', { account })}</p>

      <div>
        {rooms === null && !error && <p className="text-muted">{t('rooms.loading')}</p>}
        {error && <p className="rounded-md bg-error-bg px-3 py-2.5 text-xs text-error">! {error}</p>}
        {rooms?.length === 0 && <p className="text-muted">{t('rooms.empty')}</p>}

        {rooms && rooms.length > 0 && (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
            {rooms.map((room) => (
              <li key={`${room.ownerPubkey}:${room.slug}`}>
                <button
                  type="button"
                  onClick={() => setSelectedSlug(room.slug)}
                  className="flex w-full items-center justify-between gap-3 bg-code px-3 py-2.5 text-left transition hover:bg-surface-2"
                >
                  <span className="text-ink">
                    <span className="text-muted">&gt; </span>
                    {room.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {t('rooms.adminPrefix')} {shortPubkey(room.admin)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-2 border-t border-border pt-4">
        <label htmlFor="new-room" className="text-xs text-muted">
          {t('rooms.createPrompt')}
        </label>
        <div className="flex gap-2">
          <input
            id="new-room"
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder={t('rooms.namePlaceholder')}
            autoComplete="off"
            disabled={creating}
            className="w-full rounded-md border border-border bg-code px-3 py-2.5 text-sm text-ink caret-accent outline-none focus:border-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={creating || !newRoomName.trim()}
            className="shrink-0 rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink shadow-[0_0_20px_-4px_rgba(0,255,162,0.6)] transition disabled:opacity-40 disabled:shadow-none"
          >
            {creating ? t('rooms.creating') : t('rooms.create')}
          </button>
        </div>
        {createError && <p className="rounded-md bg-error-bg px-3 py-2.5 text-xs text-error">! {createError}</p>}
      </form>
    </div>
  )
}
