import { describe, expect, it } from 'vitest'
import { canManageRoom, formatTimeRemaining, isRoomExpired, mergeRoom, isNewerRoom, parseRoomEvent, ROOM_D_PREFIX, type Room, slugifyRoom, tallyMessages } from './rooms'

describe('slugifyRoom', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugifyRoom('General Chat')).toBe('general-chat')
  })

  it('collapses repeated whitespace into a single dash', () => {
    expect(slugifyRoom('  a    b  ')).toBe('a-b')
  })

  it('strips characters that are not a-z, 0-9 or dash', () => {
    expect(slugifyRoom('¡Hola! Room #1?')).toBe('hola-room-1')
  })

  it('returns an empty string for input that is only punctuation/whitespace', () => {
    expect(slugifyRoom('   ¡¿!?   ')).toBe('')
  })
})

describe('parseRoomEvent', () => {
  const validAdmin = '1'.repeat(64)

  it('parses a well-formed room event', () => {
    const room = parseRoomEvent({
      pubkey: 'owner-pubkey',
      created_at: 1700000000,
      id: 'event-id',
      tags: [
        ['d', `${ROOM_D_PREFIX}general`],
        ['name', 'General'],
        ['admin', validAdmin],
        ['expiration', '1700086400'],
      ],
    })

    expect(room).toEqual({
      slug: 'general',
      name: 'General',
      admin: validAdmin,
      ownerPubkey: 'owner-pubkey',
      createdAt: 1700000000,
      id: 'event-id',
      expiresAt: 1700086400,
    })
  })

  it('defaults createdAt/id to 0/empty string when the event omits them', () => {
    const room = parseRoomEvent({
      pubkey: 'owner-pubkey',
      tags: [
        ['d', `${ROOM_D_PREFIX}general`],
        ['name', 'General'],
        ['admin', validAdmin],
      ],
    })

    expect(room).toEqual({
      slug: 'general',
      name: 'General',
      admin: validAdmin,
      ownerPubkey: 'owner-pubkey',
      createdAt: 0,
      id: '',
      expiresAt: 0,
    })
  })

  it('defaults expiresAt to 0 when the "expiration" tag is missing or not a number', () => {
    const withoutTag = parseRoomEvent({
      pubkey: 'owner-pubkey',
      tags: [
        ['d', `${ROOM_D_PREFIX}general`],
        ['name', 'General'],
        ['admin', validAdmin],
      ],
    })
    expect(withoutTag?.expiresAt).toBe(0)

    const malformed = parseRoomEvent({
      pubkey: 'owner-pubkey',
      tags: [
        ['d', `${ROOM_D_PREFIX}general`],
        ['name', 'General'],
        ['admin', validAdmin],
        ['expiration', 'not-a-number'],
      ],
    })
    expect(malformed?.expiresAt).toBe(0)
  })

  it('returns null for events whose "d" is not a room (e.g. hive-link)', () => {
    const room = parseRoomEvent({
      pubkey: 'owner-pubkey',
      tags: [['d', 'hive-link']],
    })
    expect(room).toBeNull()
  })

  it('returns null when there is no "d" tag at all', () => {
    expect(parseRoomEvent({ pubkey: 'owner-pubkey', tags: [] })).toBeNull()
  })

  it('returns null when "name" is missing', () => {
    const room = parseRoomEvent({
      pubkey: 'owner-pubkey',
      tags: [
        ['d', `${ROOM_D_PREFIX}general`],
        ['admin', validAdmin],
      ],
    })
    expect(room).toBeNull()
  })

  it('returns null when "admin" is missing', () => {
    const room = parseRoomEvent({
      pubkey: 'owner-pubkey',
      tags: [
        ['d', `${ROOM_D_PREFIX}general`],
        ['name', 'General'],
      ],
    })
    expect(room).toBeNull()
  })

  it('returns null when the room slug (after the prefix) is empty', () => {
    const room = parseRoomEvent({
      pubkey: 'owner-pubkey',
      tags: [
        ['d', ROOM_D_PREFIX],
        ['name', 'General'],
        ['admin', validAdmin],
      ],
    })
    expect(room).toBeNull()
  })
})

describe('isNewerRoom', () => {
  const base: Room = {
    slug: 'general',
    name: 'General',
    admin: '1'.repeat(64),
    ownerPubkey: 'a',
    createdAt: 100,
    id: 'aa',
    expiresAt: 0,
  }

  it('prefers the higher createdAt', () => {
    const newer: Room = { ...base, createdAt: 200, id: 'aa' }
    expect(isNewerRoom(newer, base)).toBe(true)
    expect(isNewerRoom(base, newer)).toBe(false)
  })

  it('breaks a createdAt tie with the higher id, matching the relay backend', () => {
    const higherId: Room = { ...base, id: 'zz' }
    expect(isNewerRoom(higherId, base)).toBe(true)
    expect(isNewerRoom(base, higherId)).toBe(false)
  })
})

describe('formatTimeRemaining', () => {
  const now = 1700000000

  it('rounds down to whole days when a day or more remains', () => {
    expect(formatTimeRemaining(now + 3 * 86400 + 1000, now)).toBe('3d')
  })

  it('rounds down to whole hours when less than a day but an hour or more remains', () => {
    expect(formatTimeRemaining(now + 5 * 3600 + 100, now)).toBe('5h')
  })

  it('rounds down to whole minutes when less than an hour remains', () => {
    expect(formatTimeRemaining(now + 12 * 60 + 30, now)).toBe('12m')
  })

  it('floors at 1m instead of showing 0m for anything still in the future', () => {
    expect(formatTimeRemaining(now + 10, now)).toBe('1m')
  })

  it('returns null once the deadline has passed (should already be deleted, not shown as a misleading negative)', () => {
    expect(formatTimeRemaining(now - 1, now)).toBeNull()
  })

  it('returns null when there is no expiration data (expiresAt <= 0)', () => {
    expect(formatTimeRemaining(0, now)).toBeNull()
  })
})

describe('canManageRoom', () => {
  const room = { ownerPubkey: 'owner-pk', admin: 'admin-pk' }
  const accounts = new Map([
    ['owner-pk', 'Ana'],
    ['admin-pk', 'bea'],
  ])

  it('is true for the exact owner or admin pubkey, and for the superadmin', () => {
    expect(canManageRoom(room, 'owner-pk', 'x', new Map())).toBe(true)
    expect(canManageRoom(room, 'admin-pk', 'x', new Map())).toBe(true)
    expect(canManageRoom(room, 'other', 'x', new Map(), true)).toBe(true)
  })

  it("is true for another device linked to the owner's or admin's hive account (case-insensitive)", () => {
    expect(canManageRoom(room, 'phone-pk', 'ana', accounts)).toBe(true)
    expect(canManageRoom(room, 'phone-pk', 'BEA', accounts)).toBe(true)
  })

  it('is false for a different hive account, or when nothing resolved', () => {
    expect(canManageRoom(room, 'phone-pk', 'carla', accounts)).toBe(false)
    expect(canManageRoom(room, 'phone-pk', 'ana', new Map())).toBe(false)
    expect(canManageRoom(room, 'phone-pk', '', accounts)).toBe(false)
  })
})

describe('mergeRoom', () => {
  const room = (slug: string, createdAt: number, name = slug): Room => ({
    slug, name, admin: 'a', ownerPubkey: 'o', createdAt, id: `id-${createdAt}`, expiresAt: 0,
  })

  it('adds a room that is not in the list yet', () => {
    expect(mergeRoom([room('a', 1)], room('b', 2)).map((r) => r.slug)).toEqual(['a', 'b'])
  })

  it('replaces the existing room with a newer version', () => {
    const out = mergeRoom([room('a', 1, 'viejo')], room('a', 5, 'nuevo'))
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('nuevo')
  })

  it('returns the very same list when the incoming version is older or identical', () => {
    const list = [room('a', 5)]
    expect(mergeRoom(list, room('a', 1))).toBe(list)
    expect(mergeRoom(list, room('a', 5))).toBe(list)
  })
})

describe('isRoomExpired', () => {
  it('is true once the deadline has passed (or is exactly now)', () => {
    expect(isRoomExpired({ expiresAt: 100 }, 101)).toBe(true)
    expect(isRoomExpired({ expiresAt: 100 }, 100)).toBe(true)
  })

  it('is false before the deadline and for rooms with no expiration data', () => {
    expect(isRoomExpired({ expiresAt: 100 }, 99)).toBe(false)
    expect(isRoomExpired({ expiresAt: 0 }, 1_000_000)).toBe(false)
  })
})

describe('tallyMessages', () => {
  it('cuenta por sala e ignora eventos sin tag t', () => {
    const c = tallyMessages([{ tags: [['t', 'a']] }, { tags: [['t', 'a']] }, { tags: [['t', 'b']] }, { tags: [] }])
    expect(c.get('a')).toBe(2)
    expect(c.get('b')).toBe(1)
    expect(c.size).toBe(2)
  })
})
