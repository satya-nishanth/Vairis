import { getSession, requireUser, requireAdmin, isAdminEmail } from '@/lib/auth'
import { assignDynamicRole, revokeDynamicRole, invalidateRoleCache } from '@/lib/roles'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/supabase-server')
jest.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    auth: {
      admin: {
        listUsers: jest.fn().mockResolvedValue({ data: { users: [] } }),
        updateUserById: jest.fn().mockResolvedValue({}),
      },
    },
  }),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { upsert: jest.fn() } },
}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const mockCreateClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>
const mockUser = prisma.user as jest.Mocked<typeof prisma.user>

// Mocks getSession() — reads from cookie, no network call
function mockSupabase(session: any) {
  return { auth: { getSession: jest.fn().mockResolvedValue({ data: { session } }) } } as any
}

const fakeUser = (email = 'user@test.com') => ({
  user: { email, id: 'uid-1', user_metadata: {} },
  access_token: 'tok',
})
const fakeDbUser = (email = 'user@test.com') => ({ id: 'db-1', email, name: 'Test' })

beforeEach(() => {
  jest.clearAllMocks()
  process.env.ADMIN_EMAILS = 'admin@vairis.com,nish99.sn@gmail.com'
})

// ─── getSession ────────────────────────────────────────────────────────────

describe('getSession', () => {
  it('returns null when no session', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(null))
    expect(await getSession()).toBeNull()
  })

  it('returns session when authenticated', async () => {
    const session = fakeUser()
    mockCreateClient.mockResolvedValue(mockSupabase(session))
    expect(await getSession()).toEqual(session)
  })
})

// ─── requireUser ──────────────────────────────────────────────────────────

describe('requireUser', () => {
  it('redirects to /auth/login when no session', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(null))
    await expect(requireUser()).rejects.toThrow('REDIRECT:/auth/login')
  })

  it('redirects to /auth/login when the DB upsert fails (e.g. DB unreachable)', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(fakeUser()))
    mockUser.upsert.mockRejectedValue(new Error('P1001: DB unreachable'))
    await expect(requireUser()).rejects.toThrow('REDIRECT:/auth/login')
  })

  it('returns DB user when session + DB user both exist', async () => {
    const session = fakeUser('user@test.com')
    const dbUser = fakeDbUser('user@test.com')
    mockCreateClient.mockResolvedValue(mockSupabase(session))
    mockUser.upsert.mockResolvedValue(dbUser as any)
    const result = await requireUser()
    expect(result).toEqual(dbUser)
  })

  it('upserts by session email', async () => {
    const session = fakeUser('specific@test.com')
    mockCreateClient.mockResolvedValue(mockSupabase(session))
    mockUser.upsert.mockResolvedValue(fakeDbUser('specific@test.com') as any)
    await requireUser()
    expect(mockUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'specific@test.com' } })
    )
  })
})

// ─── requireAdmin ─────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  it('redirects to /auth/admin when no session', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(null))
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/auth/admin')
  })

  it('redirects to / when email not in ADMIN_EMAILS', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(fakeUser('random@gmail.com')))
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/')
  })

  it('allows first admin email', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(fakeUser('admin@vairis.com')))
    const result = await requireAdmin()
    expect(result?.user.email).toBe('admin@vairis.com')
  })

  it('allows second admin email', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(fakeUser('nish99.sn@gmail.com')))
    const result = await requireAdmin()
    expect(result?.user.email).toBe('nish99.sn@gmail.com')
  })

  it('trims whitespace from ADMIN_EMAILS env var', async () => {
    process.env.ADMIN_EMAILS = '  spaced@test.com , other@test.com  '
    mockCreateClient.mockResolvedValue(mockSupabase(fakeUser('spaced@test.com')))
    await expect(requireAdmin()).resolves.toBeDefined()
  })

  it('rejects when ADMIN_EMAILS is empty', async () => {
    process.env.ADMIN_EMAILS = ''
    mockCreateClient.mockResolvedValue(mockSupabase(fakeUser('admin@vairis.com')))
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/')
  })
})

// ─── isAdminEmail ──────────────────────────────────────────────────────────

describe('isAdminEmail', () => {
  beforeEach(async () => {
    invalidateRoleCache()
    process.env.ADMIN_EMAILS = 'envadmin@thevairis.com'
    process.env.FINANCE_EMAILS = 'envfinance@thevairis.com'
    await revokeDynamicRole('newadmin@thevairis.com')
    await revokeDynamicRole('newfinance@thevairis.com')
  })

  it('allows emails configured in ADMIN_EMAILS', async () => {
    expect(await isAdminEmail('envadmin@thevairis.com')).toBe(true)
  })

  it('allows emails configured in FINANCE_EMAILS', async () => {
    expect(await isAdminEmail('envfinance@thevairis.com')).toBe(true)
  })

  it('allows new dynamic ADMIN email not in env variables', async () => {
    await assignDynamicRole('newadmin@thevairis.com', 'ADMIN', 'dashboard')
    expect(await isAdminEmail('newadmin@thevairis.com')).toBe(true)
  })

  it('allows new dynamic FINANCE email not in env variables', async () => {
    await assignDynamicRole('newfinance@thevairis.com', 'FINANCE', 'dashboard')
    expect(await isAdminEmail('newfinance@thevairis.com')).toBe(true)
  })

  it('rejects customer email not in env or dynamic assignments', async () => {
    expect(await isAdminEmail('regularuser@example.com')).toBe(false)
  })

  it('rejects empty or null email', async () => {
    expect(await isAdminEmail('')).toBe(false)
    expect(await isAdminEmail(null)).toBe(false)
    expect(await isAdminEmail(undefined)).toBe(false)
  })
})
