import { NextRequest } from 'next/server'
import { createQuoteThread, postToThread, mentionAssignee, closeThread, isInternalApiAuthorized } from '@/lib/quotations'

const originalFetch = global.fetch

describe('Discord REST helpers', () => {
  beforeEach(() => {
    process.env.DISCORD_BOT_TOKEN = 'test-token'
    process.env.DISCORD_QUOTE_CHANNEL_ID = 'chan-1'
    process.env.DISCORD_QUOTE_ASSIGNEE_ID = 'user-1'
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('createQuoteThread posts to the channel and returns the new thread id', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'thread-9' }) }) as never
    const threadId = await createQuoteThread('Q-7K2M · vairis · Kurnool bracelet')
    expect(threadId).toBe('thread-9')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/chan-1/threads',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('throws with the response status on a non-ok Discord response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'Missing Access' }) as never
    await expect(createQuoteThread('x')).rejects.toThrow(/403/)
  })

  it('mentionAssignee returns a snowflake mention when set, empty string otherwise', () => {
    expect(mentionAssignee()).toBe('<@user-1>')
    delete process.env.DISCORD_QUOTE_ASSIGNEE_ID
    expect(mentionAssignee()).toBe('')
  })

  it('closeThread posts the message then archives the thread, in that order', async () => {
    const calls: string[] = []
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`)
      return { ok: true, json: async () => ({}), text: async () => '' }
    }) as never
    await closeThread('thread-9', 'Cancelled')
    expect(calls).toEqual([
      'POST https://discord.com/api/v10/channels/thread-9/messages',
      'PATCH https://discord.com/api/v10/channels/thread-9',
    ])
  })
})

describe('isInternalApiAuthorized', () => {
  beforeEach(() => {
    process.env.INTERNAL_API_KEY = 'secret-key'
  })

  it('accepts the exact Bearer token', () => {
    const req = new NextRequest('http://localhost/api/internal/quotations', {
      headers: { authorization: 'Bearer secret-key' },
    })
    expect(isInternalApiAuthorized(req)).toBe(true)
  })

  it('rejects a missing or wrong header', () => {
    const noAuth = new NextRequest('http://localhost/api/internal/quotations')
    const wrongAuth = new NextRequest('http://localhost/api/internal/quotations', {
      headers: { authorization: 'Bearer wrong' },
    })
    expect(isInternalApiAuthorized(noAuth)).toBe(false)
    expect(isInternalApiAuthorized(wrongAuth)).toBe(false)
  })
})
