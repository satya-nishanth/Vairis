import { POST } from '@/app/api/auth/signout/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'

jest.mock('@/lib/supabase-server')

const mockCreateClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>

describe('POST /api/auth/signout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('signs out successfully and returns 200 JSON', async () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null })
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        signOut: mockSignOut,
      },
    } as any)

    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('returns 500 JSON if sign out throws', async () => {
    mockCreateClient.mockRejectedValueOnce(new Error('Supabase client error'))

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to sign out')
  })
})
