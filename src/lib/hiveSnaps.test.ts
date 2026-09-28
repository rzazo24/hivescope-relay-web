import { afterEach, describe, expect, it, vi } from 'vitest'
import { findLatestSnapContainer, publishRoomSnap } from './hiveSnaps'

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.hive_keychain
})

function stubFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('findLatestSnapContainer', () => {
  it('returns the newest post of @peak.snaps', async () => {
    const fetchMock = stubFetch({ result: [{ author: 'peak.snaps', permlink: 'snap-today' }] })
    await expect(findLatestSnapContainer()).resolves.toEqual({ author: 'peak.snaps', permlink: 'snap-today' })
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.method).toBe('bridge.get_account_posts')
    expect(sent.params.account).toBe('peak.snaps')
  })

  it('returns null when the account has no posts', async () => {
    stubFetch({ result: [] })
    await expect(findLatestSnapContainer()).resolves.toBeNull()
  })

  it('throws on a non-OK HTTP response and on an RPC error', async () => {
    stubFetch({}, false, 503)
    await expect(findLatestSnapContainer()).rejects.toThrow(/503/)
    stubFetch({ error: { message: 'boom' } })
    await expect(findLatestSnapContainer()).rejects.toThrow('boom')
  })
})

describe('publishRoomSnap', () => {
  it('broadcasts a comment replying to the container, mentioning the room and the site', async () => {
    stubFetch({ result: [{ author: 'peak.snaps', permlink: 'snap-today' }] })
    const calls: unknown[] = []
    window.hive_keychain = {
      requestSignBuffer: () => {},
      requestBroadcast(account, operations, _keyType, callback) {
        calls.push([account, operations])
        callback({ success: true })
      },
    }

    await publishRoomSnap('rzazo24', 'General', 'https://chat.example')

    const [account, operations] = calls[0] as [string, [string, Record<string, string>][]]
    expect(account).toBe('rzazo24')
    const [name, op] = operations[0]
    expect(name).toBe('comment')
    expect(op.parent_author).toBe('peak.snaps')
    expect(op.parent_permlink).toBe('snap-today')
    expect(op.author).toBe('rzazo24')
    expect(op.body).toContain('General')
    expect(op.body).toContain('https://chat.example')
  })

  it('rejects without touching Keychain when there is no container', async () => {
    stubFetch({ result: [] })
    const broadcast = vi.fn()
    window.hive_keychain = { requestSignBuffer: () => {}, requestBroadcast: broadcast }
    await expect(publishRoomSnap('rzazo24', 'General', 'https://x')).rejects.toThrow(/peak\.snaps/)
    expect(broadcast).not.toHaveBeenCalled()
  })
})
