import { isFinanceEmail, requireFinance, requireFinanceApi } from '@/lib/finance-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

jest.mock('@/lib/supabase-server')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    financeAccount: {
      findFirst: jest.fn(),
    },
  },
}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  notFound: jest.fn().mockImplementation(() => {
    throw new Error('NOT_FOUND')
  }),
}))

const mockCreateClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>

function mockSupabase(session: unknown) {
  return { auth: { getSession: jest.fn().mockResolvedValue({ data: { session } }) } } as never
}

const fakeUser = (email: string) => ({
  user: { email, id: 'uid-1', user_metadata: {} },
  access_token: 'tok',
})

beforeEach(() => {
  jest.clearAllMocks()
  process.env.ADMIN_EMAILS = 'anil@thevairis.com,nishi@thevairis.com'
  process.env.FINANCE_EMAILS = 'anil@thevairis.com,surya@thevairis.com,vasu@example.com'
})

describe('isFinanceEmail', () => {
  it('allows listed finance emails only', () => {
    expect(isFinanceEmail('anil@thevairis.com')).toBe(true)
    expect(isFinanceEmail('nishi@thevairis.com')).toBe(false)
  })
})

describe('requireFinance', () => {
  it('sends unauthenticated users through the admin login path', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(null))
    await expect(requireFinance()).rejects.toThrow('REDIRECT:/auth/admin')
  })

  it('404s an admin who is not on FINANCE_EMAILS', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(fakeUser('nishi@thevairis.com')))
    await expect(requireFinance()).rejects.toThrow('NOT_FOUND')
  })

  it('allows a finance admin', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(fakeUser('anil@thevairis.com')))
    const session = await requireFinance()
    expect(session.user.email).toBe('anil@thevairis.com')
  })
})

describe('requireFinanceApi', () => {
  it('returns 403 for a non-finance admin', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(fakeUser('nishi@thevairis.com')))
    const result = await requireFinanceApi()
    expect(result.error?.status).toBe(403)
  })

  it('returns 401 with no session', async () => {
    mockCreateClient.mockResolvedValue(mockSupabase(null))
    const result = await requireFinanceApi()
    expect(result.error?.status).toBe(401)
  })
})
