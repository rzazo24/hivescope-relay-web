import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatRoom } from '../chat/ChatRoom'
import { useHiveAccountNames } from '../../hooks/useHiveAccountNames'
import { SUPERADMIN_HIVE_ACCOUNT } from '../../lib/config'
import type { NostrIdentity } from '../../lib/nostrIdentity'
import { slugifyRoom, type Room } from '../../lib/rooms'
import { useRooms } from './useRooms'

function shortPubkey(pubkey: string) {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`
}

function RoomRow({
  room,
  canManage,
  adminLabel,
  onSelect,
  onSave,
}: {
  room: Room
  canManage: boolean
  adminLabel: string
  onSelect: () => void
  onSave: (name: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(room.name)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const startEdit = () => {
    setName(room.name)
    setSaveError(null)
    setEditing(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setSaveError(null)
    const ok = await onSave(trimmed)
    setSaving(false)
    if (ok) setEditing(false)
    else setSaveError(t('rooms.editError'))
  }

  if (editing) {
    return (
      <li className="bg-code px-3 py-2.5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            disabled={saving}
            className="min-w-0 rounded-md border border-border bg-base px-3 py-2 text-sm text-ink caret-accent outline-none focus:border-accent disabled:opacity-60"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-accent-ink shadow-[0_0_20px_-4px_rgba(0,255,162,0.6)] transition disabled:opacity-40 disabled:shadow-none"
            >
              {saving ? t('rooms.saving') : t('rooms.save')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition hover:text-ink disabled:opacity-60"
            >
              {t('rooms.cancel')}
            </button>
          </div>
          {saveError && <p className="text-xs text-error">! {saveError}</p>}
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-stretch bg-code transition hover:bg-surface-2">
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5 text-left">
        <span className="text-ink">
          <span className="text-muted">&gt; </span>
          {room.name}
        </span>
        <span className="text-xs text-muted">{adminLabel}</span>
      </button>
      {canManage && (
        <button
          type="button"
          onClick={startEdit}
          aria-label={t('rooms.edit')}
          title={t('rooms.edit')}
          className="shrink-0 px-3 text-xs text-muted transition hover:text-accent"
        >
          {t('rooms.edit')}
        </button>
      )}
    </li>
  )
}

export function RoomList({ identity, account }: { identity: NostrIdentity; account: string }) {
  const { t } = useTranslation()
  const { rooms, error, creating, createError, create, update } = useRooms()
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [newRoomName, setNewRoomName] = useState('')
  const adminNames = useHiveAccountNames(rooms?.map((r) => r.admin) ?? [])
  // Cosmético: el relé es quien de verdad decide si la edición se acepta
  // (ver NewRoomMetaPolicy/HIVESCOPE_SUPERADMIN_HIVE_ACCOUNT); esto solo
  // evita esconderle el botón "editar" al superadmin en salas ajenas.
  const isSuperadmin = SUPERADMIN_HIVE_ACCOUNT !== '' && account.toLowerCase() === SUPERADMIN_HIVE_ACCOUNT.toLowerCase()

  if (selectedRoom) {
    return <ChatRoom room={selectedRoom} identity={identity} onBack={() => setSelectedRoom(null)} />
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    const slug = slugifyRoom(newRoomName)
    if (!slug) return
    const ok = await create(slug, newRoomName.trim(), identity.publicKey, identity.secretKey)
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
            {rooms.map((room) => {
              const canManage = identity.publicKey === room.ownerPubkey || identity.publicKey === room.admin || isSuperadmin
              const adminLabel = `${t('rooms.adminPrefix')} ${
                adminNames.has(room.admin) ? `@${adminNames.get(room.admin)}` : shortPubkey(room.admin)
              }`
              return (
                <RoomRow
                  key={`${room.ownerPubkey}:${room.slug}`}
                  room={room}
                  canManage={canManage}
                  adminLabel={adminLabel}
                  onSelect={() => setSelectedRoom(room)}
                  onSave={(name) => update(room.slug, name, room.admin, identity.secretKey)}
                />
              )
            })}
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
