import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatRoom } from '../chat/ChatRoom'
import type { NostrIdentity } from '../../lib/nostrIdentity'
import { slugifyRoom, type Room } from '../../lib/rooms'
import { useRooms } from './useRooms'

function shortPubkey(pubkey: string) {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`
}

export function RoomList({ identity, account }: { identity: NostrIdentity; account: string }) {
  const { t } = useTranslation()
  const { rooms, error, creating, createError, create } = useRooms()
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [newRoomName, setNewRoomName] = useState('')

  if (selectedRoom) {
    return <ChatRoom room={selectedRoom} identity={identity} onBack={() => setSelectedRoom(null)} />
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
                  onClick={() => setSelectedRoom(room)}
                  className="flex w-full flex-col gap-0.5 bg-code px-3 py-2.5 text-left transition hover:bg-surface-2"
                >
                  <span className="text-ink">
                    <span className="text-muted">&gt; </span>
                    {room.name}
                  </span>
                  <span className="text-xs text-muted">
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="new-room"
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder={t('rooms.namePlaceholder')}
            autoComplete="off"
            disabled={creating}
            className="min-w-0 flex-1 rounded-md border border-border bg-code px-3 py-2.5 text-sm text-ink caret-accent outline-none focus:border-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={creating || !newRoomName.trim()}
            className="w-full shrink-0 rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink shadow-[0_0_20px_-4px_rgba(0,255,162,0.6)] transition disabled:opacity-40 disabled:shadow-none sm:w-auto"
          >
            {creating ? t('rooms.creating') : t('rooms.create')}
          </button>
        </div>
        {createError && <p className="rounded-md bg-error-bg px-3 py-2.5 text-xs text-error">! {createError}</p>}
      </form>
    </div>
  )
}
