import { describe, expect, it } from 'vitest'
import { isNewerRoom, parseRoomEvent, ROOM_D_PREFIX, type Room, slugifyRoom } from './rooms'

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
      ],
    })

    expect(room).toEqual({
      slug: 'general',
      name: 'General',
      admin: validAdmin,
      ownerPubkey: 'owner-pubkey',
      createdAt: 1700000000,
      id: 'event-id',
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
    })
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
  const base: Room = { slug: 'general', name: 'General', admin: '1'.repeat(64), ownerPubkey: 'a', createdAt: 100, id: 'aa' }

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
